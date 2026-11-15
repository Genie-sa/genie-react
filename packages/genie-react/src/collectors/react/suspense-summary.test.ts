// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query'
import { instrument } from 'bippy'
import { createElement, type ReactNode, Suspense } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import type { CollectorContext } from '../../client'
import { resetRenderStartedQueriesForTests } from '../causal/render-started-queries'
import { queryCollector } from '../tanstack/query'
import { noteCommittedRoot } from './fiber'
import { getSuspenseReport, type SuspenseQuery } from './suspense-boundaries'
import { disposeSuspenseCapture, startSuspenseCapture } from './suspense-capture'
import { reactSuspenseContract } from './suspense-contract'

instrument({ onCommitFiberRoot: (_rendererId, root) => noteCommittedRoot(root) })
startSuspenseCapture()
afterAll(disposeSuspenseCapture)

const SUMMARY: SuspenseQuery = {
  waitingOnly: false,
  limit: 20,
  blockerLimit: 2,
  includeSource: false,
  appOnly: false,
  view: 'summary',
}
const REVEAL_WAIT_MS = 450
const settle = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms))
const context: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}

let mounted: { root: Root; host: HTMLElement } | null = null
let stopQuery: (() => void) | undefined

afterEach(() => {
  mounted?.root.unmount()
  mounted?.host.remove()
  mounted = null
  stopQuery?.()
  stopQuery = undefined
  resetRenderStartedQueriesForTests()
})

function mount(element: ReactNode): HTMLElement {
  const host = document.createElement('div')
  host.id = 'root'
  document.body.append(host)
  const root = createRoot(host)
  root.render(element)
  mounted = { root, host }
  return host
}

function serverAwait(
  owner: { name: string; env: string },
  function_: string,
  start: number,
  end: number,
) {
  return {
    awaited: { name: 'wait', start, end, env: 'Server', owner, value: undefined },
    env: 'Server',
    owner,
    stack: [
      [function_, 'app/page.tsx', 1, 1],
      [owner.name, 'app/page.tsx', 2, 1],
    ],
  }
}

/** A streamed RSC chunk as the Flight client hands it to React: an already-resolved thenable child whose debug info names the server components and the awaits that produced it. */
function streamedChunk(debugInfo: unknown[], content: ReactNode) {
  return Object.assign(Promise.resolve(content), {
    status: 'fulfilled',
    value: content,
    _debugInfo: debugInfo,
  })
}

describe('react_suspense summary', () => {
  it('leads with the await that held the boundary longest and names every server component in it', async () => {
    const featured = { name: 'FeaturedCollection', env: 'Server' }
    const picks = { name: 'EditorsPicks', env: 'Server' }
    const chunk = streamedChunk(
      [
        featured,
        serverAwait(featured, 'getFeatured', 10, 160),
        { awaited: { name: 'script', start: 20, end: 26, value: undefined } },
        picks,
        serverAwait(picks, 'getPersonalisedPicks', 12, 1612),
      ],
      createElement('section', null, 'featured and picks'),
    )
    const host = mount(
      createElement(
        Suspense,
        { name: 'Featured', fallback: 'loading' },
        chunk as unknown as ReactNode,
      ),
    )
    await settle()
    expect(host.textContent).toBe('featured and picks')

    const report = await getSuspenseReport(SUMMARY)
    reactSuspenseContract.output.parse(report)

    const boundary = report.boundaries.find((candidate) => candidate.name === 'Featured')
    expect(
      boundary?.blockers.map((blocker) => [blocker.awaitedBy?.name, blocker.durationMs]),
    ).toEqual([
      ['EditorsPicks', 1600],
      ['FeaturedCollection', 150],
    ])
    expect(boundary?.blockersOmitted).toBe(1)
    expect(boundary?.serverComponents).toEqual([featured, picks])
    expect(report.coverage.serverAwaits).toBe('last-settled-per-await')
  })

  it('names the query a useSuspenseQuery boundary waits on and the component that started it', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    stopQuery = queryCollector(queryClient).start?.(context) || undefined
    function Orders(): ReactNode {
      const { data } = useSuspenseQuery({
        queryKey: ['customers', 'c-0042', 'orders'],
        queryFn: () => new Promise<string>(() => {}),
      })
      return createElement('p', null, data)
    }
    function Profile(): ReactNode {
      const { data } = useSuspenseQuery({
        queryKey: ['customers', 'c-0042'],
        queryFn: () => Promise.resolve('Ada'),
      })
      return createElement('h1', null, data)
    }
    const host = mount(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          Suspense,
          { name: 'Page', fallback: 'page loading' },
          createElement(Profile),
          createElement(
            Suspense,
            { name: 'Orders', fallback: 'orders loading' },
            createElement(Orders),
          ),
        ),
      ),
    )
    await settle(REVEAL_WAIT_MS)
    expect(host.textContent).toBe('Adaorders loading')

    const report = await getSuspenseReport({ ...SUMMARY, waitingOnly: true })
    reactSuspenseContract.output.parse(report)

    expect(report.boundaries.map((boundary) => boundary.name)).toEqual(['Orders'])
    expect(report.boundaries[0]?.blockers).toEqual([
      expect.objectContaining({
        kind: 'data-library',
        kindEvidence: 'inferred',
        status: 'pending',
        query: {
          queryHash: '["customers","c-0042","orders"]',
          queryKey: ['customers', 'c-0042', 'orders'],
        },
        awaitedBy: expect.objectContaining({ name: 'Orders' }),
      }),
    ])
    expect(report.boundaries[0]?.blockers[0]?.pendingForMs).toBeGreaterThan(0)
    expect(report.waitingHint).toContain('["customers","c-0042","orders"]')
  })

  it('never pairs a thrown promise with a query a nested boundary started', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    stopQuery = queryCollector(queryClient).start?.(context) || undefined
    const thrown = new Promise<never>(() => {})
    function Thrower(): ReactNode {
      throw thrown
    }
    function Nested(): ReactNode {
      const { data } = useSuspenseQuery({
        queryKey: ['nested'],
        queryFn: () => new Promise<string>(() => {}),
      })
      return createElement('p', null, data)
    }
    mount(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          Suspense,
          { name: 'Outer', fallback: 'waiting' },
          createElement(Thrower),
          createElement(Suspense, { name: 'Inner', fallback: 'inner' }, createElement(Nested)),
        ),
      ),
    )
    await settle(REVEAL_WAIT_MS)
    expect(queryClient.getQueryState(['nested'])?.fetchStatus).toBe('fetching')

    const report = await getSuspenseReport({ ...SUMMARY, waitingOnly: true })
    const outer = report.boundaries.find((boundary) => boundary.name === 'Outer')
    expect(outer?.blockers).toEqual([expect.objectContaining({ kind: 'unknown', query: null })])
  })
})
