import type { AnyRouter } from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CollectorContext, GenieCollector } from '../../client'
import {
  resetExternalStoreRegistryForTests,
  routerNotificationFor,
} from '../causal/external-store-registry'
import { routerCollector } from './router'

const ctx: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}

function call<T = unknown>(collector: GenieCollector, name: string, args: unknown): Promise<T> | T {
  const tool = collector.tools?.find((t) => t.contract.name === name)
  if (!tool) throw new Error(`tool not found: ${name}`)
  return tool.handler(args as never, ctx) as Promise<T> | T
}

interface StubRouter {
  router: AnyRouter
  store: object
  emitStore: (snapshot: unknown) => void
  invalidated: number
}

function makeRouter(): StubRouter {
  const storeListeners = new Set<(snapshot: unknown) => void>()
  let invalidated = 0
  const state = {
    location: { pathname: '/', href: '/', searchStr: '', hash: '' },
    status: 'idle',
    isLoading: false,
    isTransitioning: false,
    matches: [
      {
        routeId: '__root__',
        pathname: '/',
        params: {},
        search: {},
        status: 'success',
        isFetching: false,
        loaderData: { ok: true },
      },
      {
        routeId: '/dashboard',
        pathname: '/dashboard',
        params: { id: '7' },
        search: { tab: 'overview' },
        status: 'success',
        isFetching: false,
        loaderData: { widgets: 3 },
      },
    ],
  }
  const store = {
    get: () => state,
    subscribe(listener: (snapshot: unknown) => void) {
      storeListeners.add(listener)
      return { unsubscribe: () => storeListeners.delete(listener) }
    },
  }
  const router = {
    state,
    stores: { __store: store },
    history: { createHref: (href: string) => href },
    subscribe: () => () => {},
    invalidate: async () => {
      invalidated += 1
    },
  }
  return {
    router: router as unknown as AnyRouter,
    store,
    emitStore: (snapshot) => {
      for (const listener of storeListeners) listener(snapshot)
    },
    get invalidated() {
      return invalidated
    },
  }
}

describe('routerCollector', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    resetExternalStoreRegistryForTests()
  })

  it('router_get_state surfaces location, status, and match count', async () => {
    const collector = routerCollector(makeRouter().router)
    const state = (await call(collector, 'router_get_state', {})) as {
      pathname: string
      routerId: string | null
      href: string
      status: string
      isLoading: boolean
      matchCount: number
      browserLocation: unknown
      locationSync: string
    }
    expect(state.pathname).toBe('/')
    expect(state.routerId).toMatch(/^router:/)
    expect(state.status).toBe('idle')
    expect(state.isLoading).toBe(false)
    expect(state.matchCount).toBe(2)
    expect(state.browserLocation).toBeNull()
    expect(state.locationSync).toBe('unavailable')
  })

  it('records the exact snapshot delivered by the Router store subscription', () => {
    const stub = makeRouter()
    const collector = routerCollector(stub.router)
    const stop = collector.start?.(ctx)
    const delivered = { location: { pathname: '/settings' }, status: 'idle' }

    stub.emitStore(delivered)

    expect(routerNotificationFor(stub.store, delivered)).toMatchObject({
      notificationId: expect.stringMatching(/^router-notification:/),
      routerId: expect.stringMatching(/^router:/),
    })
    expect(stop).toBeTypeOf('function')
    if (typeof stop !== 'function') throw new Error('collector did not return cleanup')
    stop()

    const afterStop = { location: { pathname: '/after-stop' }, status: 'idle' }
    stub.emitStore(afterStop)
    expect(routerNotificationFor(stub.store, afterStop)).toBeNull()
  })

  describe('router_get_state isTransitioning on routers that no longer carry the flag', () => {
    type TransitionState = { isTransitioning: boolean }
    function currentRouter(state: Record<string, unknown>) {
      const stub = makeRouter()
      const routerState = stub.router.state as unknown as Record<string, unknown>
      delete routerState.isTransitioning
      Object.assign(routerState, state)
      return routerCollector(stub.router)
    }
    const resolved = { pathname: '/', href: '/', searchStr: '', hash: '' }

    it('is false and present once the location has resolved', async () => {
      const state = (await call(
        currentRouter({ resolvedLocation: resolved }),
        'router_get_state',
        {},
      )) as TransitionState
      expect(JSON.parse(JSON.stringify(state))).toHaveProperty('isTransitioning', false)
    })

    it('is true while the router reports pending', async () => {
      const collector = currentRouter({ status: 'pending', resolvedLocation: resolved })
      const state = (await call(collector, 'router_get_state', {})) as TransitionState
      expect(state.isTransitioning).toBe(true)
    })

    it('is true while the location has not resolved to where the router is going', async () => {
      const collector = currentRouter({
        location: { pathname: '/about', href: '/about', searchStr: '', hash: '' },
        resolvedLocation: resolved,
      })
      const state = (await call(collector, 'router_get_state', {})) as TransitionState
      expect(state.isTransitioning).toBe(true)
    })
  })

  it('router_get_state exposes browser and Router disagreement in one snapshot', async () => {
    vi.stubGlobal('location', {
      href: 'https://example.test/browser?tab=one#details',
      pathname: '/browser',
      search: '?tab=one',
      hash: '#details',
    })
    const collector = routerCollector(makeRouter().router)

    const state = (await call(collector, 'router_get_state', {})) as {
      pathname: string
      browserLocation: { pathname: string }
      locationSync: string
      snapshotAt: number
    }

    expect(state.pathname).toBe('/')
    expect(state.browserLocation.pathname).toBe('/browser')
    expect(state.locationSync).toBe('mismatched')
    expect(state.snapshotAt).toBeGreaterThan(0)
  })

  it('router_list_matches returns each active match with dehydrated loader data', async () => {
    const collector = routerCollector(makeRouter().router)
    const result = (await call(collector, 'router_list_matches', { depth: 2 })) as {
      matches: Array<{ routeId: string; pathname: string; params: unknown; loaderData: unknown }>
    }
    expect(result.matches).toHaveLength(2)
    expect(result.matches[1]?.routeId).toBe('/dashboard')
    expect(result.matches[1]?.params).toEqual({ id: '7' })
    expect(result.matches[1]?.loaderData).toEqual({ widgets: 3 })
  })

  it('router_invalidate forces loaders to re-run', async () => {
    const stub = makeRouter()
    const collector = routerCollector(stub.router)
    const result = (await call(collector, 'router_invalidate', {})) as { ok: boolean }
    expect(result).toEqual({ ok: true })
    expect(stub.invalidated).toBe(1)
  })
})
