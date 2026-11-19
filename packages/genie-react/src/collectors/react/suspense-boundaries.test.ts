// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { type Fiber, getRDTHook, instrument } from 'bippy'
import {
  Activity,
  createElement,
  lazy,
  type ReactNode,
  Suspense,
  startTransition,
  use,
  useState,
} from 'react'
import { jsx } from 'react/jsx-runtime'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { findAllRootFibers, findByName, noteCommittedRoot } from './fiber'
import { applySuspenseOverride, type DevRenderer, resetOverrides } from './overrides'
import { getSuspenseReport, type SuspenseQuery } from './suspense-boundaries'
import { disposeSuspenseCapture, startSuspenseCapture } from './suspense-capture'
import { reactSuspenseContract } from './suspense-contract'

// React keeps a fallback boundary's retry queue only after its scheduler-driven prerender pass, which act() skips, so these tests run on the real scheduler and wait past its 300ms reveal throttle.
instrument({ onCommitFiberRoot: (_rendererId, root) => noteCommittedRoot(root) })
startSuspenseCapture()
afterAll(disposeSuspenseCapture)

const REVEAL_WAIT_MS = 450
const settle = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms))
const FULL: SuspenseQuery = {
  waitingOnly: false,
  limit: 20,
  blockerLimit: 10,
  includeSource: false,
  appOnly: false,
  view: 'full',
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(displayName?: string): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  if (displayName) Object.assign(promise, { displayName })
  return { promise, resolve }
}

let mounted: { root: Root; host: HTMLElement } | null = null

function mount(element: ReactNode): HTMLElement {
  const host = document.createElement('div')
  host.id = 'root'
  document.body.append(host)
  const root = createRoot(host)
  root.render(element)
  mounted = { root, host }
  return host
}

afterEach(async () => {
  resetOverrides()
  mounted?.root.unmount()
  mounted?.host.remove()
  mounted = null
  await settle(0)
})

async function read(query: Partial<SuspenseQuery> = {}) {
  const report = await getSuspenseReport({ ...FULL, ...query })
  reactSuspenseContract.output.parse(report)
  if (report.view !== 'full') throw new Error('expected the full view')
  return report
}

const boundaryNamed = (report: Awaited<ReturnType<typeof read>>, name: string) => {
  const boundary = report.boundaries.find((candidate) => candidate.name === name)
  if (!boundary) throw new Error(`no boundary named ${name} in ${JSON.stringify(report)}`)
  return boundary
}

function componentId(name: string): number {
  const root = findAllRootFibers()[0] as Fiber
  const match = findByName(root, name, true, 1)[0]
  if (!match) throw new Error(`component ${name} is not mounted`)
  return match.id
}

function Reader({ source }: { source: Promise<string> }): ReactNode {
  return createElement('span', null, use(source))
}

describe('react_suspense on React 19', () => {
  it('names a pending use() promise, then reports what the revealed content awaited', async () => {
    const profile = deferred<string>('loadProfile')
    const host = mount(
      createElement(
        Suspense,
        { name: 'Profile', fallback: 'loading profile' },
        createElement(Reader, { source: profile.promise }),
      ),
    )
    await settle()

    const pending = await read()
    expect(host.textContent).toBe('loading profile')
    expect(pending.capability).toMatchObject({ asyncDebugInfo: 'available', reason: null })
    const waiting = boundaryNamed(pending, 'Profile')
    expect(waiting).toMatchObject({
      state: 'fallback',
      stateEvidence: 'exact',
      blockerStatus: 'pending-observed',
      fallbackCommittedSinceMount: true,
    })
    expect(waiting.blockers).toHaveLength(1)
    expect(waiting.blockers[0]).toMatchObject({
      kind: 'use',
      kindEvidence: 'exact',
      basis: 'react-use-tracking',
      phase: 'pending',
      status: 'pending',
      name: 'loadProfile',
      durationMs: null,
      endMs: null,
    })
    expect(waiting.blockers[0]?.pendingForMs).toBeGreaterThan(0)
    expect(pending.coverage.complete).toBe(true)
    expect(pending.waitingHint).toContain('loadProfile')

    const resolvedAt = performance.now()
    profile.resolve('profile-of-ada')
    await settle(REVEAL_WAIT_MS)

    const revealed = await read()
    expect(host.textContent).toBe('profile-of-ada')
    const content = boundaryNamed(revealed, 'Profile')
    expect(content.state).toBe('content')
    expect(content.blockerStatus).toBe('awaited-only')
    const awaited = content.blockers[0]
    expect(awaited).toMatchObject({
      kind: 'use',
      phase: 'awaited-by-content',
      status: 'fulfilled',
      name: 'loadProfile',
      description: 'profile-of-ada',
      pendingForMs: null,
      awaitedBy: { id: componentId('Reader'), name: 'Reader', env: null },
    })
    expect(awaited?.endMs).toBeGreaterThanOrEqual(roundDown(resolvedAt))
    expect(awaited?.durationMs).toBeGreaterThanOrEqual(
      roundDown(resolvedAt - (awaited?.startMs ?? 0)),
    )
    expect(revealed.waitingHint).toBeNull()
  })

  it('still names the blocker after React commits its retry and clears the live retry queue', async () => {
    const report = deferred<string>('loadReport')
    mount(
      createElement(
        Suspense,
        { name: 'Report', fallback: 'loading report' },
        createElement(Reader, { source: report.promise }),
      ),
    )
    await settle(REVEAL_WAIT_MS)

    const root = findAllRootFibers()[0] as Fiber
    const boundaryFiber = root.child as Fiber
    expect(boundaryFiber.alternate?.updateQueue ?? null).toBeNull()
    const waiting = boundaryNamed(await read(), 'Report')
    expect(waiting.blockerStatus).toBe('pending-observed')
    expect(waiting.blockers.map((blocker) => [blocker.name, blocker.status])).toEqual([
      ['loadReport', 'pending'],
    ])

    report.resolve('quarterly')
    await settle(REVEAL_WAIT_MS)
    const revealed = boundaryNamed(await read(), 'Report')
    expect(revealed.blockers.map((blocker) => blocker.phase)).toEqual(['awaited-by-content'])
  })

  it('identifies a pending React.lazy child exactly and later points at the lazy() call', async () => {
    const chart = deferred<{ default: () => ReactNode }>()
    const LazyChart = lazy(() => chart.promise)
    mount(
      createElement(
        Suspense,
        { name: 'Chart', fallback: 'loading chart' },
        createElement(LazyChart),
      ),
    )
    await settle()

    const pending = boundaryNamed(await read(), 'Chart')
    expect(pending.state).toBe('fallback')
    expect(pending.blockers).toHaveLength(1)
    expect(pending.blockers[0]).toMatchObject({
      kind: 'lazy',
      kindEvidence: 'exact',
      phase: 'pending',
      status: 'pending',
    })

    chart.resolve({
      default: function ChartBody() {
        return createElement('figure', null, 'chart')
      },
    })
    await settle(REVEAL_WAIT_MS)

    const loaded = boundaryNamed(await read({ includeSource: true }), 'Chart')
    expect(loaded.state).toBe('content')
    expect(loaded.blockers[0]).toMatchObject({
      kind: 'lazy',
      basis: 'lazy-type',
      recordedBy: 'lazy-type',
      status: 'fulfilled',
      description: 'ChartBody',
      awaitedBy: { name: 'ChartBody' },
    })
    expect(loaded.blockers[0]?.durationMs).toBeGreaterThan(0)
    expect(loaded.blockers[0]?.location).toMatch(/suspense-boundaries\.test\.ts:\d+$/)
  })

  it('attributes each blocker to its nearest boundary across nested boundaries', async () => {
    const account = deferred<string>('loadAccount')
    const chart = deferred<{ default: () => ReactNode }>()
    const LazyChart = lazy(() => chart.promise)
    mount(
      createElement(
        Suspense,
        { name: 'Outer', fallback: 'outer loading' },
        createElement(Reader, { source: account.promise }),
        createElement(
          Suspense,
          { name: 'Inner', fallback: 'inner loading' },
          createElement(LazyChart),
        ),
      ),
    )
    await settle()

    const first = await read()
    expect(first.boundaries.map((boundary) => boundary.name)).toEqual(['Outer'])
    expect(boundaryNamed(first, 'Outer').blockers.map((blocker) => blocker.name)).toEqual([
      'loadAccount',
    ])

    account.resolve('acct-42')
    await settle(REVEAL_WAIT_MS)

    const second = await read()
    const outer = boundaryNamed(second, 'Outer')
    const inner = boundaryNamed(second, 'Inner')
    expect(outer.state).toBe('content')
    expect(inner.state).toBe('fallback')
    expect(inner.parentBoundaryId).toBe(outer.id)
    expect(outer.blockers.map((blocker) => blocker.kind)).toEqual(['use'])
    expect(inner.blockers).toHaveLength(1)
    expect(inner.blockers[0]).toMatchObject({ kind: 'lazy', phase: 'pending', status: 'pending' })
    expect(second.boundaries[0]?.name).toBe('Inner')

    const targeted = await read({ id: componentId('Reader') })
    expect(targeted.boundaries.map((boundary) => boundary.name)).toEqual(['Outer'])
  })

  it('reports a boundary held by a transition as transition-pending while the old UI stays visible', async () => {
    const results = deferred<string>('searchResults')
    let showResults!: () => void
    function Search(): ReactNode {
      const [ready, setReady] = useState(false)
      showResults = () => startTransition(() => setReady(true))
      return createElement(
        Suspense,
        { name: 'Results', fallback: 'searching' },
        ready ? createElement(Reader, { source: results.promise }) : 'previous results',
      )
    }
    const host = mount(createElement(Search))
    await settle()
    expect(boundaryNamed(await read(), 'Results')).toMatchObject({
      state: 'content',
      blockerStatus: 'none',
    })

    showResults()
    await settle()

    const held = await read()
    expect(host.textContent).toBe('previous results')
    const boundary = boundaryNamed(held, 'Results')
    expect(boundary).toMatchObject({
      state: 'transition-pending',
      stateEvidence: 'inferred',
      fallbackCommittedSinceMount: false,
      blockerStatus: 'pending-observed',
    })
    expect(boundary.blockers[0]).toMatchObject({
      kind: 'use',
      name: 'searchResults',
      status: 'pending',
    })
    expect(held.counts.transitionPending).toBe(1)

    results.resolve('fresh results')
    await settle()
    const done = boundaryNamed(await read(), 'Results')
    expect(host.textContent).toBe('fresh results')
    expect(done.state).toBe('content')
    expect(done.blockers.every((blocker) => blocker.phase === 'awaited-by-content')).toBe(true)
  })

  it('does not report the hidden previous content as a blocker when an update re-suspends', async () => {
    const first = deferred<string>('loadFirst')
    const second = deferred<string>('loadSecond')
    first.resolve('first page')
    let showSecond!: () => void
    function Pager(): ReactNode {
      const [page, setPage] = useState(first.promise)
      showSecond = () => setPage(second.promise)
      return createElement(
        Suspense,
        { name: 'Pager', fallback: 'paging' },
        createElement(Reader, { source: page }),
      )
    }
    const host = mount(createElement(Pager))
    await settle(REVEAL_WAIT_MS)
    expect(host.textContent).toBe('first page')

    showSecond()
    await settle()

    const boundary = boundaryNamed(await read(), 'Pager')
    expect(host.querySelector('span')?.style.display).toBe('none')
    expect(host.textContent).toContain('paging')
    expect(boundary.state).toBe('fallback')
    expect(
      boundary.blockers.map((blocker) => [blocker.name, blocker.phase, blocker.status]),
    ).toEqual([['loadSecond', 'pending', 'pending']])
  })

  it('leaves out boundaries inside a hidden Activity, which are not on screen', async () => {
    const offscreen = deferred<string>('loadOffscreen')
    let reveal!: () => void
    function Tabs(): ReactNode {
      const [mode, setMode] = useState<'hidden' | 'visible'>('hidden')
      reveal = () => setMode('visible')
      return jsx(Activity, {
        mode,
        children: createElement(
          Suspense,
          { name: 'Tab', fallback: 'tab loading' },
          createElement(Reader, { source: offscreen.promise }),
        ),
      })
    }
    mount(createElement(Tabs))
    await settle()
    expect((await read()).boundaries).toEqual([])

    reveal()
    await settle()
    expect(boundaryNamed(await read(), 'Tab').state).toBe('fallback')
  })

  it('flags a transition that suspends above every boundary instead of saying nothing waits', async () => {
    const route = deferred<string>('loadRoute')
    let navigate!: () => void
    function Router(): ReactNode {
      const [next, setNext] = useState(false)
      navigate = () => startTransition(() => setNext(true))
      return next
        ? createElement(Reader, { source: route.promise })
        : createElement('p', null, 'home')
    }
    const host = mount(createElement(Router))
    await settle()
    expect((await read()).coverage.unattributedSuspendedRoots).toBe(0)

    navigate()
    await settle()
    const held = await read()
    expect(host.textContent).toBe('home')
    expect(held.boundaries).toEqual([])
    expect(held.coverage.unattributedSuspendedRoots).toBe(1)
    expect(held.coverage.complete).toBe(false)
    expect(held.waitingHint).toMatch(/no Suspense boundary explains/)

    route.resolve('route ready')
    await settle()
    const done = await read()
    expect(host.textContent).toBe('route ready')
    expect(done.coverage.unattributedSuspendedRoots).toBe(0)
    expect(done.waitingHint).toBeNull()
  })

  it('lists several blockers on one boundary, bounds them, and drops one that resolved', async () => {
    const user = deferred<string>('loadUser')
    const orders = deferred<string>('loadOrders')
    mount(
      createElement(
        Suspense,
        { name: 'Dashboard', fallback: 'loading dashboard' },
        createElement(Reader, { source: user.promise }),
        createElement(Reader, { source: orders.promise }),
      ),
    )
    await settle()

    const both = boundaryNamed(await read(), 'Dashboard')
    expect(both.blockers.map((blocker) => blocker.name).sort()).toEqual(['loadOrders', 'loadUser'])
    expect(both.blockers.every((blocker) => blocker.status === 'pending')).toBe(true)

    const bounded = boundaryNamed(await read({ blockerLimit: 1 }), 'Dashboard')
    expect(bounded.blockers).toHaveLength(1)
    expect(bounded.blockersOmitted).toBe(1)

    user.resolve('ada')
    await settle()
    const remaining = boundaryNamed(await read(), 'Dashboard')
    expect(remaining.state).toBe('fallback')
    const stillPending = remaining.blockers.filter((blocker) => blocker.status === 'pending')
    expect(stillPending.map((blocker) => blocker.name)).toEqual(['loadOrders'])
  })

  it('keeps the snapshot it read and flags a blocker that settled while the read was in flight', async () => {
    const slow = deferred<string>('slowQuery')
    mount(
      createElement(
        Suspense,
        { name: 'Slow', fallback: 'waiting' },
        createElement(Reader, { source: slow.promise }),
      ),
    )
    await settle()

    const inFlight = getSuspenseReport({ ...FULL, includeSource: true })
    slow.resolve('done')
    const report = await inFlight
    reactSuspenseContract.output.parse(report)

    const boundary = report.boundaries.find((candidate) => candidate.name === 'Slow')
    expect(boundary?.blockers[0]?.status).toBe('pending')
    expect(report.coverage.changedDuringRead).toBe(true)
    expect(report.coverage.complete).toBe(false)
  })

  it('says a boundary that never suspended has no blockers instead of inventing one', async () => {
    mount(
      createElement(
        Suspense,
        { name: 'Static', fallback: 'never shown' },
        createElement('p', null, 'ready'),
      ),
    )
    await settle()

    const report = await read()
    expect(boundaryNamed(report, 'Static')).toMatchObject({
      state: 'content',
      fallbackCommittedSinceMount: false,
      blockerStatus: 'none',
      blockers: [],
      blockersOmitted: 0,
    })
    expect(report.coverage.waitingWithoutBlocker).toBe(0)
    expect(report.waitingHint).toBeNull()
  })

  it('leaves a thrown promise unknown and later reports the fallback as unrecorded', async () => {
    const legacy = deferred<string>()
    let value: string | null = null
    void legacy.promise.then((resolved) => {
      value = resolved
    })
    function LegacySuspender(): ReactNode {
      if (value === null) throw legacy.promise
      return createElement('span', null, value)
    }
    mount(
      createElement(
        Suspense,
        { name: 'Legacy', fallback: 'legacy loading' },
        createElement(LegacySuspender),
      ),
    )
    await settle()

    const pending = boundaryNamed(await read(), 'Legacy')
    expect(pending.blockers[0]).toMatchObject({
      kind: 'unknown',
      kindEvidence: 'unknown',
      basis: 'thrown-promise-without-debug-info',
      status: 'unknown',
      phase: 'pending',
    })

    legacy.resolve('legacy ready')
    await settle(REVEAL_WAIT_MS)
    const revealed = boundaryNamed(await read(), 'Legacy')
    expect(revealed).toMatchObject({
      state: 'content',
      fallbackCommittedSinceMount: true,
      blockerStatus: 'unrecorded',
      blockers: [],
    })
  })

  it('reads server-component debug info React carries on a promise as server I/O', async () => {
    const serverPayload = deferred<string>()
    const fetchResult = Promise.resolve({ url: 'https://api.example.test/orders' })
    Object.assign(fetchResult, {
      status: 'fulfilled',
      value: { url: 'https://api.example.test/orders' },
    })
    const ordersPage = { name: 'OrdersPage', env: 'Server' }
    Object.assign(serverPayload.promise, {
      _debugInfo: [
        ordersPage,
        {
          awaited: {
            name: 'fetch',
            start: 10,
            end: 35,
            env: 'Server',
            owner: ordersPage,
            value: fetchResult,
          },
          env: 'Server',
          owner: ordersPage,
        },
      ],
    })
    mount(
      createElement(
        Suspense,
        { name: 'Orders', fallback: 'streaming' },
        createElement(Reader, { source: serverPayload.promise }),
      ),
    )
    await settle()

    const pending = boundaryNamed(await read(), 'Orders')
    expect(pending.blockers[0]).toMatchObject({
      kind: 'server-io',
      kindEvidence: 'exact',
      basis: 'server-environment',
      name: 'fetch',
      env: 'Server',
      status: 'fulfilled',
      description: 'https://api.example.test/orders',
      durationMs: 25,
      awaitedBy: { id: null, name: 'OrdersPage', env: 'Server' },
      owner: { id: null, name: 'OrdersPage', env: 'Server' },
    })
  })

  it('infers a data library only from a stack frame inside that package', async () => {
    const withStack = (frames: string): Error => {
      const error = new Error('react-stack-top-frame')
      error.stack = `Error: react-stack-top-frame\n${frames}`
      return error
    }
    const libraryRead = deferred<string>()
    const appRead = deferred<string>()
    Object.assign(libraryRead.promise, {
      _debugInfo: [
        {
          awaited: {
            name: 'fetchQuery',
            start: 5,
            end: 9,
            debugStack: withStack(
              '    at fetchQuery (http://localhost:5173/node_modules/.vite/deps/@tanstack_react-query.js?v=1:10:5)\n    at loadOrders (http://localhost:5173/src/orders.ts:4:10)',
            ),
          },
        },
      ],
    })
    Object.assign(appRead.promise, {
      _debugInfo: [
        {
          awaited: {
            name: 'loadInvoices',
            start: 5,
            end: 9,
            debugStack: withStack(
              '    at loadInvoices (http://localhost:5173/src/invoices.ts:7:3)',
            ),
          },
        },
      ],
    })
    mount(
      createElement(
        'main',
        null,
        createElement(
          Suspense,
          { name: 'Orders', fallback: 'o' },
          createElement(Reader, { source: libraryRead.promise }),
        ),
        createElement(
          Suspense,
          { name: 'Invoices', fallback: 'i' },
          createElement(Reader, { source: appRead.promise }),
        ),
      ),
    )
    await settle()

    const report = await read()
    expect(boundaryNamed(report, 'Orders').blockers[0]).toMatchObject({
      kind: 'data-library',
      kindEvidence: 'inferred',
      basis: 'data-library-frame',
      location: '/src/orders.ts:4',
    })
    expect(boundaryNamed(report, 'Invoices').blockers[0]).toMatchObject({
      kind: 'unknown',
      kindEvidence: 'unknown',
      basis: 'debug-info-unclassified',
      location: '/src/invoices.ts:7',
    })
  })

  it('keeps /src on a Vite frame under a short directory such as src/lib', async () => {
    const orders = deferred<string>()
    const debugStack = new Error('react-stack-top-frame')
    debugStack.stack =
      'Error: react-stack-top-frame\n    at loadOrders (http://localhost:5173/src/lib/orders.ts?t=1795061730389:4:10)'
    Object.assign(orders.promise, {
      _debugInfo: [{ awaited: { name: 'loadOrders', start: 5, end: 9, debugStack } }],
    })
    mount(
      createElement(
        Suspense,
        { name: 'Orders', fallback: 'o' },
        createElement(Reader, { source: orders.promise }),
      ),
    )
    await settle()

    const [blocker] = boundaryNamed(await read(), 'Orders').blockers
    expect(blocker).toMatchObject({
      location: '/src/lib/orders.ts:4',
      ioStack: [{ file: '/src/lib/orders.ts', line: 4 }],
    })
  })

  it('marks a fallback held by react_toggle_suspense_fallback as forced, not waiting on I/O', async () => {
    mount(
      createElement(
        Suspense,
        { name: 'Forced', fallback: 'forced fallback' },
        createElement('p', { id: 'forced-child' }, 'content'),
      ),
    )
    await settle()
    const renderer = [...getRDTHook().renderers.values()][0] as unknown as DevRenderer
    const root = findAllRootFibers()[0] as Fiber
    const child = root.child?.child?.child as Fiber
    applySuspenseOverride(child, true, renderer)
    await settle()

    const report = await read()
    expect(boundaryNamed(report, 'Forced')).toMatchObject({
      state: 'fallback',
      forced: true,
      blockerStatus: 'not-observable',
      blockers: [],
    })
    expect(report.waitingHint).toContain('react_reset_overrides')
  })

  it('rejects an id that is not inside any boundary', async () => {
    function Outside(): ReactNode {
      return createElement('p', null, 'outside')
    }
    mount(
      createElement(
        'main',
        null,
        createElement(Outside),
        createElement(Suspense, { fallback: null }, 'inside'),
      ),
    )
    await settle()

    await expect(read({ id: componentId('Outside') })).rejects.toThrow(/No <Suspense> boundary/)
    await expect(read({ id: 987_654 })).rejects.toThrow(/not found/)
  })

  it('returns the compact summary by default and the waiting boundaries alone on request', async () => {
    const pending = deferred<string>('loadSummary')
    mount(
      createElement(
        'main',
        null,
        createElement(Suspense, { name: 'Idle', fallback: null }, 'idle'),
        createElement(
          Suspense,
          { name: 'Busy', fallback: 'busy' },
          createElement(Reader, { source: pending.promise }),
        ),
      ),
    )
    await settle()

    const summary = await getSuspenseReport({ ...FULL, view: 'summary', waitingOnly: true })
    reactSuspenseContract.output.parse(summary)
    expect(summary.view).toBe('summary')
    expect(summary.boundaries.map((boundary) => boundary.name)).toEqual(['Busy'])
    expect(summary.counts).toMatchObject({ boundaries: 2, fallback: 1, content: 1 })
    expect(Object.keys(summary.boundaries[0]?.blockers[0] ?? {})).not.toContain('awaitStack')
  })
})

function roundDown(value: number): number {
  return Math.floor(value * 100) / 100 - 1
}
