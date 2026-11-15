// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Page } from '../../test-support/fixtures/source-components'
import { reactCollectorHarness } from '../../test-support/react-collector'

// Truth comes from the fixture's own text, so a moved line moves the expectation with it.
const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../test-support/fixtures/source-components.ts',
)
const fixtureLines = readFileSync(FIXTURE, 'utf8').split('\n')

function locate(snippet: string): { line: number; column: number } {
  const index = fixtureLines.findIndex((text) => text.includes(snippet))
  if (index === -1) throw new Error(`fixture has no line containing ${snippet}`)
  return { line: index + 1, column: (fixtureLines[index] as string).indexOf(snippet) + 1 }
}

const { call, start, stop } = reactCollectorHarness()
let unmount: (() => void) | undefined

interface Source {
  file: string
  line: number | null
  column: number | null
  functionName: string | null
  role?: string
}

async function sourcesOf(component: string): Promise<Source[]> {
  const found = await call<{ matches: { source: Source | null }[] }>('react_find_components', {
    component,
    exact: true,
    appOnly: false,
  })
  return found.matches.map((match) => {
    if (!match.source) throw new Error(`${component} has no source`)
    return match.source
  })
}

beforeAll(async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  start()
  const container = document.createElement('div')
  container.id = 'root'
  document.body.append(container)
  await act(async () => {
    unmount = render(createElement(Page), { container }).unmount
  })
})

afterAll(() => {
  unmount?.()
  stop()
})

describe('React 19 component sources (owner stacks)', () => {
  it.each([
    ['Card', 'h(Card, null)', 'Page'],
    ['CardTitle', 'h(CardTitle, null)', 'Card'],
    ['Badge', 'h(Badge, null)', 'Page'],
    ['Field', 'h(Field, null)', 'Page'],
  ])(
    'points %s at the exact line and column that created its element',
    async (component, snippet, owner) => {
      const [source] = await sourcesOf(component)
      expect(source).toMatchObject({
        file: FIXTURE,
        ...locate(snippet),
        functionName: owner,
        role: 'element-callsite',
      })
    },
  )

  it('points every list row at the helper that created it, not at the list', async () => {
    const rows = await sourcesOf('Row')
    expect(rows).toHaveLength(2)
    for (const source of rows) {
      expect(source).toMatchObject({
        file: FIXTURE,
        ...locate('h(Row, { key: label, label })'),
        functionName: 'renderRow',
        role: 'element-callsite',
      })
    }
  })

  it('fills only the provenance role it observed', async () => {
    const report = await call<{
      records: { name: string; provenance: Record<string, unknown> }[]
    }>('react_provenance', { component: 'CardTitle' })
    expect(report.records[0]?.provenance).toMatchObject({
      allocationCallsite: { file: FIXTURE, ...locate('h(CardTitle, null)') },
      definitionSource: null,
      failureReason: null,
    })
  })

  it('labels a root element without an app callsite by the first element its body creates', async () => {
    const [source] = await sourcesOf('Page')
    const body = locate('export function Page()').line + 1
    expect(source).toMatchObject({
      file: FIXTURE,
      line: body,
      column: (fixtureLines[body - 1] as string).indexOf('h(') + 1,
      functionName: 'Page',
      role: 'component-body',
    })
  })
})
