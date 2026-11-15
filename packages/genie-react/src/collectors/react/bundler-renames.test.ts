// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInThisContext } from 'node:vm'
import { act, render } from '@testing-library/react'
import { getSourceMap } from 'bippy/source'
import * as React from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { reactCollectorHarness } from '../../test-support/react-collector'
import { renamedFrom, resetBundlerRenameScansForTests } from './bundler-renames'
import {
  componentNameMatcher,
  describeComponentMatch,
  recordSourceName,
  resetSourceNamesForTests,
} from './component-name'
import { clearSourceCache } from './source'

const BUNDLE_URL = 'http://genie.test/assets/lab.js'
const MAP_URL = `${BUNDLE_URL}.map`
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

// esbuild gives the memo's inner `Row` the name `Row2`, so it renames the real `Row2` to `Row22`. `Heading2` keeps its name, while the local `Heading` in its body becomes `Heading3`.
const SOURCE = `const { createElement, memo } = globalThis.React
export const Row = memo(function Row({ label }) { return createElement('span', null, label) })
export function Row2() { return createElement('b', null, 'real Row2') }
export function Heading2() { const Heading = 'real Heading2'; return createElement('h2', null, Heading) }
export function Heading() { return createElement('h1', null, createElement(Heading2)) }
export function App() {
  return createElement('main', null, createElement(Row, { label: 'memo' }), createElement(Row2), createElement(Heading))
}
`

interface Bundle {
  code: string
  map: string
  lines: string[]
}

/** esbuild refuses to run under jsdom's TextEncoder, so the bundle is built in a plain Node process. */
function bundle(): Bundle {
  const script = `
    const { buildSync } = require('esbuild')
    const result = buildSync(${JSON.stringify({
      stdin: { contents: SOURCE, sourcefile: 'src/lab.js' },
      bundle: true,
      write: false,
      format: 'iife',
      globalName: 'Lab',
      sourcemap: 'linked',
      outfile: 'assets/lab.js',
      logLevel: 'silent',
    })})
    const text = (suffix) => result.outputFiles.find(({ path }) => path.endsWith(suffix)).text
    process.stdout.write(JSON.stringify({ code: text('lab.js'), map: text('lab.js.map') }))
  `
  const { code, map } = JSON.parse(
    execFileSync(process.execPath, ['-e', script], { cwd: PACKAGE_ROOT, encoding: 'utf8' }),
  ) as { code: string; map: string }
  return { code, map, lines: code.split('\n') }
}

/** A position inside the body of the generated function, where a stack frame for it would point. */
function bodyFrame(
  lines: readonly string[],
  declaration: string,
): { line: number; column: number } {
  const start = lines.findIndex((text) => text.includes(declaration))
  const line = lines.findIndex((text, index) => index > start && text.includes('return'))
  if (start === -1 || line === -1) throw new Error(`bundle has no body for ${declaration}`)
  return { line, column: (lines[line] as string).indexOf('return') }
}

let lab: Bundle

beforeAll(() => {
  lab = bundle()
})

describe('proven source names', () => {
  afterEach(resetSourceNamesForTests)

  it('lets an exact selector match a renamed component and says which name it used', () => {
    recordSourceName('Row2', 'Row')
    expect(['Row2', 'Row22', 'Rows'].filter(componentNameMatcher({ component: 'Row' }))).toEqual([
      'Row2',
    ])
    expect(describeComponentMatch({ component: 'Row' }, ['Row2', 'Rows'])).toMatchObject({
      status: 'matched',
      matchedNames: ['Row2'],
      bundlerRenames: [{ name: 'Row2', sourceName: 'Row' }],
    })
  })

  it('drops a rename once another component with the same runtime name contradicts it', () => {
    recordSourceName('Row2', 'Row')
    recordSourceName('Row2', null)
    recordSourceName('Row2', 'Row')
    expect(componentNameMatcher({ component: 'Row' })('Row2')).toBe(false)
    expect(describeComponentMatch({ component: 'Row2' }, ['Row2'])).not.toHaveProperty(
      'bundlerRenames',
    )
  })
})

describe('renamedFrom', () => {
  async function decodedMap() {
    const map = await getSourceMap(BUNDLE_URL, false, async (url) =>
      url === BUNDLE_URL ? new Response(lab.code) : new Response(lab.map),
    )
    if (!map) throw new Error('bippy could not read the esbuild source map')
    return map
  }

  it.each([
    ['Row2', 'function Row2(', 'Row'],
    ['Row22', 'function Row22(', 'Row2'],
    ['Heading2', 'function Heading2(', null],
  ])(
    'reads the source name of runtime %s from the map',
    async (runtimeName, declaration, expected) => {
      expect(lab.code).toContain(declaration)
      const proof = renamedFrom(
        await decodedMap(),
        lab.lines,
        runtimeName,
        bodyFrame(lab.lines, declaration),
      )
      expect(proof).toBe(expected)
    },
  )

  it('reads a sectioned map relative to the section that holds the frame', async () => {
    const map = await decodedMap()
    const shift = 7
    const sectioned = {
      ...map,
      mappings: [],
      sections: [
        { offset: { line: 0, column: 0 }, map: { ...map, mappings: [], names: [] } },
        { offset: { line: shift, column: 0 }, map: { ...map, sections: undefined } },
      ],
    }
    const lines = [...Array.from({ length: shift }, () => ''), ...lab.lines]
    const frame = bodyFrame(lab.lines, 'function Row2(')
    expect(
      renamedFrom(sectioned, lines, 'Row2', { line: frame.line + shift, column: frame.column }),
    ).toBe('Row')
  })
})

describe('exact component selectors on an esbuild bundle', () => {
  const { call, start, stop } = reactCollectorHarness()
  let unmount: (() => void) | undefined

  interface FindResult {
    matches: { name: string; sourceName?: string }[]
  }

  async function exactMatches(component: string) {
    const found = await call<FindResult>('react_find_components', {
      component,
      exact: true,
      appOnly: false,
    })
    return found.matches.map(({ name, sourceName }) => ({ name, sourceName }))
  }

  beforeAll(async () => {
    vi.stubGlobal('React', React)
    vi.stubGlobal('fetch', async (url: string) =>
      url === BUNDLE_URL
        ? new Response(lab.code)
        : url === MAP_URL
          ? new Response(lab.map)
          : new Response('', { status: 404 }),
    )
    const exports = runInThisContext(`${lab.code}\nLab`, { filename: BUNDLE_URL }) as {
      App: () => React.ReactElement
    }
    start()
    await act(async () => {
      unmount = render(React.createElement(exports.App)).unmount
    })
  })

  afterEach(() => {
    resetSourceNamesForTests()
    resetBundlerRenameScansForTests()
    clearSourceCache()
  })

  afterAll(() => {
    unmount?.()
    stop()
    vi.unstubAllGlobals()
  })

  it('finds a renamed memo component by its source name and reports the rename', async () => {
    expect(await exactMatches('Row')).toEqual([{ name: 'Row2', sourceName: 'Row' }])
  })

  it('finds a real component the bundler renamed to dodge the memo, under its own source name', async () => {
    expect(await exactMatches('Row2')).toEqual([
      { name: 'Row2', sourceName: 'Row' },
      { name: 'Row22', sourceName: 'Row2' },
    ])
  })

  it('never matches a real component whose name differs only by a digit', async () => {
    expect(await exactMatches('Heading')).toEqual([{ name: 'Heading', sourceName: undefined }])
    expect(await exactMatches('Heading2')).toEqual([{ name: 'Heading2', sourceName: undefined }])
  })

  it('discloses the rename in componentMatch for name-filtered evidence', async () => {
    const report = await call<{ componentMatch: Record<string, unknown> }>('react_provenance', {
      component: 'Row',
      appOnly: false,
    })
    expect(report.componentMatch).toMatchObject({
      status: 'matched',
      matchedNames: ['Row2'],
      bundlerRenames: [{ name: 'Row2', sourceName: 'Row' }],
    })
  })
})
