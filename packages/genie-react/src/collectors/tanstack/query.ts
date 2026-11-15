import type { QueryClient, QueryFunction } from '@tanstack/react-query'
import { z } from 'zod'
import { defineCollector, defineCollectorTool, type GenieCollector } from '../../client'
import { defineAgentToolContract, dehydrate, readOwnPath } from '../../protocol'
import {
  instrumentQueryObserver,
  listQueryNotifications,
  registerQueryObserver,
} from '../causal/external-store-registry'
import { currentlyRenderingFiber, noteRenderStartedQuery } from '../causal/render-started-queries'
import { isDataDescriptor, safeOwnPropertyDescriptor } from '../causal/safe-object'
import { observeFilterCalls, queryFilterCallsContract } from './query-filter-calls'
import {
  QUERY_OBSERVER_LIMIT,
  queryObserverSummarySchema,
  summarizeQueryObserver,
} from './query-observers'

type CachedQuery = ReturnType<ReturnType<QueryClient['getQueryCache']>['getAll']>[number]
type CachedMutation = ReturnType<ReturnType<QueryClient['getMutationCache']>['getAll']>[number]
type CachedObserver = CachedQuery['observers'][number]

/** Query exposes `observers` publicly only from 5.4x; earlier releases keep them private. */
function publicObservers(query: CachedQuery): readonly CachedObserver[] | undefined {
  const observers: unknown = (query as { observers?: unknown }).observers
  return Array.isArray(observers) ? observers : undefined
}

/** `Query.isFetched()` is a late 5.x addition; this is its definition. */
function hasFetched(query: CachedQuery): boolean {
  return query.state.dataUpdateCount + query.state.errorUpdateCount > 0
}

function formatError(error: unknown): string | undefined {
  if (error == null) return undefined
  return error instanceof Error ? error.message : String(error)
}

type QueryCacheRef = ReturnType<QueryClient['getQueryCache']>

type QueryIdentifier = { queryHash?: string; queryKey?: unknown[] }

// Every query_list row carries both a queryHash and a queryKey, so single-entry tools accept either identifier.
const queryIdentifierFields = {
  queryHash: z.string().optional().describe('Exact queryHash from query_list.'),
  queryKey: z
    .array(z.unknown())
    .optional()
    .describe(
      'Exact query key, e.g. ["todos", 1]. Either identifier works; both come from query_list.',
    ),
}

const requireQueryIdentifier = 'Provide either queryHash or queryKey (both come from query_list).'

const hasQueryIdentifier = (value: QueryIdentifier): boolean =>
  value.queryHash !== undefined || value.queryKey !== undefined

function findQueryByIdentifier(cache: QueryCacheRef, id: QueryIdentifier): CachedQuery | undefined {
  if (id.queryHash !== undefined) return cache.get(id.queryHash)
  if (id.queryKey !== undefined) return cache.find({ queryKey: id.queryKey, exact: true })
  return undefined
}

function describeQueryIdentifier(id: QueryIdentifier): string {
  if (id.queryHash !== undefined) return `queryHash "${id.queryHash}"`
  return `queryKey ${JSON.stringify(id.queryKey)}`
}

const querySummarySchema = z.object({
  queryHash: z.string(),
  queryKey: z.unknown(),
  status: z.string(),
  fetchStatus: z.string(),
  isStale: z.boolean(),
  isActive: z.boolean(),
  isDisabled: z
    .boolean()
    .describe('True when every observer is disabled, or an unobserved query never fetched.'),
  hasFetched: z.boolean().describe('True after at least one data or error result settled.'),
  isCached: z.literal(true).describe('The query is currently retained in the Query cache.'),
  observerCount: z.number(),
  dataUpdatedAt: z.number(),
  recentFetches: z.number().describe('Fetches recorded for this query in the last 10s.'),
  simulatedState: z.enum(['pending', 'error']).optional(),
  error: z.string().optional(),
})

const churnSchema = z.object({
  orphaned: z
    .number()
    .describe('Cached queries with zero observers. This lifecycle count is not churn evidence.'),
  families: z.array(
    z.object({
      keyPrefix: z.string(),
      count: z.number(),
      orphaned: z.number(),
      additions: z.number(),
      removals: z.number(),
      unobservedFetches: z.number(),
      reasons: z.array(z.enum(['cache-turnover', 'unobserved-fetching'])),
    }),
  ),
})

const keyFilterSchema = z.object({
  queryKey: z
    .array(z.unknown())
    .optional()
    .describe('Query key prefix to match, e.g. ["todos"]. Omit to target all queries.'),
  exact: z.boolean().default(false).describe('Match the queryKey exactly instead of as a prefix.'),
})

const filterOutput = z.object({ ok: z.boolean(), matched: z.number() })

const MATCHED_QUERY_LIMIT = 20

const refreshOutput = filterOutput.extend({
  queries: z
    .array(
      z.object({
        queryHash: z.string(),
        queryKey: z.unknown(),
        status: z.enum(['pending', 'error', 'success']),
        fetchStatus: z.enum(['fetching', 'paused', 'idle']),
        error: z.string().optional(),
      }),
    )
    .describe(
      `Matched queries with their state after the call settles, first ${MATCHED_QUERY_LIMIT}.`,
    ),
  hint: z
    .string()
    .optional()
    .describe('Present when nothing matched; lists some cached query keys to retry with.'),
})

const queryListContract = defineAgentToolContract({
  name: 'query_list',
  title: 'List TanStack queries',
  description:
    'List all TanStack Query cache entries with explicit disabled, fetched, cached, and observer lifecycle state. `churn.families` contains only measured repeated cache turnover or unobserved fetching within the last 10 seconds; `churn.orphaned` is a neutral zero-observer count. Use a queryHash with query_get for the full state, or a queryKey with query_get_data for a light read.',
  group: 'query',
  input: z.object({
    staleOnly: z.boolean().default(false),
    limit: z.number().int().min(1).max(500).default(100),
  }),
  output: z.object({
    queries: z.array(querySummarySchema),
    total: z.number(),
    churn: churnSchema,
  }),
  annotations: { readOnlyHint: true },
})

const queryNotificationsContract = defineAgentToolContract({
  name: 'query_notifications',
  title: 'Query observer notifications',
  description:
    'List bounded QueryObserver delivery events with tracked fields, changed result fields, structural-sharing evidence, fanout, and exact notification/render IDs. A render cause is exact only when it joins one of these notification IDs.',
  group: 'query',
  input: z.object({
    observerId: z.string().optional(),
    queryHash: z.string().optional().describe('Only notifications from observers of this query.'),
    limit: z.number().int().min(1).max(500).default(100),
  }),
  output: z.object({
    events: z.array(
      z.object({
        notificationId: z.string(),
        observerId: z.string(),
        queryHash: z
          .string()
          .nullable()
          .describe('The query the observer was attached to when it notified.'),
        queryKey: z.unknown(),
        observationId: z.string().nullable(),
        timestamp: z.number(),
        trackedFields: z.array(z.string()),
        trackedFieldsCoverage: z.enum(['exact', 'unavailable']),
        changedResultFields: z.array(z.string()),
        deliveryReason: z
          .string()
          .describe(
            'observer-notified or tracked-field-changed:<field> for an exact tracked field.',
          ),
        fanout: z.number().int().nonnegative(),
        structuralSharing: z.object({
          reusedFields: z.array(z.string()),
          changedFields: z.array(z.string()),
          truncated: z.boolean(),
        }),
        renderEventIds: z.array(z.string()),
      }),
    ),
    omittedByLimit: z.number().int().nonnegative(),
  }),
  annotations: { readOnlyHint: true },
})

const queryTimeSchema = z
  .union([z.number(), z.enum(['Infinity', 'static', 'dynamic'])])
  .describe(
    'Milliseconds; "Infinity" never expires, "dynamic" is computed per query by a function.',
  )

type QueryTime = z.infer<typeof queryTimeSchema>

function queryTime(value: unknown): QueryTime | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 'Infinity'
  if (value === 'static') return 'static'
  return typeof value === 'function' ? 'dynamic' : undefined
}

const SELECTION_MATCH_LIMIT = 20
const SELECTION_SCAN_LIMIT = 100_000

const pathSegmentsSchema = z.array(z.union([z.string(), z.number()]))

const whereSchema = z
  .object({
    field: z
      .union([z.string(), pathSegmentsSchema.min(1)])
      .describe(
        'Field of each entry to compare, such as "id", or a path such as ["customer","id"].',
      ),
    equals: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  })
  .optional()
  .describe(
    'Select entries of the array, Map or object at `path` (or of the data) whose field equals this value, instead of reading them by index. Matches come back under `selection`, each with its full path for a follow-up read.',
  )

const selectionSchema = z
  .object({
    matchCount: z.number().int().nonnegative(),
    scanned: z.number().int().nonnegative(),
    scanTruncated: z
      .boolean()
      .describe(`More than ${SELECTION_SCAN_LIMIT} entries; later ones were not compared.`),
    containerFound: z.boolean().describe('false: nothing iterable at `path`.'),
    matches: z
      .array(z.object({ path: pathSegmentsSchema, value: z.unknown() }))
      .describe(`First ${SELECTION_MATCH_LIMIT} matches, depth-bounded.`),
  })
  .optional()

type Where = z.infer<typeof whereSchema>
type Selection = z.infer<typeof selectionSchema>

function entriesOf(container: unknown): Array<[string | number, unknown]> | null {
  if (Array.isArray(container)) return container.map((value, index) => [index, value])
  if (container instanceof Map)
    return [...container.entries()].map(([key, value]) => [String(key), value])
  if (typeof container !== 'object' || container === null) return null
  return Object.keys(container).map((key) => [key, readOwnPath(container, [key]).value])
}

/** Finds entries by a field value without running app getters: an order by id in a list of thousands. */
function selectEntries(
  data: unknown,
  path: Array<string | number> | undefined,
  where: NonNullable<Where>,
  depth: number,
): Selection {
  const base = path ?? []
  const container = readOwnPath(data, base)
  const entries = container.found ? entriesOf(container.value) : null
  if (!entries)
    return { matchCount: 0, scanned: 0, scanTruncated: false, containerFound: false, matches: [] }
  const field = typeof where.field === 'string' ? [where.field] : where.field
  const scanned = entries.slice(0, SELECTION_SCAN_LIMIT)
  const matches = scanned.filter(([, entry]) => {
    const read = readOwnPath(entry, field)
    return read.found && Object.is(read.value, where.equals)
  })
  return {
    matchCount: matches.length,
    scanned: scanned.length,
    scanTruncated: entries.length > scanned.length,
    containerFound: true,
    matches: matches.slice(0, SELECTION_MATCH_LIMIT).map(([key, entry]) => ({
      path: [...base, key],
      value: dehydrate(entry, { depth }),
    })),
  }
}

const queryGetContract = defineAgentToolContract({
  name: 'query_get',
  title: 'Get a TanStack query',
  description:
    'Get the full state and depth-bounded data of one query by its queryHash or queryKey (from query_list). Lists show their first 100 items; to read one entity, pass `where` (for example {"field":"id","equals":"o-1042"}) with the array\'s `path`. Each observer says whether its component subscriber was seen after the latest react_clear_renders, so old evidence cannot look current. hasQueryFn tells you whether query_fetch / query_ensure can re-run it. fetchCount (total settled fetches) and recentFetches (fetches in the last 10s) together reveal a refetch storm (staleTime:0 / refetchInterval) in a single call.',
  group: 'query',
  input: z
    .object({
      ...queryIdentifierFields,
      path: z
        .array(z.union([z.string(), z.number()]))
        .optional()
        .describe('Drill into the data at this path before depth-bounding, e.g. ["items", 0].'),
      depth: z.number().int().min(1).max(6).default(3),
      where: whereSchema,
    })
    .refine((value) => hasQueryIdentifier(value), requireQueryIdentifier),
  output: z.object({
    queryHash: z.string(),
    queryKey: z.unknown(),
    status: z.string(),
    fetchStatus: z.string(),
    isStale: z.boolean(),
    isActive: z.boolean(),
    isInvalidated: z.boolean(),
    observerCount: z.number(),
    observersOmitted: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Observers counted in observerCount but not listed: past the listing limit or, on TanStack Query releases that keep observers private, attached before Genie started.',
      ),
    hasQueryFn: z.boolean(),
    gcTime: queryTimeSchema.optional(),
    staleTime: queryTimeSchema
      .optional()
      .describe("The first observer's staleTime; observers can disagree."),
    dataUpdatedAt: z.number(),
    errorUpdatedAt: z.number(),
    dataUpdateCount: z.number(),
    errorUpdateCount: z.number(),
    fetchFailureCount: z.number(),
    fetchCount: z.number().describe('Total settled fetches (dataUpdateCount + errorUpdateCount).'),
    recentFetches: z.number().describe('Fetches recorded for this query in the last 10s.'),
    simulatedState: z
      .enum(['pending', 'error'])
      .optional()
      .describe('Present when query_simulate_state currently controls this cache entry.'),
    fetchMeta: z.unknown(),
    error: z.string().optional(),
    data: z.unknown(),
    selection: selectionSchema,
    observers: z.array(queryObserverSummarySchema),
  }),
  annotations: { readOnlyHint: true },
})

const queryGetDataContract = defineAgentToolContract({
  name: 'query_get_data',
  title: 'Read query data by key',
  description:
    'Light, imperative read of one query by its queryKey or queryHash (TanStack getQueryData/getQueryState). Returns found=false when nothing is cached under that key. Prefer query_get when you need the full state.',
  group: 'query',
  input: z
    .object({
      ...queryIdentifierFields,
      path: z.array(z.union([z.string(), z.number()])).optional(),
      depth: z.number().int().min(1).max(6).default(3),
      where: whereSchema,
    })
    .refine((value) => hasQueryIdentifier(value), requireQueryIdentifier),
  output: z.object({
    found: z.boolean(),
    status: z.string().optional(),
    dataUpdatedAt: z.number().optional(),
    data: z.unknown(),
    selection: selectionSchema,
  }),
  annotations: { readOnlyHint: true },
})

const queryIsFetchingContract = defineAgentToolContract({
  name: 'query_is_fetching',
  title: 'Count in-flight queries/mutations',
  description:
    'Count queries currently fetching and mutations currently pending (TanStack isFetching/isMutating). Use to check whether the app is busy before reading or acting; optionally scope the fetching count to a queryKey.',
  group: 'query',
  input: z.object({
    queryKey: z
      .array(z.unknown())
      .optional()
      .describe('Limit the fetching count to queries matching this key prefix.'),
  }),
  output: z.object({ fetching: z.number(), mutating: z.number() }),
  annotations: { readOnlyHint: true },
})

const queryListMutationsContract = defineAgentToolContract({
  name: 'query_list_mutations',
  title: 'List TanStack mutations',
  description:
    'List the TanStack Query mutation cache entries with status and variables. A pending mutation with isPaused=true is queued (offline, or behind another mutation in the same scope) and its mutationFn has not run yet. Use a mutationId with mutation_get for full state or mutation_rerun to re-execute one.',
  group: 'query',
  input: z.object({}),
  output: z.object({
    mutations: z.array(
      z.object({
        mutationId: z.number(),
        status: z.string(),
        isPaused: z.boolean(),
        scopeId: z
          .string()
          .nullable()
          .describe('Mutations sharing a scope id run one at a time, in submission order.'),
        variables: z.unknown(),
        error: z.string().optional(),
        submittedAt: z.number().optional(),
      }),
    ),
  }),
  annotations: { readOnlyHint: true },
})

const mutationGetContract = defineAgentToolContract({
  name: 'mutation_get',
  title: 'Get a TanStack mutation',
  description:
    'Get the full state of one mutation by its mutationId (from query_list_mutations). hasMutationFn tells you whether mutation_rerun can re-execute it.',
  group: 'query',
  input: z.object({
    mutationId: z.number().int(),
    depth: z.number().int().min(1).max(6).default(3),
  }),
  output: z.object({
    mutationId: z.number(),
    status: z.string(),
    mutationKey: z.unknown(),
    variables: z.unknown(),
    data: z.unknown(),
    isPaused: z.boolean(),
    failureCount: z.number(),
    failureReason: z.string().optional(),
    submittedAt: z.number(),
    gcTime: queryTimeSchema.optional(),
    hasMutationFn: z.boolean(),
    error: z.string().optional(),
  }),
  annotations: { readOnlyHint: true },
})

const queryInvalidateContract = defineAgentToolContract({
  name: 'query_invalidate',
  title: 'Invalidate queries',
  description: 'Invalidate matching queries — marks them stale and refetches the active ones.',
  group: 'action',
  input: keyFilterSchema,
  output: refreshOutput,
  annotations: { idempotentHint: true },
})

const queryRefetchContract = defineAgentToolContract({
  name: 'query_refetch',
  title: 'Refetch queries',
  description:
    'Refetch matching queries immediately. Operates on existing cache entries; use query_fetch when you also want the resolved data returned.',
  group: 'action',
  input: keyFilterSchema,
  output: refreshOutput,
  annotations: { idempotentHint: true },
})

const queryCancelContract = defineAgentToolContract({
  name: 'query_cancel',
  title: 'Cancel queries',
  description:
    'Cancel in-flight fetches for matching queries (TanStack cancelQueries). The previous data/state is preserved.',
  group: 'action',
  input: keyFilterSchema,
  output: filterOutput,
  annotations: { idempotentHint: true },
})

const queryResetContract = defineAgentToolContract({
  name: 'query_reset',
  title: 'Reset queries',
  description: 'Reset matching queries to their initial state.',
  group: 'action',
  input: keyFilterSchema,
  output: filterOutput,
  annotations: { idempotentHint: true },
})

const queryRemoveContract = defineAgentToolContract({
  name: 'query_remove',
  title: 'Remove queries',
  description: 'Remove matching queries from the cache entirely.',
  group: 'action',
  input: keyFilterSchema,
  output: filterOutput,
  annotations: { destructiveHint: true },
})

const queryClearContract = defineAgentToolContract({
  name: 'query_clear',
  title: 'Clear all caches',
  description:
    'Clear the entire query cache AND mutation cache (TanStack queryClient.clear()). Destructive — removes every entry, not just matches. Use query_remove to target specific keys.',
  group: 'action',
  input: z.object({}),
  output: z.object({
    ok: z.boolean(),
    queriesCleared: z.number(),
    mutationsCleared: z.number(),
  }),
  annotations: { destructiveHint: true },
})

const querySetDataContract = defineAgentToolContract({
  name: 'query_set_data',
  title: 'Set query data',
  description:
    'Imperatively set the cached data for a query key (optimistic-style write). Writes the existing cache entry that matches the key exactly, including one with a custom queryKeyHashFn; otherwise creates an entry.',
  group: 'action',
  input: z.object({ queryKey: z.array(z.unknown()), data: z.unknown() }),
  output: z.object({
    ok: z.boolean(),
    queryHash: z.string().nullable().describe('The cache entry written, or null when nothing was.'),
    created: z.boolean().describe('True when no cache entry matched and a new one was created.'),
  }),
  annotations: { destructiveHint: true },
})

const querySimulateStateContract = defineAgentToolContract({
  name: 'query_simulate_state',
  title: 'Simulate query pending or error state',
  description:
    'Hold one existing query in a synthetic pending/loading or error state so its mounted UI can be inspected without changing app code or the server. Cancels a real in-flight fetch first, captures the stable state once, and notifies normal TanStack observers. While pending is simulated, TanStack treats the query as fetching and skips new fetches. Real Query activity can supersede the visible simulation; query_restore_state reports how it reconciled that activity. Always restore when finished.',
  group: 'action',
  input: z
    .object({
      ...queryIdentifierFields,
      state: z.enum(['pending', 'error']),
      errorMessage: z
        .string()
        .min(1)
        .default('Simulated query error')
        .describe('Error message used when state=error; ignored for pending.'),
    })
    .refine((value) => hasQueryIdentifier(value), requireQueryIdentifier),
  output: z.object({
    ok: z.boolean(),
    queryHash: z.string(),
    simulatedState: z.enum(['pending', 'error']),
    originalStatus: z.string(),
  }),
  annotations: { destructiveHint: true },
})

const queryRestoreStateContract = defineAgentToolContract({
  name: 'query_restore_state',
  title: 'Restore simulated query state',
  description:
    'End query_simulate_state. Untouched simulations get back the exact captured state. If real data arrived meanwhile, it is kept (superseded); a real error, invalidation or in-flight fetch is merged into the captured data (merged). A fetch the simulation cancelled or suppressed is re-run for active queries (refetched). Target one query by queryHash/queryKey, or pass all=true to clean up every query simulation.',
  group: 'action',
  input: z
    .object({
      ...queryIdentifierFields,
      all: z.boolean().default(false),
    })
    .refine(
      (value) => (value.all ? !hasQueryIdentifier(value) : hasQueryIdentifier(value)),
      'Provide exactly one query identifier, or all=true without an identifier.',
    ),
  output: z.object({
    ok: z.boolean(),
    restored: z
      .number()
      .int()
      .nonnegative()
      .describe('Simulations ended on a query that is still cached.'),
    outcomes: z.array(
      z.object({
        queryHash: z.string(),
        outcome: z.enum(['restored', 'merged', 'superseded', 'removed']),
        refetched: z.boolean(),
      }),
    ),
  }),
  annotations: { idempotentHint: true },
})

const queryFetchContract = defineAgentToolContract({
  name: 'query_fetch',
  title: 'Fetch a query and return data',
  description:
    'Fetch a query by key and return the resolved data (TanStack fetchQuery). Only works for queries that already have a queryFn — i.e. one with a mounted observer (a live useQuery) or a registered query default; otherwise it errors. staleTime defaults to 0 to force a network fetch. Use query_ensure to avoid refetching fresh data.',
  group: 'action',
  input: z.object({
    queryKey: z.array(z.unknown()).describe('Exact query key, e.g. ["todos"].'),
    staleTime: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe('Treat cached data younger than this many ms as fresh and skip the fetch.'),
    depth: z.number().int().min(1).max(6).default(3),
  }),
  output: z.object({
    data: z.unknown(),
    status: z.string(),
    dataUpdatedAt: z.number(),
  }),
  annotations: { idempotentHint: true },
})

const queryEnsureContract = defineAgentToolContract({
  name: 'query_ensure',
  title: 'Ensure query data',
  description:
    "Return a query's cached data, fetching it only if absent (TanStack ensureQueryData). Errors only when there is no cached data AND no queryFn (no mounted observer / registered default) to produce it. Use query_fetch to always hit the network.",
  group: 'action',
  input: z.object({
    queryKey: z.array(z.unknown()).describe('Exact query key, e.g. ["todos"].'),
    revalidateIfStale: z
      .boolean()
      .default(false)
      .describe('Kick off a background refetch when the cached data is stale.'),
    depth: z.number().int().min(1).max(6).default(3),
  }),
  output: z.object({
    data: z.unknown(),
    status: z.string(),
    dataUpdatedAt: z.number(),
  }),
  annotations: { idempotentHint: true },
})

const mutationRerunContract = defineAgentToolContract({
  name: 'mutation_rerun',
  title: 'Re-run a mutation',
  description:
    "Re-execute a settled mutation by its mutationId (from query_list_mutations), running its mutationFn and onSuccess/onError side effects again and updating any bound UI. Re-uses the mutation's own last variables unless you supply new ones. Requires the mutation to still hold its mutationFn (hasMutationFn on mutation_get). A pending mutation is rejected: re-executing it would run it twice and strand the app's own mutate promise.",
  group: 'action',
  input: z.object({
    mutationId: z.number().int(),
    variables: z
      .unknown()
      .optional()
      .describe('Override the variables passed to the mutationFn; omit to reuse the last ones.'),
  }),
  output: z.object({
    ok: z.boolean(),
    mutationId: z.number(),
    status: z.string(),
    data: z.unknown(),
    error: z.string().optional(),
  }),
  annotations: { idempotentHint: false },
})

const FETCH_RING_CAP = 50
const FETCH_RETENTION_MS = 60_000
const RECENT_FETCH_WINDOW_MS = 10_000
const CHURN_WINDOW_MS = 10_000
const CACHE_TURNOVER_ADDITION_THRESHOLD = 3
const CACHE_TURNOVER_REMOVAL_THRESHOLD = 2
const UNOBSERVED_FETCH_THRESHOLD = 3
const FAMILY_ACTIVITY_CAP = 500

interface FetchActivity {
  timestamps: number[]
  lastFetchStatus: string
  lastDataUpdateCount: number
  awaitingSettle: boolean
}

interface FamilyActivity {
  additions: number[]
  removals: number[]
  unobservedFetches: number[]
  lastSeenAt: number
}

type FamilyActivityKind = 'additions' | 'removals' | 'unobservedFetches'

type SimulatedState = 'pending' | 'error'
type QueryState = CachedQuery['state']
type RestoreOutcome = 'restored' | 'merged' | 'superseded' | 'removed'

/** Real Query actions dispatched while a simulation held the cache entry. */
interface SimulationActivity {
  fetching: boolean
  errored: boolean
  invalidated: boolean
}

interface QuerySimulation {
  query: CachedQuery
  originalState: QueryState
  appliedState: QueryState
  simulatedState: SimulatedState
  cancelledFetch: boolean
  activity: SimulationActivity
}

function recordSimulationActivity(activity: SimulationActivity, actionType: string): void {
  if (actionType === 'fetch') activity.fetching = true
  if (actionType === 'success' || actionType === 'error') activity.fetching = false
  if (actionType === 'error') activity.errored = true
  if (actionType === 'invalidate') activity.invalidated = true
}

/** The state the query would hold had the simulation never run, keeping the real activity it overlapped. */
function stateAfterSimulation(simulation: QuerySimulation): {
  outcome: Exclude<RestoreOutcome, 'removed'>
  state: Partial<QueryState> | null
} {
  const { originalState: original, appliedState: applied, activity, query } = simulation
  const current = query.state
  if (current === applied) return { outcome: 'restored', state: { ...original } }
  const fetch = activity.fetching ? current : original
  const fetchFields = { fetchStatus: fetch.fetchStatus, fetchMeta: fetch.fetchMeta }
  if (current.dataUpdateCount > original.dataUpdateCount) {
    const fetchStatusIsSimulated =
      !activity.fetching && current.fetchStatus !== original.fetchStatus
    return { outcome: 'superseded', state: fetchStatusIsSimulated ? fetchFields : null }
  }
  return {
    outcome: 'merged',
    state: {
      ...original,
      ...fetchFields,
      isInvalidated: original.isInvalidated || current.isInvalidated,
      ...(activity.errored
        ? {
            status: 'error' as const,
            error: current.error,
            errorUpdatedAt: current.errorUpdatedAt,
            errorUpdateCount: current.errorUpdateCount,
            fetchFailureCount: current.fetchFailureCount,
            fetchFailureReason: current.fetchFailureReason,
          }
        : {}),
    },
  }
}

function isSuspenseQuery(query: CachedQuery): boolean {
  const descriptor = safeOwnPropertyDescriptor(query.options, 'suspense')
  return isDataDescriptor(descriptor) && descriptor.value === true
}

/** useSuspenseQuery throws a promise derived from the query's fetch, with nothing linking the two; the render that threw it is the one that started the fetch, so that fiber ties the query to the boundary that suspended. */
function noteSuspendingFetch(query: CachedQuery, isCached: (query: CachedQuery) => boolean): void {
  if (!isSuspenseQuery(query)) return
  const fiber = currentlyRenderingFiber()
  if (!fiber) return
  const held = new WeakRef(query)
  noteRenderStartedQuery(
    fiber,
    () => {
      const live = held.deref()
      return live && live.state.fetchStatus === 'fetching' && isCached(live)
        ? { queryHash: live.queryHash, queryKey: dehydrate(live.queryKey, { depth: 3 }) }
        : null
    },
    performance.now(),
  )
}

function mutationScopeId(mutation: CachedMutation): string | null {
  const id: unknown = mutation.options.scope?.id
  return typeof id === 'string' ? id : null
}

/** Drops a normalized family key for a queryKey: JSON of the key minus its last element. */
function familyKey(queryKey: unknown): string {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return JSON.stringify(queryKey)
  if (queryKey.length === 1) return JSON.stringify(queryKey[0])
  return JSON.stringify(queryKey.slice(0, -1))
}

export function queryCollector(queryClient: QueryClient): GenieCollector {
  const queryCache = () => queryClient.getQueryCache()
  const mutationCache = () => queryClient.getMutationCache()

  const fetchActivity = new Map<string, FetchActivity>()
  const familyActivity = new Map<string, FamilyActivity>()
  const querySimulations = new Map<string, QuerySimulation>()
  let filterCalls: ReturnType<typeof observeFilterCalls> | null = null
  const asGenie = <T>(run: () => T): T => (filterCalls ? filterCalls.asGenie(run) : run())

  const recordFamilyActivity = (
    query: CachedQuery,
    kind: FamilyActivityKind,
    timestamp = Date.now(),
  ): void => {
    const key = familyKey(query.queryKey)
    const activity = familyActivity.get(key) ?? {
      additions: [],
      removals: [],
      unobservedFetches: [],
      lastSeenAt: timestamp,
    }
    const cutoff = timestamp - CHURN_WINDOW_MS
    for (const timestamps of [activity.additions, activity.removals, activity.unobservedFetches]) {
      while (timestamps[0] !== undefined && timestamps[0] < cutoff) timestamps.shift()
    }
    activity[kind].push(timestamp)
    activity.lastSeenAt = timestamp
    familyActivity.set(key, activity)
    if (familyActivity.size > FAMILY_ACTIVITY_CAP) {
      let oldest: [string, FamilyActivity] | undefined
      for (const entry of familyActivity) {
        if (!oldest || entry[1].lastSeenAt < oldest[1].lastSeenAt) oldest = entry
      }
      if (oldest) familyActivity.delete(oldest[0])
    }
  }

  const simulationFor = (query: CachedQuery): QuerySimulation | undefined => {
    const simulation = querySimulations.get(query.queryHash)
    return simulation?.query === query ? simulation : undefined
  }

  const endSimulation = (
    simulation: QuerySimulation,
  ): { queryHash: string; outcome: RestoreOutcome; refetched: boolean } => {
    const { query, originalState, activity, cancelledFetch } = simulation
    querySimulations.delete(query.queryHash)
    if (queryCache().get(query.queryHash) !== query) {
      return { queryHash: query.queryHash, outcome: 'removed', refetched: false }
    }
    const { outcome, state } = stateAfterSimulation(simulation)
    if (state) query.setState(state)
    const suppressedInvalidation = activity.invalidated && !originalState.isInvalidated
    const refetched =
      outcome !== 'superseded' &&
      !activity.fetching &&
      (cancelledFetch || suppressedInvalidation) &&
      query.isActive()
    if (refetched) {
      void asGenie(() =>
        queryClient.refetchQueries({ queryKey: query.queryKey, exact: true, type: 'active' }),
      )
    }
    return { queryHash: query.queryHash, outcome, refetched }
  }

  const endAllSimulations = () => [...querySimulations.values()].map(endSimulation)

  const restoreResult = (outcomes: ReturnType<typeof endSimulation>[]) => ({
    ok: true,
    restored: outcomes.filter((result) => result.outcome !== 'removed').length,
    outcomes,
  })

  const observedObservers = new WeakMap<CachedQuery, Set<CachedObserver>>()

  const observersOf = (query: CachedQuery): readonly CachedObserver[] =>
    publicObservers(query) ?? [...(observedObservers.get(query) ?? [])]

  const recordFetchActivity = (query: CachedQuery): void => {
    const now = Date.now()
    let entry = fetchActivity.get(query.queryHash)
    if (!entry) {
      entry = {
        timestamps: [],
        lastFetchStatus: query.state.fetchStatus,
        lastDataUpdateCount: query.state.dataUpdateCount,
        awaitingSettle: false,
      }
      fetchActivity.set(query.queryHash, entry)
    }
    const startedFetching =
      query.state.fetchStatus === 'fetching' && entry.lastFetchStatus !== 'fetching'
    const dataAdvanced = query.state.dataUpdateCount > entry.lastDataUpdateCount
    // Count a fetch once: prefer the start transition; a data bump only counts when the start was never observed.
    let fetched = false
    if (startedFetching) {
      fetched = true
      entry.awaitingSettle = true
    } else if (dataAdvanced && !entry.awaitingSettle) {
      fetched = true
    }
    if (dataAdvanced) entry.awaitingSettle = false
    if (fetched) {
      const cutoff = now - FETCH_RETENTION_MS
      entry.timestamps = entry.timestamps.filter((t) => t >= cutoff)
      entry.timestamps.push(now)
      if (entry.timestamps.length > FETCH_RING_CAP) {
        entry.timestamps.splice(0, entry.timestamps.length - FETCH_RING_CAP)
      }
    }
    if (startedFetching && query.getObserversCount() === 0) {
      recordFamilyActivity(query, 'unobservedFetches', now)
    }
    entry.lastFetchStatus = query.state.fetchStatus
    entry.lastDataUpdateCount = query.state.dataUpdateCount
  }

  const recentFetches = (queryHash: string): number => {
    const entry = fetchActivity.get(queryHash)
    if (!entry) return 0
    const cutoff = Date.now() - RECENT_FETCH_WINDOW_MS
    return entry.timestamps.reduce((count, t) => (t >= cutoff ? count + 1 : count), 0)
  }

  const computeChurn = (queries: CachedQuery[]) => {
    let orphaned = 0
    const families = new Map<string, { count: number; orphaned: number }>()
    for (const query of queries) {
      const isOrphan = query.getObserversCount() === 0
      if (isOrphan) orphaned += 1
      const key = familyKey(query.queryKey)
      const family = families.get(key) ?? { count: 0, orphaned: 0 }
      family.count += 1
      if (isOrphan) family.orphaned += 1
      families.set(key, family)
    }
    const now = Date.now()
    const cutoff = now - CHURN_WINDOW_MS
    const flagged = [...new Set([...families.keys(), ...familyActivity.keys()])]
      .map((keyPrefix) => {
        const family = families.get(keyPrefix) ?? { count: 0, orphaned: 0 }
        const activity = familyActivity.get(keyPrefix) ?? {
          additions: [],
          removals: [],
          unobservedFetches: [],
          lastSeenAt: 0,
        }
        const additions = activity.additions.filter((timestamp) => timestamp >= cutoff).length
        const removals = activity.removals.filter((timestamp) => timestamp >= cutoff).length
        const unobservedFetches = activity.unobservedFetches.filter(
          (timestamp) => timestamp >= cutoff,
        ).length
        const reasons: Array<'cache-turnover' | 'unobserved-fetching'> = []
        if (
          additions >= CACHE_TURNOVER_ADDITION_THRESHOLD &&
          removals >= CACHE_TURNOVER_REMOVAL_THRESHOLD
        ) {
          reasons.push('cache-turnover')
        }
        if (unobservedFetches >= UNOBSERVED_FETCH_THRESHOLD) {
          reasons.push('unobserved-fetching')
        }
        return {
          keyPrefix,
          count: family.count,
          orphaned: family.orphaned,
          additions,
          removals,
          unobservedFetches,
          reasons,
        }
      })
      .filter((family) => family.reasons.length > 0)
      .sort((a, b) => b.removals + b.unobservedFetches - (a.removals + a.unobservedFetches))
      .slice(0, 10)
    return { orphaned, families: flagged }
  }

  const summarize = (query: CachedQuery) => ({
    queryHash: query.queryHash,
    queryKey: dehydrate(query.queryKey, { depth: 3 }),
    status: query.state.status,
    fetchStatus: query.state.fetchStatus,
    isStale: query.isStale(),
    isActive: query.isActive(),
    isDisabled: query.isDisabled() || (query.getObserversCount() === 0 && !hasFetched(query)),
    hasFetched: hasFetched(query),
    isCached: true as const,
    observerCount: query.getObserversCount(),
    dataUpdatedAt: query.state.dataUpdatedAt,
    recentFetches: recentFetches(query.queryHash),
    simulatedState: simulationFor(query)?.simulatedState,
    error: formatError(query.state.error),
  })

  const summarizeMutation = (mutation: CachedMutation) => ({
    mutationId: mutation.mutationId,
    status: mutation.state.status,
    isPaused: mutation.state.isPaused,
    scopeId: mutationScopeId(mutation),
    variables: dehydrate(mutation.state.variables, { depth: 2 }),
    error: formatError(mutation.state.error),
    submittedAt: mutation.state.submittedAt,
  })

  const countMatched = (queryKey: unknown[] | undefined, exact: boolean) =>
    queryCache().findAll({ queryKey, exact }).length

  const refreshResult = (queryKey: unknown[] | undefined, exact: boolean) => {
    const matches = queryCache().findAll({ queryKey, exact })
    const queries = matches.slice(0, MATCHED_QUERY_LIMIT).map((query) => ({
      queryHash: query.queryHash,
      queryKey: dehydrate(query.queryKey, { depth: 3 }),
      status: query.state.status,
      fetchStatus: query.state.fetchStatus,
      error: formatError(query.state.error),
    }))
    if (matches.length > 0) return { ok: true, matched: matches.length, queries }
    const knownKeys = queryCache()
      .getAll()
      .slice(0, 5)
      .map((query) => query.queryHash)
    return {
      ok: true,
      matched: 0,
      queries,
      hint:
        knownKeys.length > 0
          ? `No query matched ${JSON.stringify(queryKey ?? [])}${exact ? ' exactly' : ' as a prefix'}. Cached keys include ${knownKeys.join(', ')}.`
          : 'The query cache is empty.',
    }
  }

  const findMutation = (mutationId: number): CachedMutation | undefined =>
    mutationCache()
      .getAll()
      .find((mutation) => mutation.mutationId === mutationId)

  const resolveQueryFn = (queryKey: readonly unknown[]): QueryFunction | undefined => {
    const query = queryCache().find({ queryKey, exact: true })
    if (typeof query?.options.queryFn === 'function') return query.options.queryFn
    const observed = (query ? observersOf(query) : []).find(
      (observer) => typeof observer.options.queryFn === 'function',
    )
    // The typeof check above proves a QueryFunction; the cast just drops the observer's own generic type.
    if (observed) return observed.options.queryFn as QueryFunction
    const fallback = queryClient.getQueryDefaults(queryKey).queryFn
    return typeof fallback === 'function' ? fallback : undefined
  }

  const listedObservers = (query: CachedQuery) => {
    const observers = observersOf(query).slice(0, QUERY_OBSERVER_LIMIT)
    return {
      observersOmitted: Math.max(0, query.getObserversCount() - observers.length),
      observers: observers.map((observer) => summarizeQueryObserver(observer)),
    }
  }

  /** Fetch through the cached entry's own options so its hasher and infinite behavior stay intact. */
  const cachedQueryOptions = (queryKey: unknown[]) => {
    const query = queryCache().find({ queryKey, exact: true })
    return query ? { ...query.options, queryKey: query.queryKey } : { queryKey }
  }

  const settledState = (queryKey: unknown[]) => {
    const state = queryCache().find({ queryKey, exact: true })?.state
    return { status: state?.status ?? 'success', dataUpdatedAt: state?.dataUpdatedAt ?? 0 }
  }

  const observerStaleTime = (query: CachedQuery): QueryTime | undefined => {
    for (const observer of observersOf(query)) {
      const staleTime = queryTime(observer.options.staleTime)
      if (staleTime !== undefined) return staleTime
    }
    return undefined
  }

  return defineCollector({
    meta: { id: 'query', title: 'TanStack Query', description: 'Query + mutation cache' },
    capabilities: ['query'],
    start: (ctx) => {
      const observerCleanups = new Map<object, () => void>()
      const observe = (query: CachedQuery, observer: CachedObserver): void => {
        const known = observedObservers.get(query) ?? new Set()
        known.add(observer)
        observedObservers.set(query, known)
        registerQueryObserver(observer)
        if (!observerCleanups.has(observer)) {
          observerCleanups.set(observer, instrumentQueryObserver(observer))
        }
      }
      for (const query of queryCache().getAll()) {
        for (const observer of publicObservers(query) ?? []) observe(query, observer)
      }
      let scheduled = false
      const push = () => {
        if (scheduled) return
        scheduled = true
        queueMicrotask(() => {
          scheduled = false
          ctx.pushSnapshot('query', { queries: queryCache().getAll().length })
        })
      }
      const offQuery = queryCache().subscribe((event) => {
        if (event.type === 'observerAdded' || event.type === 'observerOptionsUpdated') {
          observe(event.query, event.observer)
        }
        if (event.type === 'observerRemoved') {
          observedObservers.get(event.query)?.delete(event.observer)
          observerCleanups.get(event.observer)?.()
          observerCleanups.delete(event.observer)
        }
        if (event.type === 'updated') {
          const simulation = simulationFor(event.query)
          if (simulation) recordSimulationActivity(simulation.activity, event.action.type)
          if (event.action.type === 'fetch') {
            noteSuspendingFetch(event.query, (query) => queryCache().get(query.queryHash) === query)
          }
        }
        if (event.type === 'added') {
          recordFamilyActivity(event.query, 'additions')
        }
        if (event.type === 'removed') {
          recordFamilyActivity(event.query, 'removals')
          fetchActivity.delete(event.query.queryHash)
          if (simulationFor(event.query)) querySimulations.delete(event.query.queryHash)
        } else if (!simulationFor(event.query)) {
          recordFetchActivity(event.query)
        }
        push()
      })
      const offMutation = mutationCache().subscribe(push)
      filterCalls = observeFilterCalls(queryClient)
      push()
      return () => {
        offQuery()
        offMutation()
        filterCalls?.dispose()
        filterCalls = null
        for (const cleanup of observerCleanups.values()) cleanup()
        observerCleanups.clear()
        endAllSimulations()
      }
    },
    tools: [
      defineCollectorTool({
        contract: queryNotificationsContract,
        handler: ({ observerId, queryHash, limit }) =>
          listQueryNotifications({ observerId, queryHash, limit }),
      }),
      defineCollectorTool({
        contract: queryFilterCallsContract,
        handler: ({ method, limit }) =>
          filterCalls?.list({ method, limit }) ?? {
            calls: [],
            omittedByLimit: 0,
            coverage: { methods: [], since: Date.now() },
          },
      }),
      defineCollectorTool({
        contract: queryListContract,
        handler: ({ staleOnly, limit }) => {
          const everyQuery = queryCache().getAll()
          const all = everyQuery.filter((query) => !staleOnly || query.isStale())
          return {
            queries: all.slice(0, limit).map(summarize),
            total: all.length,
            churn: computeChurn(everyQuery),
          }
        },
      }),
      defineCollectorTool({
        contract: queryGetContract,
        handler: ({ queryHash, queryKey, path, depth, where }) => {
          const query = findQueryByIdentifier(queryCache(), { queryHash, queryKey })
          if (!query) {
            throw new Error(
              `Query not found for ${describeQueryIdentifier({ queryHash, queryKey })}.`,
            )
          }
          return {
            queryHash: query.queryHash,
            queryKey: dehydrate(query.queryKey, { depth: 3 }),
            status: query.state.status,
            fetchStatus: query.state.fetchStatus,
            isStale: query.isStale(),
            isActive: query.isActive(),
            isInvalidated: query.state.isInvalidated,
            observerCount: query.getObserversCount(),
            hasQueryFn: resolveQueryFn(query.queryKey) !== undefined,
            gcTime: queryTime(query.gcTime),
            staleTime: observerStaleTime(query),
            dataUpdatedAt: query.state.dataUpdatedAt,
            errorUpdatedAt: query.state.errorUpdatedAt,
            dataUpdateCount: query.state.dataUpdateCount,
            errorUpdateCount: query.state.errorUpdateCount,
            fetchFailureCount: query.state.fetchFailureCount,
            fetchCount: query.state.dataUpdateCount + query.state.errorUpdateCount,
            recentFetches: recentFetches(query.queryHash),
            simulatedState: simulationFor(query)?.simulatedState,
            fetchMeta: dehydrate(query.state.fetchMeta, { depth: 2 }),
            error: formatError(query.state.error),
            data: where ? undefined : dehydrate(query.state.data, { depth, path }),
            selection: where ? selectEntries(query.state.data, path, where, depth) : undefined,
            ...listedObservers(query),
          }
        },
      }),
      defineCollectorTool({
        contract: queryGetDataContract,
        handler: ({ queryHash, queryKey, path, depth, where }) => {
          const query = findQueryByIdentifier(
            queryCache(),
            queryKey === undefined ? { queryHash } : { queryKey },
          )
          if (!query) {
            return { found: false, status: undefined, dataUpdatedAt: undefined, data: undefined }
          }
          return {
            found: true,
            status: query.state.status,
            dataUpdatedAt: query.state.dataUpdatedAt,
            data: where ? undefined : dehydrate(query.state.data, { depth, path }),
            selection: where ? selectEntries(query.state.data, path, where, depth) : undefined,
          }
        },
      }),
      defineCollectorTool({
        contract: queryIsFetchingContract,
        handler: ({ queryKey }) => ({
          fetching: queryClient.isFetching(queryKey ? { queryKey } : undefined),
          mutating: queryClient.isMutating(),
        }),
      }),
      defineCollectorTool({
        contract: queryListMutationsContract,
        handler: () => ({ mutations: mutationCache().getAll().map(summarizeMutation) }),
      }),
      defineCollectorTool({
        contract: mutationGetContract,
        handler: ({ mutationId, depth }) => {
          const mutation = findMutation(mutationId)
          if (!mutation) throw new Error(`Mutation ${mutationId} not found.`)
          const { state } = mutation
          return {
            mutationId: mutation.mutationId,
            status: state.status,
            mutationKey: dehydrate(mutation.options.mutationKey, { depth: 2 }),
            variables: dehydrate(state.variables, { depth }),
            data: dehydrate(state.data, { depth }),
            isPaused: state.isPaused,
            failureCount: state.failureCount,
            failureReason: formatError(state.failureReason),
            submittedAt: state.submittedAt,
            gcTime: queryTime(mutation.gcTime),
            hasMutationFn: typeof mutation.options.mutationFn === 'function',
            error: formatError(state.error),
          }
        },
      }),
      defineCollectorTool({
        contract: queryInvalidateContract,
        handler: async ({ queryKey, exact }) => {
          await asGenie(() => queryClient.invalidateQueries({ queryKey, exact }))
          return refreshResult(queryKey, exact)
        },
      }),
      defineCollectorTool({
        contract: queryRefetchContract,
        handler: async ({ queryKey, exact }) => {
          await asGenie(() => queryClient.refetchQueries({ queryKey, exact }))
          return refreshResult(queryKey, exact)
        },
      }),
      defineCollectorTool({
        contract: queryCancelContract,
        handler: async ({ queryKey, exact }) => {
          const matched = countMatched(queryKey, exact)
          await queryClient.cancelQueries({ queryKey, exact })
          return { ok: true, matched }
        },
      }),
      defineCollectorTool({
        contract: queryResetContract,
        handler: async ({ queryKey, exact }) => {
          const matched = countMatched(queryKey, exact)
          await asGenie(() => queryClient.resetQueries({ queryKey, exact }))
          return { ok: true, matched }
        },
      }),
      defineCollectorTool({
        contract: queryRemoveContract,
        handler: ({ queryKey, exact }) => {
          for (const query of queryCache().findAll({ queryKey, exact })) {
            querySimulations.delete(query.queryHash)
          }
          const matched = countMatched(queryKey, exact)
          asGenie(() => queryClient.removeQueries({ queryKey, exact }))
          return { ok: true, matched }
        },
      }),
      defineCollectorTool({
        contract: queryClearContract,
        handler: () => {
          const queriesCleared = queryCache().getAll().length
          const mutationsCleared = mutationCache().getAll().length
          querySimulations.clear()
          queryClient.clear()
          return { ok: true, queriesCleared, mutationsCleared }
        },
      }),
      defineCollectorTool({
        contract: querySetDataContract,
        handler: ({ queryKey, data }) => {
          const existing = queryCache().find({ queryKey, exact: true })
          if (existing) {
            existing.setData(data, { manual: true })
            return { ok: true, queryHash: existing.queryHash, created: false }
          }
          queryClient.setQueryData(queryKey, () => data)
          const created = queryCache().find({ queryKey, exact: true })
          return { ok: created !== undefined, queryHash: created?.queryHash ?? null, created: true }
        },
      }),
      defineCollectorTool({
        contract: querySimulateStateContract,
        handler: async ({ queryHash, queryKey, state, errorMessage }) => {
          const target = { queryHash, queryKey }
          let query = findQueryByIdentifier(queryCache(), target)
          if (!query) throw new Error(`Query not found for ${describeQueryIdentifier(target)}.`)

          let existing = simulationFor(query)
          if (existing && query.state !== existing.appliedState) {
            endSimulation(existing)
            existing = undefined
          }
          const cancelledFetch = existing
            ? existing.cancelledFetch
            : query.state.fetchStatus === 'fetching'
          await queryClient.cancelQueries({ queryKey: query.queryKey, exact: true })
          query = findQueryByIdentifier(queryCache(), target)
          if (!query) throw new Error('Query was removed while its in-flight fetch was cancelled.')

          const originalState = existing?.originalState ?? { ...query.state }
          if (state === 'pending') {
            query.setState({
              data: undefined,
              error: null,
              fetchFailureReason: null,
              fetchMeta: null,
              fetchStatus: 'fetching',
              status: 'pending',
            })
          } else {
            const error = new Error(errorMessage)
            query.setState({
              data: undefined,
              error,
              errorUpdatedAt: Date.now(),
              fetchFailureReason: error,
              fetchMeta: null,
              fetchStatus: 'idle',
              status: 'error',
            })
          }
          querySimulations.set(query.queryHash, {
            query,
            originalState,
            appliedState: query.state,
            simulatedState: state,
            cancelledFetch,
            activity: { fetching: false, errored: false, invalidated: false },
          })

          return {
            ok: true,
            queryHash: query.queryHash,
            simulatedState: state,
            originalStatus: originalState.status,
          }
        },
      }),
      defineCollectorTool({
        contract: queryRestoreStateContract,
        handler: ({ queryHash, queryKey, all }) => {
          if (all) return restoreResult(endAllSimulations())

          const query = findQueryByIdentifier(queryCache(), { queryHash, queryKey })
          const simulation = query && simulationFor(query)
          if (!simulation) {
            throw new Error(
              `No simulated state exists for ${describeQueryIdentifier({ queryHash, queryKey })}.`,
            )
          }
          return restoreResult([endSimulation(simulation)])
        },
      }),
      defineCollectorTool({
        contract: queryFetchContract,
        handler: async ({ queryKey, staleTime, depth }) => {
          const queryFn = resolveQueryFn(queryKey)
          if (!queryFn) {
            throw new Error(
              `No queryFn available for ${JSON.stringify(queryKey)}. query_fetch needs a mounted observer (a live useQuery) with a cache entry, or a registered query default — after query_remove the observer re-attaches only on its next render, so interact with the UI first. Use query_refetch or query_invalidate to refresh existing cache entries instead.`,
            )
          }
          const data = await queryClient.fetchQuery({
            ...cachedQueryOptions(queryKey),
            queryFn,
            staleTime,
          })
          return { data: dehydrate(data, { depth }), ...settledState(queryKey) }
        },
      }),
      defineCollectorTool({
        contract: queryEnsureContract,
        handler: async ({ queryKey, revalidateIfStale, depth }) => {
          const queryFn = resolveQueryFn(queryKey)
          const hasData = queryCache().find({ queryKey, exact: true })?.state.data !== undefined
          if (!hasData && !queryFn) {
            throw new Error(
              `Query ${JSON.stringify(queryKey)} has no cached data and no queryFn (no mounted observer or registered default) to fetch it.`,
            )
          }
          const data = await queryClient.ensureQueryData({
            ...cachedQueryOptions(queryKey),
            queryFn,
            revalidateIfStale,
          })
          return { data: dehydrate(data, { depth }), ...settledState(queryKey) }
        },
      }),
      defineCollectorTool({
        contract: mutationRerunContract,
        handler: async ({ mutationId, variables }) => {
          const mutation = findMutation(mutationId)
          if (!mutation) throw new Error(`Mutation ${mutationId} not found.`)
          if (mutation.state.status === 'pending') {
            throw new Error(
              `Mutation ${mutationId} is still pending${mutation.state.isPaused ? ' (queued)' : ''}. Wait for it to settle (query_is_fetching reports mutating=0) before re-running it.`,
            )
          }
          if (typeof mutation.options.mutationFn !== 'function') {
            throw new Error(
              `Mutation ${mutationId} has no mutationFn registered (likely dehydrated/restored without its function); it cannot be re-run.`,
            )
          }
          const nextVariables = variables === undefined ? mutation.state.variables : variables
          try {
            const data = await mutation.execute(nextVariables)
            return {
              ok: true,
              mutationId,
              status: mutation.state.status,
              data: dehydrate(data, { depth: 3 }),
            }
          } catch (error) {
            return {
              ok: false,
              mutationId,
              status: mutation.state.status,
              data: undefined,
              error: formatError(error),
            }
          }
        },
      }),
    ],
  })
}
