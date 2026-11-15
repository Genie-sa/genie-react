import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { defineAgentToolContract, dehydrate } from '../../protocol'
import { isDataDescriptor, safeOwnPropertyDescriptor } from '../causal/safe-object'

type CachedQuery = ReturnType<ReturnType<QueryClient['getQueryCache']>['getAll']>[number]

const FILTER_METHODS = [
  'invalidateQueries',
  'refetchQueries',
  'resetQueries',
  'removeQueries',
] as const
type FilterMethod = (typeof FILTER_METHODS)[number]

const CALL_LIMIT = 50
const MATCHED_LIMIT = 20
const NEAR_MISS_LIMIT = 5
const STACK_FRAME_LIMIT = 6

interface FilterCall {
  sequence: number
  method: FilterMethod
  timestamp: number
  byGenie: boolean
  filters: {
    queryKey: unknown
    exact: boolean
    type: string | null
    refetchType: string | null
    predicate: boolean
  }
  matchedCount: number
  matched: Array<{ queryHash: string; queryKey: unknown; isActive: boolean; observerCount: number }>
  nearMisses: string[]
  stack: string[]
}

const matchedSchema = z.object({
  queryHash: z.string(),
  queryKey: z.unknown(),
  isActive: z
    .boolean()
    .describe(
      'Has an enabled observer; invalidateQueries refetches only active matches by default.',
    ),
  observerCount: z.number().int().nonnegative(),
})

export const queryFilterCallsContract = defineAgentToolContract({
  name: 'query_invalidations',
  title: 'Invalidations and other filter calls',
  description:
    "List the app's recent invalidateQueries, refetchQueries, resetQueries and removeQueries calls, newest first, with the filter each passed and the queries it matched at that moment, including none. Matching uses TanStack Query's own findAll with the same filter, so matchedCount 0 is exact: the call reached no cached query. nearMisses lists cached keys that share the filter's first key segment. Answers \"I invalidated but the list did not refresh\": compare the filter with the keys the list reads.",
  group: 'query',
  input: z.object({
    method: z.enum(FILTER_METHODS).optional(),
    limit: z.number().int().min(1).max(CALL_LIMIT).default(20),
  }),
  output: z.object({
    calls: z.array(
      z.object({
        sequence: z.number().int().positive(),
        method: z.enum(FILTER_METHODS),
        timestamp: z.number(),
        byGenie: z
          .boolean()
          .describe('Made by a Genie tool such as query_invalidate, not the app.'),
        filters: z.object({
          queryKey: z.unknown(),
          exact: z.boolean(),
          type: z.string().nullable(),
          refetchType: z.string().nullable(),
          predicate: z.boolean().describe('A predicate function took part in matching.'),
        }),
        matchedCount: z.number().int().nonnegative(),
        matched: z.array(matchedSchema).describe(`First ${MATCHED_LIMIT} matched queries.`),
        nearMisses: z.array(z.string()),
        stack: z
          .array(z.string())
          .describe('Call stack frames outside node_modules, not source-mapped, top first.'),
      }),
    ),
    omittedByLimit: z.number().int().nonnegative(),
    coverage: z.object({
      methods: z.array(z.enum(FILTER_METHODS)).describe('Methods Genie observes on this client.'),
      since: z.number().describe('When observation started; earlier calls are not recorded.'),
    }),
  }),
  annotations: { readOnlyHint: true },
})

function ownValue(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined
  const descriptor = safeOwnPropertyDescriptor(value, key)
  return isDataDescriptor(descriptor) ? descriptor.value : undefined
}

function ownString(value: unknown, key: string): string | null {
  const read = ownValue(value, key)
  return typeof read === 'string' ? read : null
}

function callerFrames(): string[] {
  const stack = new Error('genie-react:filter-call').stack ?? ''
  return stack
    .split('\n')
    .slice(3)
    .map((line) => line.trim())
    .filter((line) => line && !line.includes('/node_modules/'))
    .slice(0, STACK_FRAME_LIMIT)
}

function nearMisses(queries: CachedQuery[], queryKey: unknown): string[] {
  const head = Array.isArray(queryKey) ? queryKey[0] : undefined
  if (head === undefined) return []
  const prefix = JSON.stringify([head]).slice(0, -1)
  return queries
    .map((query) => query.queryHash)
    .filter((hash) => hash.startsWith(prefix))
    .slice(0, NEAR_MISS_LIMIT)
}

/** Records the app's filter calls on one QueryClient until the returned function runs, and lets Genie's own tools mark the calls they make. Only the outermost call is recorded: invalidateQueries and resetQueries call refetchQueries themselves. */
export function observeFilterCalls(queryClient: QueryClient): {
  list: (input: {
    method?: FilterMethod
    limit: number
  }) => z.infer<typeof queryFilterCallsContract.output>
  asGenie: <T>(run: () => T) => T
  dispose: () => void
} {
  const calls: FilterCall[] = []
  const since = Date.now()
  const observed: FilterMethod[] = []
  const restores: Array<() => void> = []
  let sequence = 0
  let genieDepth = 0
  let callDepth = 0

  const record = (method: FilterMethod, filters: unknown) => {
    const cache = queryClient.getQueryCache()
    const all = cache.getAll()
    const matches = cache.findAll((filters ?? {}) as Parameters<typeof cache.findAll>[0])
    const queryKey = ownValue(filters, 'queryKey')
    sequence += 1
    calls.push({
      sequence,
      method,
      timestamp: Date.now(),
      byGenie: genieDepth > 0,
      filters: {
        queryKey: dehydrate(queryKey, { depth: 3 }),
        exact: ownValue(filters, 'exact') === true,
        type: ownString(filters, 'type'),
        refetchType: ownString(filters, 'refetchType'),
        predicate: typeof ownValue(filters, 'predicate') === 'function',
      },
      matchedCount: matches.length,
      matched: matches.slice(0, MATCHED_LIMIT).map((query) => ({
        queryHash: query.queryHash,
        queryKey: dehydrate(query.queryKey, { depth: 3 }),
        isActive: query.isActive(),
        observerCount: query.getObserversCount(),
      })),
      nearMisses: matches.length === 0 ? nearMisses(all, queryKey) : [],
      stack: genieDepth > 0 ? [] : callerFrames(),
    })
    if (calls.length > CALL_LIMIT) calls.shift()
  }

  for (const method of FILTER_METHODS) {
    const original: unknown = (queryClient as unknown as Record<string, unknown>)[method]
    if (typeof original !== 'function') continue
    const ownDescriptor = safeOwnPropertyDescriptor(queryClient, method)
    const wrapper = function (this: unknown, ...args: unknown[]): unknown {
      if (callDepth === 0) {
        try {
          record(method, args[0])
        } catch {
          // Evidence is best effort; the app's call must go through regardless.
        }
      }
      callDepth += 1
      try {
        return Reflect.apply(original, this, args)
      } finally {
        callDepth -= 1
      }
    }
    try {
      Object.defineProperty(queryClient, method, {
        configurable: true,
        writable: true,
        enumerable: false,
        value: wrapper,
      })
    } catch {
      continue
    }
    observed.push(method)
    restores.push(() => {
      if ((queryClient as unknown as Record<string, unknown>)[method] !== wrapper) return
      if (ownDescriptor) Object.defineProperty(queryClient, method, ownDescriptor)
      else Reflect.deleteProperty(queryClient, method)
    })
  }

  return {
    list: ({ method, limit }) => {
      const matching = calls.filter((call) => method === undefined || call.method === method)
      return {
        calls: matching.slice(-limit).reverse(),
        omittedByLimit: Math.max(0, matching.length - limit),
        coverage: { methods: [...observed], since },
      }
    },
    asGenie: (run) => {
      genieDepth += 1
      try {
        return run()
      } finally {
        genieDepth -= 1
      }
    },
    dispose: () => {
      for (const restore of restores.splice(0)) restore()
    },
  }
}
