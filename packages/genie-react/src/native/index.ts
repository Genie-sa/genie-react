// React Native / Expo entry. No static @tanstack import, so it bundles under Metro whether or not TanStack is installed.
import { useEffect } from 'react'
import {
  createGenieClient,
  type GenieClient,
  type GenieCollector,
  sessionCollector,
} from '../client'
import { type DefaultCollectorOptions, defaultAppCollectors } from '../collectors/defaults'
import { reactCollector } from '../collectors/react'
import '../collectors/react/hook'
import { queryCollector, routerCollector } from '../collectors/tanstack'
import { isQueryClient, isRouter } from '../collectors/tanstack/guards'
import type { AppStateLike } from '../collectors/visibility'
import { isProductionBuild } from '../production-build'

export interface StartGenieOptions {
  /** Hub WebSocket URL (required; RN has no location to derive it from). iOS sim: ws://127.0.0.1:4390/__genie/ws, Android emulator: ws://10.0.2.2:4390/__genie/ws; the hub binds loopback, so a physical device needs a port forward. */
  url: string
  appName?: string
  plugins?: readonly string[]
  /** Pass your TanStack QueryClient to enable the query_* tools — on any later call/render too; it registers onto the running client. */
  queryClient?: unknown
  /** Pass your TanStack Router to enable the router_* tools — on any later call/render too; it registers onto the running client. */
  router?: unknown
  /** Pass React Native's `AppState` so verification can tell when the app was in the background; read at the first start only. */
  appState?: unknown
}

let client: GenieClient | null = null
let startedUrl: string | null = null
let routerWired = false
let queryWired = false
const collectorOptions: DefaultCollectorOptions = {}

// Typed `unknown` so the public surface never references @tanstack types; duck-checked here instead, with a loud skip on mismatch.
function tanstackCollectors(options: StartGenieOptions): GenieCollector[] {
  const collectors: GenieCollector[] = []
  if (options.router !== undefined && !routerWired) {
    if (isRouter(options.router)) {
      collectors.push(routerCollector(options.router))
      collectorOptions.router = options.router
      routerWired = true
    } else {
      console.warn(
        '[genie] `router` does not look like a TanStack Router (no subscribe/navigate) — router tools skipped.',
      )
    }
  }
  if (options.queryClient !== undefined && !queryWired) {
    if (isQueryClient(options.queryClient)) {
      collectors.push(queryCollector(options.queryClient))
      collectorOptions.queryClient = options.queryClient
      queryWired = true
    } else {
      console.warn(
        '[genie] `queryClient` does not look like a TanStack QueryClient (no getQueryCache) — query tools skipped.',
      )
    }
  }
  return collectors
}

/** Start Genie in a React Native / Expo app. Call once, as early as possible; later calls register newly provided TanStack instances onto the running client. */
export function startGenie(options: StartGenieOptions): GenieClient {
  // A release bundle that skipped the documented __DEV__ guard still never opens a hub connection.
  if (isProductionBuild()) {
    client ??= createGenieClient({ url: options.url, appName: options.appName, collectors: [] })
    return client
  }
  if (client) {
    if (options.url !== startedUrl) {
      console.warn(`[genie] already connected to ${startedUrl} — new url ${options.url} ignored.`)
    }
    for (const collector of tanstackCollectors(options)) client.registerCollector(collector)
    return client
  }
  collectorOptions.plugins = options.plugins
  if (isAppState(options.appState)) collectorOptions.appState = options.appState
  const collectors: GenieCollector[] = [
    sessionCollector(),
    reactCollector(),
    ...defaultAppCollectors(collectorOptions),
    ...tanstackCollectors(options),
  ]
  client = createGenieClient({ url: options.url, appName: options.appName, collectors })
  startedUrl = options.url
  client.start()
  return client
}

function isAppState(value: unknown): value is AppStateLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'addEventListener' in value &&
    typeof value.addEventListener === 'function'
  )
}

export type GenieProps = StartGenieOptions

/** Component form of startGenie for wiring near the root. Renders nothing; a queryClient/router that appears on a later render still gets its tools. */
export function Genie(props: GenieProps): null {
  const { url, appName, plugins, queryClient, router, appState } = props
  useEffect(() => {
    startGenie({ url, appName, plugins, queryClient, router, appState })
  }, [url, appName, plugins, queryClient, router, appState])
  return null
}
