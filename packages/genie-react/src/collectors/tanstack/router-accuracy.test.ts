// @vitest-environment jsdom
import {
  createBrowserHistory,
  createHashHistory,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
  Outlet,
  type RouterHistory,
  RouterProvider,
  redirect,
} from '@tanstack/react-router'
import { type RenderResult, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectorContext, GenieCollector } from '../../client'
import { resetExternalStoreRegistryForTests } from '../causal/external-store-registry'
import { routerCollector } from './router'

const ctx: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}

interface RouterState {
  pathname: string
  resolvedPathname: string | null
  status: string
  isLoading: boolean
  settled: boolean
  pendingWork: string[]
  locationSync: string
}

interface NavigationResult {
  ok: boolean
  outcome: string
  pathname: string
  href: string
  settled: boolean
  pendingWork: string[]
}

async function call<T>(collector: GenieCollector, name: string, args: unknown): Promise<T> {
  const tool = collector.tools?.find((candidate) => candidate.contract.name === name)
  if (!tool) throw new Error(`tool not found: ${name}`)
  const result = await tool.handler(tool.contract.input.parse(args) as never, ctx)
  expect(tool.contract.output.safeParse(result).error?.issues).toBeUndefined()
  return result as T
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

/** React schedules router transitions itself, as in a browser; act would hold them until it exits. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 20))

async function settledState(collector: GenieCollector): Promise<RouterState> {
  const deadline = Date.now() + 2_000
  let state = await call<RouterState>(collector, 'router_get_state', {})
  while (!state.settled && Date.now() < deadline) {
    await flush()
    state = await call<RouterState>(collector, 'router_get_state', {})
  }
  return state
}

let view: RenderResult | null = null
const cleanups: Array<() => void> = []

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  view?.unmount()
  view = null
  for (const cleanup of cleanups.splice(0).reverse()) cleanup()
  resetExternalStoreRegistryForTests()
  vi.restoreAllMocks()
})

function app(history: RouterHistory = createMemoryHistory({ initialEntries: ['/'] })) {
  const slow = deferred()
  const revalidation = deferred()
  let staleLoads = 0
  const page = (text: string) => () => createElement('main', null, text)
  const rootRoute = createRootRoute({ component: () => createElement(Outlet) })
  const routes = [
    createRoute({ getParentRoute: () => rootRoute, path: '/', component: page('home') }),
    createRoute({ getParentRoute: () => rootRoute, path: '/about', component: page('about') }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/slow',
      loader: () => slow.promise,
      component: page('slow'),
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/stale',
      staleTime: 0,
      loader: () => {
        staleLoads += 1
        return staleLoads === 1 ? 'first' : revalidation.promise.then(() => 'second')
      },
      component: page('stale'),
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/old',
      beforeLoad: () => {
        throw redirect({ to: '/about' })
      },
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/missing',
      loader: () => {
        throw notFound()
      },
      notFoundComponent: page('missing'),
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/broken',
      loader: () => {
        throw new Error('loader failed')
      },
      errorComponent: page('broken'),
    }),
  ]
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  })
  const collector = routerCollector(router)
  const stop = collector.start?.(ctx)
  if (typeof stop === 'function') cleanups.push(stop)
  return { router, collector, slow, revalidation }
}

async function mounted(history?: RouterHistory) {
  const fixture = app(history)
  view = render(createElement(RouterProvider, { router: fixture.router } as never))
  await fixture.router.load()
  expect(await settledState(fixture.collector)).toMatchObject({ settled: true })
  return fixture
}

const rendered = () => view?.container.textContent

describe('router_get_state settlement', () => {
  it('stays unsettled while a loader runs and settles once the route renders', async () => {
    const { router, collector, slow } = await mounted()
    const navigation = router.navigate({ to: '/slow' })
    await flush()

    const during = await call<RouterState>(collector, 'router_get_state', {})
    expect(during).toMatchObject({ pathname: '/slow', resolvedPathname: '/', settled: false })
    expect(during.pendingWork).toEqual(expect.arrayContaining(['loading', 'pending-matches']))

    slow.resolve()
    await navigation
    expect(await settledState(collector)).toMatchObject({
      resolvedPathname: '/slow',
      settled: true,
      pendingWork: [],
    })
    expect(rendered()).toBe('slow')
  })

  it('stays unsettled while a stale-while-revalidate loader runs after isLoading clears', async () => {
    const { router, collector, revalidation } = await mounted()
    await router.navigate({ to: '/stale' })
    await router.navigate({ to: '/about' })
    await router.navigate({ to: '/stale' })
    await flush()

    const revalidating = await call<RouterState>(collector, 'router_get_state', {})
    expect(router.state.matches.at(-1)?.isFetching).toBeTruthy()
    expect(revalidating).toMatchObject({ isLoading: false, settled: false })
    expect(revalidating.pendingWork).toContain('match-fetching:/stale')

    revalidation.resolve()
    expect(await settledState(collector)).toMatchObject({ settled: true })
    expect(router.state.matches.at(-1)?.loaderData).toBe('second')
  })

  it('reports the hash-history location as in sync with the browser URL', async () => {
    window.history.replaceState(null, '', '/#/about')
    const { collector } = await mounted(createHashHistory())

    expect(await call<RouterState>(collector, 'router_get_state', {})).toMatchObject({
      pathname: '/about',
      locationSync: 'matched',
    })
  })
})

describe('router_navigate outcome', () => {
  it.each([
    ['/about', { ok: true, outcome: 'arrived', pathname: '/about' }, 'about'],
    ['/old', { ok: false, outcome: 'elsewhere', pathname: '/about' }, 'about'],
    ['/missing', { ok: false, outcome: 'not-found', pathname: '/missing' }, 'missing'],
    ['/broken', { ok: false, outcome: 'error', pathname: '/broken' }, 'broken'],
  ])('reports %s as the router settled it', async (to, expected, screen) => {
    const { collector } = await mounted()
    const result = await call<NavigationResult>(collector, 'router_navigate', { to })
    expect(result).toMatchObject({ ...expected, settled: true })
    expect(rendered()).toBe(screen)
  })

  it('arrives on a search-param-only change', async () => {
    const { collector } = await mounted()
    const result = await call<NavigationResult>(collector, 'router_navigate', {
      to: '/',
      search: { tab: 'b' },
    })
    expect(result).toMatchObject({ ok: true, outcome: 'arrived', href: '/?tab=b' })
  })

  it('reports pending when the loader outlives the timeout', async () => {
    const { collector, slow } = await mounted()
    const result = await call<NavigationResult>(collector, 'router_navigate', {
      to: '/slow',
      timeoutMs: 100,
    })
    expect(result).toMatchObject({ ok: false, outcome: 'pending', settled: false })
    slow.resolve()
    await flush()
  })

  it('reports a navigation a blocker refused instead of hanging', async () => {
    const { router, collector } = await mounted(createBrowserHistory())
    cleanups.push(router.history.block({ blockerFn: () => true }))
    const result = await call<NavigationResult>(collector, 'router_navigate', {
      to: '/about',
      timeoutMs: 200,
    })
    expect(result).toMatchObject({ ok: false, outcome: 'not-started', pathname: '/' })
    expect(window.location.pathname).toBe('/')
  })

  it('leaves the router idle after preloading a route', async () => {
    const { collector, slow } = await mounted()
    const preload = call(collector, 'router_preload', { to: '/slow' })
    expect(await call<RouterState>(collector, 'router_get_state', {})).toMatchObject({
      pathname: '/',
      settled: true,
    })
    slow.resolve()
    await expect(preload).resolves.toMatchObject({ ok: true })
  })
})

describe('router_history', () => {
  it('reports the entry the browser actually moved to after an asynchronous popstate', async () => {
    const { collector } = await mounted(createBrowserHistory())
    await call(collector, 'router_navigate', { to: '/about' })

    const result = await call<NavigationResult>(collector, 'router_history', { action: 'back' })

    expect(window.location.pathname).toBe('/')
    expect(result).toMatchObject({ ok: true, outcome: 'moved', pathname: '/', settled: true })
    expect(rendered()).toBe('home')
  })

  it('refuses to go back past the first app entry instead of leaving the app', async () => {
    const { collector } = await mounted(createBrowserHistory())
    const back = vi.spyOn(window.history, 'back')

    const result = await call<NavigationResult>(collector, 'router_history', { action: 'back' })

    expect(result).toMatchObject({ ok: false, outcome: 'no-entry', pathname: '/' })
    expect(back).not.toHaveBeenCalled()
  })
})
