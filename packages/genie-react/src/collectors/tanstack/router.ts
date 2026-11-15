import type { AnyRouter, NavigateOptions, ToOptions } from '@tanstack/react-router'
import { z } from 'zod'
import {
  defineCollector,
  defineCollectorTool,
  type GenieCollector,
  type ToolAvailability,
} from '../../client'
import { defineAgentToolContract, dehydrate } from '../../protocol'
import { recordRouterNotification, registerRouterStore } from '../causal/external-store-registry'

interface RouteEntry {
  id: string
  path?: string
  fullPath?: string
  rank?: number
  isRoot?: boolean
  options?: { loader?: unknown; beforeLoad?: unknown }
}

function isRouteEntry(value: unknown): value is RouteEntry {
  return (
    typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string'
  )
}

// The single runtime boundary narrowing the `any`-typed routesById internal; entries without a string id are dropped.
function asRouteEntries(routesById: unknown): RouteEntry[] {
  if (typeof routesById !== 'object' || routesById === null) return []
  const values: unknown[] = Object.values(routesById)
  return values.filter(isRouteEntry)
}

const toOptionsSchema = z.object({
  to: z.string().describe('Target path, e.g. "/posts/$postId" or "/about".'),
  params: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Path params for the target route.'),
  search: z.record(z.string(), z.unknown()).optional().describe('Search/query params.'),
  hash: z.string().optional(),
})

const pendingWorkSchema = z
  .array(z.string())
  .describe(
    'Why the router is not settled: navigation-pending, loading, transitioning, pending-matches, location-unresolved (the new location has not finished rendering), or match-fetching:<routeId> for a loader still running, including a stale-while-revalidate reload.',
  )

const settlementFields = {
  settled: z
    .boolean()
    .describe('True only when no navigation, loader, pending match or render transition remains.'),
  pendingWork: pendingWorkSchema,
}

const routerGetStateContract = defineAgentToolContract({
  name: 'router_get_state',
  title: 'Get router state',
  description:
    'Get one synchronous snapshot of TanStack Router state and the browser location. `settled` is the navigation-finished judgement; `isLoading` alone turns false before background loaders and the render transition finish. `locationSync` makes history/Router disagreement explicit instead of returning one potentially stale URL.',
  group: 'router',
  input: z.object({}),
  output: z.object({
    routerId: z.string().nullable(),
    pathname: z.string(),
    resolvedPathname: z
      .string()
      .nullable()
      .describe('The last location that finished loading and rendering, or null before the first.'),
    href: z.string(),
    searchStr: z.string().optional(),
    hash: z.string().optional(),
    status: z.string(),
    statusCode: z.number().optional(),
    isLoading: z.boolean(),
    isTransitioning: z.boolean(),
    loadedAt: z.number().optional(),
    matchCount: z.number(),
    pendingMatchCount: z.number(),
    ...settlementFields,
    browserLocation: z
      .object({
        href: z.string(),
        pathname: z.string(),
        search: z.string(),
        hash: z.string(),
      })
      .nullable(),
    locationSync: z
      .enum(['matched', 'mismatched', 'unavailable'])
      .describe(
        "Compares the browser URL with the Router location rendered through its history's createHref, so hash history compares the hash. A memory history never writes the browser URL and reads as mismatched.",
      ),
    snapshotAt: z.number().describe('Epoch milliseconds after both locations were read.'),
  }),
  annotations: { readOnlyHint: true },
})

const routerListMatchesContract = defineAgentToolContract({
  name: 'router_list_matches',
  title: 'List route matches',
  description:
    'List the active route matches: routeId, pathname, params, search, loader status, and loader data.',
  group: 'router',
  input: z.object({ depth: z.number().int().min(1).max(4).default(2) }),
  output: z.object({
    matches: z.array(
      z.object({
        routeId: z.string(),
        pathname: z.string(),
        params: z.unknown(),
        search: z.unknown(),
        status: z.string(),
        isFetching: z.union([z.boolean(), z.string()]),
        loaderData: z.unknown(),
      }),
    ),
  }),
  annotations: { readOnlyHint: true },
})

const routerListRoutesContract = defineAgentToolContract({
  name: 'router_list_routes',
  title: 'List registered routes',
  description:
    'List every route registered on the router (the route tree, from routesById): routeId, path, fullPath, rank, and whether it declares a loader / beforeLoad. Use to discover navigable paths for router_navigate / router_preload.',
  group: 'router',
  input: z.object({
    includeRoot: z.boolean().default(false).describe('Include the synthetic __root__ route.'),
  }),
  output: z.object({
    routes: z.array(
      z.object({
        routeId: z.string(),
        path: z.string().optional(),
        fullPath: z.string().optional(),
        rank: z.number().optional(),
        hasLoader: z.boolean(),
        hasBeforeLoad: z.boolean(),
      }),
    ),
    total: z.number(),
  }),
  annotations: { readOnlyHint: true },
})

const routerBuildLocationContract = defineAgentToolContract({
  name: 'router_build_location',
  title: 'Resolve a location',
  description:
    'Resolve a path into a full location (href, pathname, searchStr, hash, parsed search) WITHOUT navigating (TanStack buildLocation). Use to preview where a router_navigate would land or to read computed search params.',
  group: 'router',
  input: toOptionsSchema,
  output: z.object({
    href: z.string(),
    pathname: z.string(),
    searchStr: z.string(),
    hash: z.string(),
    search: z.unknown(),
  }),
  annotations: { readOnlyHint: true },
})

const routerMatchRouteContract = defineAgentToolContract({
  name: 'router_match_route',
  title: 'Match a route',
  description:
    'Test whether a path matches the current (or pending) location and return the extracted path params (TanStack matchRoute). Returns matched=false when it does not match.',
  group: 'router',
  input: z.object({
    to: z.string().describe('Path pattern to test, e.g. "/posts/$postId".'),
    pending: z.boolean().default(false).describe('Match against the pending location instead.'),
    fuzzy: z.boolean().default(false).describe('Allow matching a prefix of the location.'),
    includeSearch: z.boolean().default(false),
  }),
  output: z.object({ matched: z.boolean(), params: z.unknown() }),
  annotations: { readOnlyHint: true },
})

const navigationTimeout = z
  .number()
  .int()
  .min(100)
  .max(15_000)
  .default(5_000)
  .describe('How long to wait for the router to settle before reporting pending or not-started.')

const navigationResultFields = {
  pathname: z.string(),
  href: z.string(),
  statusCode: z.number().optional(),
  ...settlementFields,
}

const routerNavigateContract = defineAgentToolContract({
  name: 'router_navigate',
  title: 'Navigate',
  description:
    'Drive client-side navigation to a path and wait for the router to settle. Use an absolute path like "/about". `ok` is true only when the router settled on the requested location; `outcome` says otherwise where it ended: elsewhere (a redirect or a newer navigation), not-found, error (a route match failed), not-started (no navigation began; a blocker refused it or is waiting for confirmation), or pending (still loading at the timeout). Preview the destination first with router_build_location if unsure.',
  group: 'action',
  input: z.object({
    to: z.string(),
    replace: z.boolean().default(false),
    params: z.record(z.string(), z.unknown()).optional(),
    search: z.record(z.string(), z.unknown()).optional(),
    hash: z.string().optional(),
    timeoutMs: navigationTimeout,
  }),
  output: z.object({
    ok: z.boolean(),
    outcome: z.enum(['arrived', 'elsewhere', 'not-found', 'error', 'not-started', 'pending']),
    requestedHref: z.string(),
    ...navigationResultFields,
  }),
  annotations: { idempotentHint: false },
})

const routerPreloadContract = defineAgentToolContract({
  name: 'router_preload',
  title: 'Preload a route',
  description:
    'Warm the cache for a route by running its loader without navigating (TanStack preloadRoute). Returns the routeIds that were matched/loaded. A no-op (matched=0) if the router has preloading disabled.',
  group: 'action',
  input: toOptionsSchema,
  output: z.object({
    ok: z.boolean(),
    matched: z.number(),
    matchedRouteIds: z.array(z.string()),
  }),
  annotations: { idempotentHint: true },
})

const routerHistoryContract = defineAgentToolContract({
  name: 'router_history',
  title: 'History back/forward/go',
  description:
    'Move through the browser history stack: go back, go forward, or jump by a relative delta (TanStack router.history), then wait for the router to settle on the new entry. Use delta with action="go" (negative = back). `outcome` is moved, unchanged (no entry there, or a blocker refused it), no-entry (going back from the first app entry, which would leave the app, so it was not attempted), or pending (still loading at the timeout).',
  group: 'action',
  input: z.object({
    action: z.enum(['back', 'forward', 'go']).default('back'),
    delta: z
      .number()
      .int()
      .default(-1)
      .describe('Relative offset for action="go"; negative goes back, positive forward.'),
    timeoutMs: navigationTimeout,
  }),
  output: z.object({
    ok: z.boolean(),
    outcome: z.enum(['moved', 'unchanged', 'no-entry', 'pending']),
    ...navigationResultFields,
    canGoBack: z.boolean().nullable().describe('Null when this TanStack history cannot tell.'),
    length: z.number().nullable(),
  }),
  annotations: { idempotentHint: false },
})

const routerInvalidateContract = defineAgentToolContract({
  name: 'router_invalidate',
  title: 'Invalidate router',
  description: 'Invalidate all route matches, forcing loaders to re-run.',
  group: 'action',
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  annotations: { idempotentHint: true },
})

const routerLoadContract = defineAgentToolContract({
  name: 'router_load',
  title: 'Load current matches',
  description:
    'Run the loaders for the current matches (TanStack router.load), resolving once loading settles. Pair with router_invalidate to force a full reload.',
  group: 'action',
  input: z.object({}),
  output: z.object({ ok: z.boolean(), status: z.string() }),
  annotations: { idempotentHint: true },
})

const routerClearCacheContract = defineAgentToolContract({
  name: 'router_clear_cache',
  title: 'Clear router cache',
  description:
    'Drop cached (inactive) route matches so their loaders re-run on next visit (TanStack clearCache). Does not affect the current active matches.',
  group: 'action',
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  annotations: { destructiveHint: true },
})

export function routerCollector(router: AnyRouter): GenieCollector {
  const registeredRouter = routerStoreOf(router)
  const routerId = registeredRouter
    ? registerRouterStore(registeredRouter, () => router.state).routerId
    : null
  return defineCollector({
    meta: { id: 'router', title: 'TanStack Router', description: 'Location, matches, navigation' },
    capabilities: ['router'],
    start: (ctx) => {
      const push = () => ctx.pushSnapshot('router', { pathname: router.state.location.pathname })
      const stopStoreNotifications = registeredRouter
        ? subscribeRouterNotifications(registeredRouter)
        : null
      const off = router.subscribe('onResolved', () => {
        push()
      })
      push()
      return () => {
        try {
          off()
        } finally {
          stopStoreNotifications?.()
        }
      }
    },
    tools: [
      defineCollectorTool({
        contract: routerGetStateContract,
        handler: () => {
          const { location, status, statusCode, isLoading, isTransitioning, loadedAt, matches } =
            router.state
          const browserLocation = readBrowserLocation()
          const locationSync: LocationSync =
            browserLocation === null
              ? 'unavailable'
              : browserHref(browserLocation) === router.history.createHref(location.href)
                ? 'matched'
                : 'mismatched'
          return {
            routerId,
            pathname: location.pathname,
            resolvedPathname: router.state.resolvedLocation?.pathname ?? null,
            href: location.href,
            searchStr: location.searchStr,
            hash: location.hash,
            status,
            statusCode,
            isLoading,
            isTransitioning,
            loadedAt,
            matchCount: matches.length,
            ...settlement(router),
            browserLocation,
            locationSync,
            snapshotAt: Date.now(),
          }
        },
      }),
      defineCollectorTool({
        contract: routerListMatchesContract,
        handler: ({ depth }) => ({
          matches: router.state.matches.map((match) => ({
            routeId: String(match.routeId),
            pathname: match.pathname,
            params: dehydrate(match.params, { depth: 2 }),
            search: dehydrate(match.search, { depth: 2 }),
            status: match.status,
            isFetching: match.isFetching,
            loaderData: dehydrate(match.loaderData, { depth }),
          })),
        }),
      }),
      defineCollectorTool({
        contract: routerListRoutesContract,
        handler: ({ includeRoot }) => {
          const entries = asRouteEntries(router.routesById)
          const routes = entries
            .filter((route) => includeRoot || !(route.isRoot || route.id === '__root__'))
            .map((route) => ({
              routeId: route.id,
              path: route.path,
              fullPath: route.fullPath,
              rank: route.rank,
              hasLoader: typeof route.options?.loader === 'function',
              hasBeforeLoad: typeof route.options?.beforeLoad === 'function',
            }))
          return { routes, total: routes.length }
        },
      }),
      defineCollectorTool({
        contract: routerBuildLocationContract,
        handler: ({ to, params, search, hash }) => {
          const opts: ToOptions<AnyRouter> = { to, params, search, hash }
          const location = router.buildLocation(opts)
          return {
            href: location.href,
            pathname: location.pathname,
            searchStr: location.searchStr,
            hash: location.hash,
            search: dehydrate(location.search, { depth: 3 }),
          }
        },
      }),
      defineCollectorTool({
        contract: routerMatchRouteContract,
        handler: ({ to, pending, fuzzy, includeSearch }) => {
          const location: ToOptions<AnyRouter> = { to }
          const result = router.matchRoute(location, { pending, fuzzy, includeSearch })
          return result === false
            ? { matched: false, params: undefined }
            : { matched: true, params: dehydrate(result, { depth: 2 }) }
        },
      }),
      defineCollectorTool({
        contract: routerNavigateContract,
        handler: async ({ to, replace, params, search, hash, timeoutMs }) => {
          const deadline = Date.now() + timeoutMs
          const opts: NavigateOptions<AnyRouter> = { to, replace, params, search, hash }
          const requestedHref = router.buildLocation(opts).href
          let started = false
          const stopListening = NAVIGATION_START_EVENTS.map((eventType) =>
            router.subscribe(eventType, () => {
              started = true
            }),
          )
          let navigation: { error: unknown } | undefined
          router.navigate(opts).then(
            () => {
              navigation = { error: undefined }
            },
            (error: unknown) => {
              navigation = { error: error ?? new Error('Navigation failed.') }
            },
          )
          try {
            await waitFor(() => navigation !== undefined && settlement(router).settled, deadline)
          } finally {
            for (const stop of stopListening) stop()
          }
          if (navigation?.error !== undefined) throw navigation.error
          const result = navigationResult(router)
          const outcome: NavigationOutcome = !started
            ? 'not-started'
            : !result.settled
              ? 'pending'
              : landedOutcome(router, requestedHref)
          return { ok: outcome === 'arrived', outcome, requestedHref, ...result }
        },
      }),
      defineCollectorTool({
        contract: routerPreloadContract,
        handler: async ({ to, params, search, hash }) => {
          const opts: NavigateOptions<AnyRouter> = { to, params, search, hash }
          const matches = await router.preloadRoute(opts)
          const matchedRouteIds = (matches ?? []).map((match) => String(match.routeId))
          return { ok: true, matched: matchedRouteIds.length, matchedRouteIds }
        },
      }),
      defineCollectorTool({
        contract: routerHistoryContract,
        handler: async ({ action, delta, timeoutMs }) => {
          const deadline = Date.now() + timeoutMs
          const history: Partial<AnyRouter['history']> = router.history
          const historyPosition = (): { canGoBack: boolean | null; length: number | null } => ({
            canGoBack: typeof history.canGoBack === 'function' ? history.canGoBack() : null,
            length: typeof history.length === 'number' ? history.length : null,
          })
          const goesBack = action === 'back' || (action === 'go' && delta < 0)
          if (goesBack && historyPosition().canGoBack === false) {
            return {
              ok: false,
              outcome: 'no-entry' as const,
              ...navigationResult(router),
              ...historyPosition(),
            }
          }
          const before = router.state.location.href
          const moved = () => router.state.location.href !== before
          if (action === 'back') router.history.back()
          else if (action === 'forward') router.history.forward()
          else router.history.go(delta)
          const settled = await waitFor(() => moved() && settlement(router).settled, deadline)
          const outcome: HistoryOutcome = settled ? 'moved' : moved() ? 'pending' : 'unchanged'
          return {
            ok: outcome === 'moved',
            outcome,
            ...navigationResult(router),
            ...historyPosition(),
          }
        },
      }),
      defineCollectorTool({
        contract: routerInvalidateContract,
        handler: async () => {
          await router.invalidate()
          return { ok: true }
        },
      }),
      defineCollectorTool({
        contract: routerLoadContract,
        handler: async () => {
          await router.load()
          return { ok: true, status: router.state.status }
        },
      }),
      {
        ...defineCollectorTool({
          contract: routerClearCacheContract,
          handler: () => {
            router.clearCache()
            return { ok: true }
          },
        }),
        availability: (): ToolAvailability =>
          typeof (router as Partial<AnyRouter>).clearCache === 'function'
            ? { available: true }
            : {
                available: false,
                reason:
                  'This TanStack Router release has no clearCache(); upgrade @tanstack/react-router to clear cached matches.',
              },
      },
    ],
  })
}

function routerStoreOf(router: AnyRouter): object | null {
  const stores = (router as unknown as { stores?: { __store?: unknown } }).stores
  return typeof stores?.__store === 'object' && stores.__store !== null ? stores.__store : null
}

function subscribeRouterNotifications(store: object): (() => void) | null {
  let subscribe: unknown
  try {
    subscribe = (store as { subscribe?: unknown }).subscribe
  } catch {
    return null
  }
  if (typeof subscribe !== 'function') return null

  let active = true
  try {
    const subscription: unknown = subscribe.call(store, (snapshot: unknown) => {
      if (active && snapshot !== undefined) recordRouterNotification(store, snapshot)
    })
    return () => {
      active = false
      try {
        if (typeof subscription === 'function') subscription()
        else if (
          typeof subscription === 'object' &&
          subscription !== null &&
          typeof (subscription as { unsubscribe?: unknown }).unsubscribe === 'function'
        ) {
          const unsubscribe = (subscription as { unsubscribe: () => void }).unsubscribe
          unsubscribe.call(subscription)
        }
      } catch {
        // Disabling the callback still prevents stale evidence if store cleanup fails.
      }
    }
  } catch {
    return null
  }
}

type LocationSync = 'matched' | 'mismatched' | 'unavailable'
type NavigationOutcome = z.infer<typeof routerNavigateContract.output>['outcome']
type HistoryOutcome = z.infer<typeof routerHistoryContract.output>['outcome']

const NAVIGATION_START_EVENTS = ['onBeforeNavigate', 'onBeforeLoad'] as const
const SETTLE_POLL_MS = 16

/** Current Router keeps pending matches in a store; releases before it keep them on state. */
function pendingMatchesOf(router: AnyRouter): readonly unknown[] {
  const stored: unknown = router.stores?.pendingMatches?.get?.()
  if (Array.isArray(stored)) return stored
  const legacy: unknown = (router.state as { pendingMatches?: unknown }).pendingMatches
  return Array.isArray(legacy) ? legacy : []
}

function settlement(router: AnyRouter): {
  settled: boolean
  pendingWork: string[]
  pendingMatchCount: number
} {
  const { status, isLoading, isTransitioning, location, resolvedLocation, matches } = router.state
  const pendingMatchCount = pendingMatchesOf(router).length
  const pendingWork: string[] = []
  if (status === 'pending') pendingWork.push('navigation-pending')
  if (isLoading) pendingWork.push('loading')
  if (isTransitioning) pendingWork.push('transitioning')
  if (pendingMatchCount > 0) pendingWork.push('pending-matches')
  if (resolvedLocation && resolvedLocation.href !== location.href) {
    pendingWork.push('location-unresolved')
  }
  for (const match of matches) {
    if (match.isFetching || match.status === 'pending') {
      pendingWork.push(`match-fetching:${String(match.routeId)}`)
    }
  }
  return { settled: pendingWork.length === 0, pendingWork, pendingMatchCount }
}

function navigationResult(router: AnyRouter) {
  const { location, statusCode } = router.state
  const { settled, pendingWork } = settlement(router)
  return { pathname: location.pathname, href: location.href, statusCode, settled, pendingWork }
}

function landedOutcome(
  router: AnyRouter,
  requestedHref: string,
): Exclude<NavigationOutcome, 'not-started' | 'pending'> {
  const { matches, statusCode, location } = router.state
  if (statusCode === 404 || matches.some((match) => match.status === 'notFound')) {
    return 'not-found'
  }
  if (matches.some((match) => match.status === 'error')) return 'error'
  return comparableHref(location.href) === comparableHref(requestedHref) ? 'arrived' : 'elsewhere'
}

function comparableHref(href: string): string {
  const boundary = href.search(/[?#]/)
  const path = boundary === -1 ? href : href.slice(0, boundary)
  const rest = boundary === -1 ? '' : href.slice(boundary)
  return `${path.length > 1 ? path.replace(/\/+$/, '') : path}${rest}`
}

async function waitFor(condition: () => boolean, deadline: number): Promise<boolean> {
  while (!condition()) {
    if (Date.now() >= deadline) return false
    await new Promise((resolve) => setTimeout(resolve, SETTLE_POLL_MS))
  }
  return true
}

function readBrowserLocation(): {
  href: string
  pathname: string
  search: string
  hash: string
} | null {
  if (typeof globalThis.location === 'undefined') return null
  const { href, pathname, search, hash } = globalThis.location
  return { href, pathname, search, hash }
}

function browserHref(browser: { pathname: string; search: string; hash: string }): string {
  return `${browser.pathname}${browser.search}${browser.hash}`
}
