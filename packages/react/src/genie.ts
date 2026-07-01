import { createGenieClient, type GenieCollector, sessionCollector } from '@genie-react/client'
import { readGenieGlobal } from '@genie-react/core'
import { pluginPassthroughCollector } from '@genie-react/devtools-plugin'
import { memoryCollector } from '@genie-react/memory'
import { reactCollector } from '@genie-react/react-collector'
import { queryCollector, routerCollector } from '@genie-react/tanstack-collector'
import type { QueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

let started = false

export interface GenieProps {
  /** App name reported to the agent (defaults to the document title). */
  appName?: string
}

/**
 * `@tanstack/react-router` is an optional peer: when it is not installed the genie() Vite plugin
 * resolves it to a no-op stub, and even when installed `useRouter({ warn: false })` returns
 * `undefined` outside a `<RouterProvider>`. The hook's declared return type omits `undefined`, so
 * this is the single documented widening for that peer-stub / no-provider boundary — isolated here
 * so the component body never re-asserts the router's presence.
 */
function useOptionalRouter(): ReturnType<typeof useRouter> | undefined {
  return useRouter({ warn: false }) as ReturnType<typeof useRouter> | undefined
}

/**
 * Duck-types a TanStack `QueryClient` by its stable cache accessor, so a foreign value sitting on
 * the router context can't masquerade as one. Kept minimal (one method) so it never rejects a real
 * client across query-core minor versions.
 */
function isQueryClient(value: unknown): value is QueryClient {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getQueryCache' in value &&
    typeof value.getQueryCache === 'function'
  )
}

/** Reads a `QueryClient` off the router context when the app wired one in, otherwise `undefined`. */
function getRouterQueryClient(router: ReturnType<typeof useRouter>): QueryClient | undefined {
  const context: unknown = router.options.context
  if (typeof context !== 'object' || context === null || !('queryClient' in context)) {
    return undefined
  }
  return isQueryClient(context.queryClient) ? context.queryClient : undefined
}

/**
 * One-line Genie integration for any React + Vite app. Auto-wires the memory and DevTools
 * passthrough collectors, and — when rendered inside a TanStack Router — the Router and (when a
 * QueryClient is in the router context) Query collectors. Render it once near your root, dev-only:
 *
 * ```tsx
 * {import.meta.env.DEV && <Genie />}
 * ```
 *
 * It registers onto the Vite-plugin-injected client when one is already running, or starts its own.
 */
export function Genie({ appName }: GenieProps = {}): null {
  const router = useOptionalRouter()

  useEffect(() => {
    if (started || typeof window === 'undefined') return
    started = true

    const collectors: GenieCollector[] = [memoryCollector(), pluginPassthroughCollector()]
    if (router) {
      collectors.push(routerCollector(router))
      const queryClient = getRouterQueryClient(router)
      if (queryClient) collectors.push(queryCollector(queryClient))
    }

    const existing = readGenieGlobal()
    if (existing) {
      for (const collector of collectors) existing.register(collector)
    } else {
      createGenieClient({
        appName,
        collectors: [sessionCollector(), reactCollector(), ...collectors],
      }).start()
    }
  }, [router, appName])

  return null
}
