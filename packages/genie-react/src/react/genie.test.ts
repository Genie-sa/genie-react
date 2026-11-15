// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createContext, createElement, type ReactNode, StrictMode } from 'react'
import { connect, Provider } from 'react-redux'
import { combineReducers, createStore } from 'redux'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReduxStoreTap } from '../collectors/redux/store-tap'
import { GENIE_GLOBAL_KEY } from '../protocol'
import type { GenieProps } from './genie'

type TaggedCollector = { __collector: string }
type ClientConfig = { appName?: string; collectors: TaggedCollector[] }

async function loadGenie(router: unknown) {
  vi.resetModules()
  const startSpy = vi.fn()
  const createGenieClient = vi.fn((_config: ClientConfig) => ({ start: startSpy }))
  const tag = (name: string) => () => ({ __collector: name })

  vi.doMock('../client', () => ({
    createGenieClient,
    sessionCollector: tag('session'),
    defineCollector: (collector: unknown) => collector,
    defineCollectorTool: (tool: unknown) => tool,
  }))
  vi.doMock('../collectors/react', () => ({ reactCollector: tag('react') }))
  vi.doMock('../collectors/memory', () => ({ memoryCollector: tag('memory') }))
  vi.doMock('../collectors/perf', () => ({ perfCollector: tag('perf') }))
  vi.doMock('../collectors/visibility', () => ({ visibilityCollector: tag('visibility') }))
  vi.doMock('../collectors/timeline', () => ({ timelineCollector: tag('timeline') }))
  const pluginPassthroughCollector = vi.fn(() => ({ __collector: 'plugin' }))
  vi.doMock('../collectors/devtools-passthrough', () => ({ pluginPassthroughCollector }))
  vi.doMock('../collectors/tanstack', () => ({
    routerCollector: (r: unknown) => ({ __collector: 'router', router: r }),
    queryCollector: (q: unknown) => ({ __collector: 'query', query: q }),
  }))
  vi.doMock('@tanstack/react-router', () => ({ useRouter: () => router }))
  const QueryClientContext = createContext<unknown>(undefined)
  vi.doMock('@tanstack/react-query', () => ({ QueryClientContext }))

  const { Genie } = await import('./genie')
  return { Genie, createGenieClient, startSpy, pluginPassthroughCollector, QueryClientContext }
}

const names = (collectors: TaggedCollector[]) => collectors.map((c) => c.__collector)

afterEach(() => {
  cleanup()
  delete (globalThis as Record<string, unknown>)[GENIE_GLOBAL_KEY]
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('<Genie /> in a plain React app (no router)', () => {
  it('starts its own client with the base collectors and never errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { Genie, createGenieClient, startSpy } = await loadGenie(undefined)

    render(createElement(Genie))

    expect(createGenieClient).toHaveBeenCalledTimes(1)
    expect(names(createGenieClient.mock.calls[0]?.[0]?.collectors ?? [])).toEqual([
      'session',
      'react',
      'memory',
      'perf',
      'visibility',
      'plugin',
      'timeline',
    ])
    expect(startSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).not.toHaveBeenCalled()
  })
})

describe('<Genie /> with a plugin-injected client already running', () => {
  it('registers the augmenting collectors onto it instead of starting a second client', async () => {
    const register = vi.fn()
    ;(globalThis as Record<string, unknown>)[GENIE_GLOBAL_KEY] = { register }
    const { Genie, createGenieClient } = await loadGenie(undefined)

    render(createElement(Genie))

    expect(createGenieClient).not.toHaveBeenCalled()
    expect(register).toHaveBeenCalledTimes(5)
    const registered = register.mock.calls.map((c) => (c[0] as TaggedCollector).__collector)
    expect(registered).toEqual(['memory', 'perf', 'visibility', 'plugin', 'timeline'])
  })
})

describe('<Genie /> when a QueryClient appears after the first mount', () => {
  it('registers the query collector, and a timeline that sees it, on the running client', async () => {
    const register = vi.fn()
    ;(globalThis as Record<string, unknown>)[GENIE_GLOBAL_KEY] = { register }
    const { Genie, QueryClientContext } = await loadGenie(undefined)
    const queryClient = { getQueryCache: () => ({}) }

    const view = render(
      createElement(QueryClientContext.Provider, { value: undefined }, createElement(Genie)),
    )
    register.mockClear()
    view.rerender(
      createElement(QueryClientContext.Provider, { value: queryClient }, createElement(Genie)),
    )

    expect(register.mock.calls.map((call) => call[0])).toEqual([
      { __collector: 'query', query: queryClient },
      { __collector: 'timeline' },
    ])
  })
})

describe('<Genie /> under a TanStack Router', () => {
  it('adds the router collector, and the query collector when a QueryClient is in context', async () => {
    const router = { options: { context: { queryClient: { getQueryCache: () => ({}) } } } }
    const { Genie, createGenieClient } = await loadGenie(router)

    render(createElement(Genie))

    expect(names(createGenieClient.mock.calls[0]?.[0]?.collectors ?? [])).toEqual([
      'session',
      'react',
      'memory',
      'perf',
      'visibility',
      'plugin',
      'timeline',
      'router',
      'query',
    ])
  })

  it('adds only the router collector when there is no QueryClient in context', async () => {
    const router = { options: { context: {} } }
    const { Genie, createGenieClient } = await loadGenie(router)

    render(createElement(Genie))

    expect(names(createGenieClient.mock.calls[0]?.[0]?.collectors ?? [])).toEqual([
      'session',
      'react',
      'memory',
      'perf',
      'visibility',
      'plugin',
      'timeline',
      'router',
    ])
  })

  it('prefers the router-context QueryClient over a provider one', async () => {
    const routerClient = { getQueryCache: () => ({}) }
    const router = { options: { context: { queryClient: routerClient } } }
    const { Genie, createGenieClient, QueryClientContext } = await loadGenie(router)

    render(
      createElement(
        QueryClientContext.Provider,
        { value: { getQueryCache: () => ({}) } },
        createElement(Genie),
      ),
    )

    const collectors = createGenieClient.mock.calls[0]?.[0]?.collectors ?? []
    const query = collectors.find((collector) => collector.__collector === 'query')
    expect((query as { query?: unknown } | undefined)?.query).toBe(routerClient)
  })

  it('does not crash for a minimal router whose options.context is undefined', async () => {
    const router = { options: {} }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { Genie, createGenieClient } = await loadGenie(router)

    expect(() => render(createElement(Genie))).not.toThrow()
    expect(names(createGenieClient.mock.calls[0]?.[0]?.collectors ?? [])).toEqual([
      'session',
      'react',
      'memory',
      'perf',
      'visibility',
      'plugin',
      'timeline',
      'router',
    ])
    expect(errorSpy).not.toHaveBeenCalled()
  })
})

describe('<Genie /> when its router context is empty but the page has a router', () => {
  type RouterWindow = { __TSR_ROUTER__?: unknown }
  afterEach(() => {
    delete (window as RouterWindow).__TSR_ROUTER__
  })

  it('wires the router TanStack published on the page, so a second router module instance still yields router tools', async () => {
    const published = {
      options: { context: {} },
      subscribe: () => () => {},
      navigate: async () => {},
    }
    ;(window as RouterWindow).__TSR_ROUTER__ = published
    const { Genie, createGenieClient } = await loadGenie(undefined)

    render(createElement(Genie))

    const collectors = createGenieClient.mock.calls[0]?.[0]?.collectors ?? []
    const router = collectors.find((collector) => collector.__collector === 'router')
    expect((router as { router?: unknown } | undefined)?.router).toBe(published)
  })

  it('ignores a published value that is not a router', async () => {
    ;(window as RouterWindow).__TSR_ROUTER__ = { navigate: 'not a function' }
    const { Genie, createGenieClient } = await loadGenie(undefined)

    render(createElement(Genie))

    expect(names(createGenieClient.mock.calls[0]?.[0]?.collectors ?? [])).not.toContain('router')
  })

  it('prefers the context router over the published one', async () => {
    const contextRouter = { options: { context: {} } }
    ;(window as RouterWindow).__TSR_ROUTER__ = {
      options: { context: {} },
      subscribe: () => () => {},
      navigate: async () => {},
    }
    const { Genie, createGenieClient } = await loadGenie(contextRouter)

    render(createElement(Genie))

    const collectors = createGenieClient.mock.calls[0]?.[0]?.collectors ?? []
    const router = collectors.find((collector) => collector.__collector === 'router')
    expect((router as { router?: unknown } | undefined)?.router).toBe(contextRouter)
  })
})

describe('<Genie /> under a bare QueryClientProvider (no router)', () => {
  it('picks the QueryClient up from the provider context', async () => {
    const queryClient = { getQueryCache: () => ({}) }
    const { Genie, createGenieClient, QueryClientContext } = await loadGenie(undefined)

    render(createElement(QueryClientContext.Provider, { value: queryClient }, createElement(Genie)))

    expect(names(createGenieClient.mock.calls[0]?.[0]?.collectors ?? [])).toEqual([
      'session',
      'react',
      'memory',
      'perf',
      'visibility',
      'plugin',
      'timeline',
      'query',
    ])
  })

  it('prefers an explicit queryClient prop over every discovered source', async () => {
    const propClient = { getQueryCache: () => ({}) }
    const router = { options: { context: { queryClient: { getQueryCache: () => ({}) } } } }
    const { Genie, createGenieClient, QueryClientContext } = await loadGenie(router)

    render(
      createElement(
        QueryClientContext.Provider,
        { value: { getQueryCache: () => ({}) } },
        createElement<GenieProps>(Genie, { queryClient: propClient as never }),
      ),
    )

    const collectors = createGenieClient.mock.calls[0]?.[0]?.collectors ?? []
    const query = collectors.find((collector) => collector.__collector === 'query')
    expect((query as { query?: unknown } | undefined)?.query).toBe(propClient)
  })

  it('ignores a provider value that is not a QueryClient', async () => {
    const { Genie, createGenieClient, QueryClientContext } = await loadGenie(undefined)

    render(
      createElement(QueryClientContext.Provider, { value: { bogus: true } }, createElement(Genie)),
    )

    expect(names(createGenieClient.mock.calls[0]?.[0]?.collectors ?? [])).toEqual([
      'session',
      'react',
      'memory',
      'perf',
      'visibility',
      'plugin',
      'timeline',
    ])
  })
})

describe('<Genie /> declared plugins', () => {
  it('forwards the plugins prop to the passthrough collector', async () => {
    const { Genie, pluginPassthroughCollector } = await loadGenie(undefined)

    render(createElement<GenieProps>(Genie, { plugins: ['cart-devtools', 'metrics-devtools'] }))

    expect(pluginPassthroughCollector).toHaveBeenCalledWith({
      plugins: ['cart-devtools', 'metrics-devtools'],
    })
  })
})

describe('<Genie /> idempotency', () => {
  it('starts the client exactly once under StrictMode double-invocation', async () => {
    const { Genie, createGenieClient } = await loadGenie(undefined)

    render(createElement(StrictMode, null, createElement(Genie)))

    expect(createGenieClient).toHaveBeenCalledTimes(1)
  })
})

describe('<Genie reduxStore />', () => {
  it('wraps the store while rendering, so a connect() sibling after it binds the recorded dispatch', async () => {
    const { Genie, createGenieClient } = await loadGenie(undefined)
    const { reduxStoreTaps } = await import('../collectors/causal/redux-store-registry')
    const store = createStore(
      combineReducers({
        count: (state: number = 0, action: { type: string }) =>
          action.type === 'counter/added' ? state + 1 : state,
      }),
    )
    const Add = connect(null, { add: () => ({ type: 'counter/added' }) })(
      ({ add }: { add: () => unknown }): ReactNode =>
        createElement('button', { type: 'button', onClick: add }, 'add'),
    )

    render(
      createElement(
        Provider,
        { store } as never,
        createElement<GenieProps>(Genie, { reduxStore: store }),
        createElement(Add),
      ),
    )
    fireEvent.click(screen.getByText('add'))

    const collectors = createGenieClient.mock.calls[0]?.[0]?.collectors as Array<{
      meta?: { id: string }
    }>
    expect(collectors.some((collector) => collector.meta?.id === 'redux')).toBe(true)
    const [tap] = reduxStoreTaps() as ReduxStoreTap[]
    expect(tap?.records().map((record) => [record.kind, record.type])).toEqual([
      ['action', 'counter/added'],
    ])
    tap?.dispose()
  })
})
