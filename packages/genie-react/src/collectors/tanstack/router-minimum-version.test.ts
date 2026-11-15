// @vitest-environment jsdom
import type { AnyRouter } from '@tanstack/react-router'
import { createMemoryHistory, RootRoute, Route, Router } from 'tanstack-react-router-minimum'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CollectorContext, GenieCollector } from '../../client'
import { timelineCollector } from '../timeline'
import { routerCollector } from './router'

const ctx: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}

async function call<T>(collector: GenieCollector, name: string, args: unknown): Promise<T> {
  const tool = collector.tools?.find((candidate) => candidate.contract.name === name)
  if (!tool) throw new Error(`tool not found: ${name}`)
  const result = await tool.handler(tool.contract.input.parse(args) as never, ctx)
  expect(tool.contract.output.safeParse(result).error?.issues).toBeUndefined()
  return result as T
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 20))

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  vi.restoreAllMocks()
})

const cleanups: Array<() => void> = []

/** Router 1.0.0 (no stores, clearCache or canGoBack) needs React 18 to render, so these drive load() directly. */
async function minimumRouter() {
  let releaseLoader: () => void = () => {}
  const loader = new Promise<void>((resolve) => {
    releaseLoader = resolve
  })
  const rootRoute = new RootRoute()
  const routes = [
    new Route({ getParentRoute: () => rootRoute, path: '/' }),
    new Route({ getParentRoute: () => rootRoute, path: '/about' }),
    new Route({ getParentRoute: () => rootRoute, path: '/slow', loader: () => loader }),
  ]
  const router = new Router({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  const appRouter = router as unknown as AnyRouter
  const collector = routerCollector(appRouter)
  const stop = collector.start?.(ctx)
  if (typeof stop === 'function') cleanups.push(stop)
  const loadPushed = (path: '/about' | '/slow') => {
    router.latestLocation = router.buildLocation({ to: path })
    return router.load()
  }
  return { router: appRouter, collector, releaseLoader, loadPushed }
}

it('reports a Router 1.0.0 navigation that never started instead of ok:true', async () => {
  const { collector } = await minimumRouter()

  const result = await call(collector, 'router_navigate', { to: '/about', timeoutMs: 100 })

  expect(result).toMatchObject({ ok: false, outcome: 'not-started', pathname: '/' })
})

it('counts Router 1.0.0 pending matches kept on router state', async () => {
  const { collector, releaseLoader, loadPushed } = await minimumRouter()
  const load = loadPushed('/slow')

  expect(await call(collector, 'router_get_state', {})).toMatchObject({
    pathname: '/slow',
    settled: false,
    pendingMatchCount: 2,
  })
  releaseLoader()
  await load
})

it('drives Router 1.0.0 history without canGoBack', async () => {
  const { collector } = await minimumRouter()

  expect(
    await call(collector, 'router_history', { action: 'forward', timeoutMs: 100 }),
  ).toMatchObject({ ok: false, outcome: 'unchanged', canGoBack: null, length: null })
})

it('advertises router_clear_cache as unavailable on Router 1.0.0', async () => {
  const { collector } = await minimumRouter()
  const tool = collector.tools?.find(
    (candidate) => candidate.contract.name === 'router_clear_cache',
  )

  expect(tool?.availability?.()).toEqual({
    available: false,
    reason: expect.stringContaining('clearCache'),
  })
})

it('records Router 1.0.0 lifecycle events, which carry no hrefChanged, in a readable timeline', async () => {
  const { router, loadPushed } = await minimumRouter()
  const timeline = timelineCollector({ router })
  const recording = await call<{ id: string }>(timeline, 'timeline_start', { name: 'minimum' })
  await loadPushed('/about')
  await flush()
  await call(timeline, 'timeline_stop', { id: recording.id })

  const read = await call<{ events: Array<{ type: string; details: Record<string, unknown> }> }>(
    timeline,
    'timeline_read',
    { id: recording.id, domains: ['navigation'] },
  )

  expect(read.events.map((event) => event.type)).toEqual(['onBeforeLoad', 'onLoad'])
  expect(read.events[0]?.details).toEqual({
    from: '/',
    to: '/about',
    pathChanged: true,
    hrefChanged: null,
  })
})
