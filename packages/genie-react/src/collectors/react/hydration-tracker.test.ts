// @vitest-environment jsdom
import 'bippy/install-hook-only'
import {
  createContext,
  createElement as h,
  type ReactNode,
  Suspense,
  useContext,
  useEffect,
  useState,
} from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { reactCollectorHarness } from '../../test-support/react-collector'
import type { HydrationToolReport } from './hydration-report'
import {
  disposeHydrationTracking,
  resetHydrationStateForTests,
  startHydrationTracking,
} from './hydration-tracker'

const { call, start, stop } = reactCollectorHarness()
const settle = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

beforeAll(() => {
  startHydrationTracking()
  start()
})
afterAll(() => {
  stop()
  disposeHydrationTracking()
})

const mounted: Array<{ root: Root; host: HTMLElement }> = []
const recovered: string[] = []

afterEach(() => {
  for (const { root, host } of mounted.splice(0)) {
    root.unmount()
    host.remove()
  }
  recovered.length = 0
  resetHydrationStateForTests()
})

/** A document still receiving the server's stream: React waits for a pending `$?` boundary instead of treating it as a failed server render. */
function whileStreaming(): () => void {
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'loading' })
  return () => {
    Reflect.deleteProperty(document, 'readyState')
  }
}

async function hydrate(serverHtml: string, client: ReactNode): Promise<HTMLElement> {
  const host = document.createElement('div')
  host.innerHTML = serverHtml
  document.body.append(host)
  const root = hydrateRoot(host, client, {
    onRecoverableError: (error) => recovered.push(String((error as Error).message)),
  })
  mounted.push({ root, host })
  await settle()
  return host
}

const read = () => call<HydrationToolReport>('react_hydration', {})

function Price({ amount }: { amount: string }): ReactNode {
  return h('span', { className: 'price' }, amount)
}

const page = (amount: string) =>
  h('main', null, h(Suspense, { name: 'Delivery', fallback: 'loading' }, h(Price, { amount })))

describe('react_hydration', () => {
  it('reports a clean hydration as hydrated, with nothing rendered again on the client', async () => {
    const host = await hydrate(renderToString(page('$10')), page('$10'))
    expect(host.innerHTML).toContain('<!--$-->')

    const report = await read()
    expect(report.roots).toEqual([{ rootComponent: 'Price', outcome: 'hydrated' }])
    expect(report.counts).toEqual({
      boundariesHydrated: 1,
      boundariesClientRendered: 0,
      rootsClientRendered: 0,
      reports: 0,
    })
    expect(report.clientRendered).toEqual([])
    expect(report.coverage).toMatchObject({ complete: true, hydrationInProgress: false })
    expect(report.hint).toBeNull()
  })

  it('names the boundary React rendered again on the client, the component, and what differed', async () => {
    const host = await hydrate(renderToString(page('Dienstag, 3. März')), page('Tuesday, March 3'))
    expect(recovered[0]).toMatch(/^Hydration failed because the server rendered text/)
    expect(host.innerHTML).not.toContain('<!--$-->')

    const report = await read()
    expect(report.clientRendered).toEqual([
      expect.objectContaining({
        scope: 'boundary',
        name: 'Delivery',
        evidence: 'exact',
        basis: 'server-html-deleted',
        reportIndexes: [0],
      }),
    ])
    expect(report.reports[0]).toMatchObject({
      kind: 'text-mismatch',
      regenerated: true,
      component: expect.objectContaining({ name: 'Price' }),
      element: 'span',
      boundaryId: report.clientRendered[0]?.boundaryId,
      differences: [{ under: 'span', client: 'Tuesday, March 3', server: 'Dienstag, 3. März' }],
    })
    expect(report.reports[0]?.componentStack.join('\n')).toContain('Price')
    expect(report.hint).toContain('Dienstag, 3. März')

    const suspense = await call<{ boundaries: Array<{ name: string; hydration: string | null }> }>(
      'react_suspense',
      { includeSource: false },
    )
    expect(suspense.boundaries.find((boundary) => boundary.name === 'Delivery')?.hydration).toBe(
      'client-rendered',
    )
  })

  it('reports a mismatch outside every boundary as the whole root rendered on the client', async () => {
    await hydrate(renderToString(h(Price, { amount: 'server' })), h(Price, { amount: 'client' }))

    const report = await read()
    expect(report.roots[0]?.outcome).toBe('client-rendered')
    expect(report.clientRendered).toEqual([
      expect.objectContaining({
        scope: 'root',
        basis: 'root-forced-client-render',
        reportIndexes: [0],
      }),
    ])
    expect(report.reports[0]).toMatchObject({ kind: 'text-mismatch', regenerated: true })
  })

  it('reports an attribute-only mismatch as a warning React did not patch, not as a client render', async () => {
    const view = (theme: string) => h('p', { className: theme }, 'same text')
    await hydrate(renderToString(view('light')), view('dark'))

    const report = await read()
    expect(report.clientRendered).toEqual([])
    expect(report.roots[0]?.outcome).toBe('hydrated')
    expect(report.reports).toEqual([
      expect.objectContaining({
        kind: 'attribute-mismatch',
        regenerated: false,
        differences: [{ under: 'p', client: 'className="dark"', server: 'className="light"' }],
      }),
    ])
  })

  it('reports a server boundary React discarded without any error when an update reached it before it hydrated', async () => {
    const Theme = createContext('light')
    function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
      const [theme, setTheme] = useState('light')
      useEffect(() => setTheme('dark'), [])
      return h(Theme.Provider, { value: theme }, children)
    }
    function Themed(): ReactNode {
      return h('span', null, useContext(Theme))
    }
    const streamingHtml = '<main><!--$?--><template id="B:0"></template>loading<!--/$--></main>'
    const streamed = whileStreaming()
    const host = await hydrate(
      streamingHtml,
      h(
        ThemeProvider,
        null,
        h('main', null, h(Suspense, { name: 'Picks', fallback: 'loading' }, h(Themed))),
      ),
    )
    streamed()
    expect(recovered).toEqual([])
    expect(host.textContent).toBe('dark')

    const report = await read()
    expect(report.reports).toEqual([])
    expect(report.clientRendered).toEqual([
      expect.objectContaining({ scope: 'boundary', name: 'Picks', reportIndexes: [] }),
    ])
    expect(report.hint).toMatch(/without reporting an error/)
  })

  it('reports a root created on the client as not server rendered, beside one that hydrated', async () => {
    await hydrate(renderToString(page('$10')), page('$10'))
    const overlayHost = document.createElement('div')
    document.body.append(overlayHost)
    const overlay = createRoot(overlayHost)
    overlay.render(h('aside', null, 'dev overlay'))
    mounted.push({ root: overlay, host: overlayHost })
    await settle()

    const report = await read()
    expect(report.roots.map((root) => root.outcome)).toEqual(['hydrated', 'not-server-rendered'])
    expect(report.coverage).toMatchObject({ complete: true, rootsSeenLate: 0 })
  })

  it('keeps a server boundary that is still streaming as hydration in progress', async () => {
    const streamed = whileStreaming()
    await hydrate(
      '<main><!--$?--><template id="B:0"></template>loading<!--/$--></main>',
      h(
        'main',
        null,
        h(Suspense, { name: 'Streaming', fallback: 'loading' }, h('p', null, 'later')),
      ),
    )

    const report = await read()
    streamed()
    expect(report.roots[0]?.outcome).toBe('hydrated')
    expect(report.clientRendered).toEqual([])
    expect(report.coverage).toMatchObject({ complete: false, hydrationInProgress: true })
  })
})
