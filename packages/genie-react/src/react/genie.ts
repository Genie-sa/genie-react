import { type QueryClient, QueryClientContext } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useContext, useEffect } from 'react'
import type { GenieAppTool } from '../app-tools'
import { createGenieClient, sessionCollector } from '../client'
import { defaultAppCollectors } from '../collectors/defaults'
import { reactCollector } from '../collectors/react'
import { type ReduxStoreLike, reduxCollector } from '../collectors/redux/index'
import { queryCollector, routerCollector } from '../collectors/tanstack'
import { isQueryClient, isRouter } from '../collectors/tanstack/guards'
import { timelineCollector } from '../collectors/timeline'
import { readGenieGlobal } from '../protocol'
import { useGenieTools } from './use-genie-tool'

let started = false
let wiredRouter: ReturnType<typeof useRouter> | undefined
let wiredQueryClient: QueryClient | undefined
let wiredReduxStore: ReduxStoreLike | undefined

export interface GenieProps {
  /** App name reported to the agent (defaults to the document title). */
  appName?: string
  /** DevTools plugin ids to surface in plugin_list before they emit any traffic. */
  plugins?: readonly string[]
  /** Explicit QueryClient for the query tools; wins over router-context and provider discovery. */
  queryClient?: QueryClient
  /** Explicit Router for the router tools; wins over `useRouter()` context discovery. */
  router?: ReturnType<typeof useRouter>
  /** Redux or Redux Toolkit store for the redux tools. Render `<Genie />` before the components that dispatch, or call `reduxCollector(store)` where the store is created. */
  reduxStore?: ReduxStoreLike
  /** App-level custom tools (built with `defineGenieTool`) registered for the app's lifetime; route-scoped tools belong in `useGenieTool`. */
  tools?: readonly GenieAppTool[]
}

// useRouter's type omits `undefined`, but the Vite-plugin peer stub and the no-provider case return it; this is the single widening for that boundary.
function useOptionalRouter(): ReturnType<typeof useRouter> | undefined {
  return (useRouter({ warn: false }) as ReturnType<typeof useRouter> | undefined) ?? pageRouter()
}

/** The router TanStack Router publishes on every browser page. It finds the app's router when the context does not, as when a bundler loads a second @tanstack/react-router instance whose context the app's provider never filled. */
function pageRouter(): ReturnType<typeof useRouter> | undefined {
  if (typeof window === 'undefined') return undefined
  const published: unknown = (window as { __TSR_ROUTER__?: unknown }).__TSR_ROUTER__
  return isRouter(published) ? (published as ReturnType<typeof useRouter>) : undefined
}

/** Reads a `QueryClient` off the router context when the app wired one in, otherwise `undefined`. */
function getRouterQueryClient(router: ReturnType<typeof useRouter>): QueryClient | undefined {
  const context: unknown = router.options.context
  if (typeof context !== 'object' || context === null || !('queryClient' in context)) {
    return undefined
  }
  return isQueryClient(context.queryClient) ? context.queryClient : undefined
}

/** One-line Genie integration: render once near the root, dev-only; auto-wires router/query collectors (explicit props win over context discovery) and joins the Vite-injected client or starts its own. */
export function Genie(props: GenieProps = {}): null {
  const { appName, plugins, reduxStore } = props
  // connect() binds action creators to store.dispatch during its first render, before any effect runs, so the dispatch is wrapped while Genie renders.
  if (reduxStore && typeof window !== 'undefined') reduxCollector(reduxStore)
  const contextRouter = useOptionalRouter()
  // Provider fallback so `QueryClientProvider` alone (no router context) still surfaces the query tools; the Vite plugin stubs the context when react-query is absent.
  const providerQueryClient = useContext(QueryClientContext)
  useGenieTools(props.tools)

  const router = props.router ?? contextRouter
  const queryClient =
    props.queryClient ??
    (router ? getRouterQueryClient(router) : undefined) ??
    (isQueryClient(providerQueryClient) ? providerQueryClient : undefined)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (started) {
      wireLateIntegrations(router, queryClient, reduxStore)
      return
    }
    started = true
    wiredRouter = router
    wiredQueryClient = queryClient
    wiredReduxStore = reduxStore

    const collectors = defaultAppCollectors({ plugins, router, queryClient, reduxStore })

    const existing = readGenieGlobal()
    if (existing) {
      for (const collector of collectors) existing.register(collector)
    } else {
      createGenieClient({
        appName,
        collectors: [sessionCollector(), reactCollector(), ...collectors],
      }).start()
    }
  }, [router, queryClient, reduxStore, appName, plugins])

  return null
}

/** A router, QueryClient or Redux store that appears after the first mount (lazy providers, auth-gated trees) still gets its tools. */
function wireLateIntegrations(
  router: ReturnType<typeof useRouter> | undefined,
  queryClient: QueryClient | undefined,
  reduxStore: ReduxStoreLike | undefined,
): void {
  const routerChanged = router !== undefined && router !== wiredRouter
  const queryClientChanged = queryClient !== undefined && queryClient !== wiredQueryClient
  const reduxStoreChanged = reduxStore !== undefined && reduxStore !== wiredReduxStore
  if (!routerChanged && !queryClientChanged && !reduxStoreChanged) return
  const client = readGenieGlobal()
  if (!client) return
  if (reduxStoreChanged) {
    wiredReduxStore = reduxStore
    client.register(reduxCollector(reduxStore))
  }
  if (!routerChanged && !queryClientChanged) return
  if (routerChanged) {
    wiredRouter = router
    client.register(routerCollector(router))
  }
  if (queryClientChanged) {
    wiredQueryClient = queryClient
    client.register(queryCollector(queryClient))
  }
  client.register(timelineCollector({ router: wiredRouter, queryClient: wiredQueryClient }))
}
