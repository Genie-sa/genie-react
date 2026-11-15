// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { compileReact18Fixture, loadReact18 } from '../../test-support/react-18'
import { reactCollectorHarness } from '../../test-support/react-collector'

const FILE = '/app/src/Checkout.jsx'
// React 18 reads source from the `jsxDEV` metadata the dev transform compiles in, so the truth is this text's own positions.
const SOURCE = `import { createContext, useContext, useState } from "react";

const Currency = createContext("USD");

export function Checkout() {
  const [step] = useState(1);
  return (
    <Currency.Provider value="EUR">
      <Summary step={step} />
      <Total />
    </Currency.Provider>
  );
}

export function Summary({ step }) {
  return <p id="summary">step {step}</p>;
}

export function Total() {
  const currency = useContext(Currency);
  return <b id="total">{currency}</b>;
}
`
const sourceLines = SOURCE.split('\n')

// A transform that reprints a file without a source map (StyleX's Vite plugin drops blank lines) compiles the JSX source from the reprint, so _debugSource lines stop matching the file on disk.
const SHIFTED_FILE = '/app/src/Shifted.jsx'
const SHIFTED_ON_DISK = `import { useState } from "react";


export function Shifted() {
  const [open] = useState(false);

  return <Inner open={open} />;
}

export function Inner({ open }) {
  return <i id="inner">{String(open)}</i>;
}
`
const SHIFTED_COMPILED_FROM = SHIFTED_ON_DISK.replace(/\n\n+/g, '\n')

const onDisk: Record<string, string> = { [FILE]: SOURCE, [SHIFTED_FILE]: SHIFTED_ON_DISK }

// The Vite dev server's `?raw` answer for a file, served without touching the network.
function viteRawFetch(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(String(input))
  const file = url.pathname.replace(/^\/@fs/, '')
  const text = url.search === '?raw' ? onDisk[file] : undefined
  return Promise.resolve(
    text === undefined
      ? new Response('not found', { status: 404 })
      : new Response(`export default ${JSON.stringify(text)}`, {
          headers: { 'content-type': 'text/javascript' },
        }),
  )
}

function locate(snippet: string): { line: number; column: number } {
  const index = sourceLines.findIndex((text) => text.includes(snippet))
  if (index === -1) throw new Error(`fixture has no line containing ${snippet}`)
  return { line: index + 1, column: (sourceLines[index] as string).indexOf(snippet) + 1 }
}

const { call, start, stop } = reactCollectorHarness()
let unmount: (() => void) | undefined

async function findOne(component: string): Promise<{ id: number; source: unknown }> {
  const found = await call<{ matches: { id: number; source: unknown }[] }>(
    'react_find_components',
    { component, exact: true },
  )
  const [match] = found.matches
  if (!match) throw new Error(`${component} is not mounted`)
  return match
}

beforeAll(async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const react18 = loadReact18()
  start()
  vi.stubGlobal('fetch', viteRawFetch)
  const { Checkout } = await compileReact18Fixture(SOURCE, FILE)
  const { Shifted } = await compileReact18Fixture(SHIFTED_COMPILED_FROM, SHIFTED_FILE)
  const container = document.createElement('div')
  container.id = 'root'
  document.body.append(container)
  const root = react18.createRoot(container)
  const { createElement, Fragment } = react18.React
  await react18.act(() =>
    root.render(
      createElement(
        Fragment,
        null,
        createElement(Checkout as () => null),
        createElement(Shifted as () => null),
      ),
    ),
  )
  unmount = () => root.unmount()
})

afterAll(() => {
  vi.unstubAllGlobals()
  unmount?.()
  stop()
})

describe('React 18 component sources (_debugSource)', () => {
  it('runs against a React 18 renderer', async () => {
    const { React } = loadReact18()
    expect(React.version).toMatch(/^18\./)
  })

  it.each([
    ['Summary', '<Summary step={step} />'],
    ['Total', '<Total />'],
  ])('points %s at the JSX that created it', async (component, snippet) => {
    expect((await findOne(component)).source).toMatchObject({
      file: FILE,
      ...locate(snippet),
      role: 'element-callsite',
    })
  })

  it('withholds a line the file on disk does not show, keeping the file', async () => {
    expect((await findOne('Inner')).source).toMatchObject({
      file: SHIFTED_FILE,
      line: null,
      column: null,
      role: 'element-callsite',
    })
  })

  it('reports the exact allocation callsite in provenance', async () => {
    const report = await call<{ records: { provenance: Record<string, unknown> }[] }>(
      'react_provenance',
      { component: 'Summary' },
    )
    expect(report.records[0]?.provenance).toMatchObject({
      allocationCallsite: { file: FILE, ...locate('<Summary step={step} />') },
      failureReason: null,
    })
  })

  it('reads hooks, props and the providing context on React 18 fibers', async () => {
    const checkout = await call<{ hooks: unknown[] }>('react_inspect_component', {
      id: (await findOne('Checkout')).id,
    })
    expect(checkout.hooks).toEqual([
      expect.objectContaining({
        index: 0,
        kind: 'state',
        hook: 'useState',
        stateIndex: 0,
        value: 1,
      }),
    ])
    const total = await call<{ contexts: { value: unknown; provider: { name: string } | null }[] }>(
      'react_inspect_context',
      { id: (await findOne('Total')).id },
    )
    expect(total.contexts).toEqual([
      {
        name: 'Context',
        value: 'EUR',
        provider: { id: expect.any(Number), name: 'Context.Provider' },
      },
    ])
  })
})
