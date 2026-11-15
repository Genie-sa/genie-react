import {
  InfiniteQueryObserver,
  MutationObserver,
  QueryClient,
  QueryObserver,
  type QueryObserverResult,
} from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CollectorContext, GenieCollector } from '../../client'
import { resetExternalStoreRegistryForTests } from '../causal/external-store-registry'
import { queryCollector } from './query'

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

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
const cleanups: Array<() => void> = []

function client(): QueryClient {
  const created = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  cleanups.push(() => created.clear())
  return created
}

function started(queryClient: QueryClient): GenieCollector {
  const collector = queryCollector(queryClient)
  const stop = collector.start?.(ctx)
  if (typeof stop === 'function') cleanups.push(stop)
  return collector
}

function watch<T>(observer: {
  subscribe: (listener: (result: QueryObserverResult<T, Error>) => void) => () => void
}): QueryObserverResult<T, Error>[] {
  const delivered: QueryObserverResult<T, Error>[] = []
  cleanups.push(observer.subscribe((result) => delivered.push(result)))
  return delivered
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => resetExternalStoreRegistryForTests())
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup()
})

describe('custom query key hashers', () => {
  const hashFn = (key: readonly unknown[]) => `custom:${JSON.stringify(key)}`

  async function hashedQuery() {
    const queryClient = client()
    let calls = 0
    const observer = new QueryObserver<string, Error>(queryClient, {
      queryKey: ['todo', 1],
      queryKeyHashFn: hashFn,
      queryFn: async () => `server-${++calls}`,
    })
    const delivered = watch(observer)
    await settle()
    return { queryClient, observer, delivered, collector: started(queryClient) }
  }

  it('query_get_data finds the cached entry by key and by hash', async () => {
    const { collector } = await hashedQuery()
    for (const identifier of [{ queryKey: ['todo', 1] }, { queryHash: 'custom:["todo",1]' }]) {
      expect(await call(collector, 'query_get_data', identifier)).toMatchObject({
        found: true,
        status: 'success',
        data: 'server-1',
      })
    }
  })

  it('query_set_data writes the entry the UI observes instead of creating a duplicate', async () => {
    const { queryClient, observer, delivered, collector } = await hashedQuery()

    const result = await call(collector, 'query_set_data', { queryKey: ['todo', 1], data: 'agent' })

    expect(result).toEqual({ ok: true, queryHash: 'custom:["todo",1]', created: false })
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1)
    expect(observer.getCurrentResult().data).toBe('agent')
    expect(delivered.at(-1)?.data).toBe('agent')
  })

  it('query_fetch and query_ensure refresh the observed entry', async () => {
    const { queryClient, observer, collector } = await hashedQuery()

    await expect(call(collector, 'query_fetch', { queryKey: ['todo', 1] })).resolves.toMatchObject({
      data: 'server-2',
      status: 'success',
    })
    await call(collector, 'query_ensure', { queryKey: ['todo', 1], revalidateIfStale: true })
    await settle()

    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.queryHash),
    ).toEqual(['custom:["todo",1]'])
    expect(observer.getCurrentResult().data).toBe('server-3')
  })
})

describe('infinite queries', () => {
  it('query_fetch refetches every page and keeps the infinite data shape intact', async () => {
    const queryClient = client()
    const fetchedPages: number[] = []
    const observer = new InfiniteQueryObserver(queryClient, {
      queryKey: ['feed'],
      initialPageParam: 0,
      queryFn: async ({ pageParam }) => {
        fetchedPages.push(pageParam)
        return { page: pageParam }
      },
      getNextPageParam: (last: { page: number }) => last.page + 1,
    })
    cleanups.push(observer.subscribe(() => {}))
    await settle()
    await observer.fetchNextPage()
    const collector = started(queryClient)
    fetchedPages.length = 0

    const result = await call(collector, 'query_fetch', { queryKey: ['feed'] })

    expect(result).toMatchObject({
      data: { pages: [{ page: 0 }, { page: 1 }], pageParams: [0, 1] },
      status: 'success',
    })
    expect(fetchedPages).toEqual([0, 1])
    await observer.fetchNextPage()
    await queryClient.refetchQueries({ queryKey: ['feed'] })
    expect(observer.getCurrentResult().data?.pageParams).toEqual([0, 1, 2])
  })
})

describe('query_simulate_state restoration', () => {
  /** Runs the same app activity on a client Genie never touches; its cache is the truth after restore. */
  async function compareWithUntouchedApp(
    activity: (
      queryClient: QueryClient,
      server: { version: number; fail: boolean },
    ) => Promise<void>,
    simulated: 'pending' | 'error',
  ) {
    const run = async (simulate: boolean) => {
      const queryClient = client()
      const server = { version: 0, fail: false }
      const observer = new QueryObserver<string, Error>(queryClient, {
        queryKey: ['user'],
        queryFn: async () => {
          if (server.fail) throw new Error('server down')
          return `v${++server.version}`
        },
      })
      watch(observer)
      await settle()
      const collector = started(queryClient)
      if (simulate)
        await call(collector, 'query_simulate_state', { queryKey: ['user'], state: simulated })
      await activity(queryClient, server)
      const restore = simulate
        ? await call<{ outcomes: Array<{ outcome: string; refetched: boolean }> }>(
            collector,
            'query_restore_state',
            { queryKey: ['user'] },
          )
        : null
      await settle()
      await settle()
      const { status, fetchStatus, data, isInvalidated, error } = observer.getCurrentQuery().state
      return {
        restore,
        state: { status, fetchStatus, data, isInvalidated, error: error?.message ?? null },
        rendered: observer.getCurrentResult().data,
      }
    }
    const truth = await run(false)
    const genie = await run(true)
    expect(genie.state).toEqual(truth.state)
    expect(genie.rendered).toEqual(truth.rendered)
    return genie.restore?.outcomes[0]
  }

  it('returns an untouched simulation to the exact captured state', async () => {
    expect(await compareWithUntouchedApp(async () => {}, 'pending')).toEqual({
      queryHash: '["user"]',
      outcome: 'restored',
      refetched: false,
    })
  })

  it('keeps newer data from a real refetch that landed during the simulation', async () => {
    const outcome = await compareWithUntouchedApp(async (queryClient) => {
      await queryClient.refetchQueries({ queryKey: ['user'] })
    }, 'error')
    expect(outcome).toMatchObject({ outcome: 'superseded', refetched: false })
  })

  it('merges a real refetch failure without discarding the cached data', async () => {
    const outcome = await compareWithUntouchedApp(async (queryClient, server) => {
      server.fail = true
      await queryClient.refetchQueries({ queryKey: ['user'] })
    }, 'error')
    expect(outcome).toMatchObject({ outcome: 'merged' })
  })

  it('replays an app invalidation the pending simulation suppressed, or keeps the data it fetched', async () => {
    let fetchedDuringSimulation = false
    const outcome = await compareWithUntouchedApp(async (queryClient, server) => {
      const before = server.version
      await queryClient.invalidateQueries({ queryKey: ['user'] })
      fetchedDuringSimulation = server.version > before
    }, 'pending')
    // Query-core 5.101 suppresses the invalidation's fetch under a simulated pending state; 5.104 runs it.
    expect(outcome).toMatchObject(
      fetchedDuringSimulation
        ? { outcome: 'superseded', refetched: false }
        : { outcome: 'merged', refetched: true },
    )
  })

  it('keeps a real fetch that is still in flight when the simulation ends', async () => {
    const queryClient = client()
    const response = deferred<string>()
    let calls = 0
    const observer = new QueryObserver<string, Error>(queryClient, {
      queryKey: ['user'],
      queryFn: async () => (++calls === 1 ? 'v1' : response.promise),
    })
    watch(observer)
    await settle()
    const collector = started(queryClient)
    await call(collector, 'query_simulate_state', { queryKey: ['user'], state: 'error' })
    const refetch = queryClient.refetchQueries({ queryKey: ['user'] })

    const restored = await call(collector, 'query_restore_state', { queryKey: ['user'] })

    expect(restored).toMatchObject({ outcomes: [{ outcome: 'merged', refetched: false }] })
    expect(observer.getCurrentResult()).toMatchObject({
      status: 'success',
      data: 'v1',
      fetchStatus: 'fetching',
    })
    response.resolve('v2')
    await refetch
    expect(observer.getCurrentResult()).toMatchObject({ data: 'v2', fetchStatus: 'idle' })
  })

  it('re-runs a first load that the simulation cancelled', async () => {
    const queryClient = client()
    const first = deferred<string>()
    let calls = 0
    const observer = new QueryObserver<string, Error>(queryClient, {
      queryKey: ['user'],
      queryFn: async () => (++calls === 1 ? first.promise : 'loaded'),
    })
    watch(observer)
    const collector = started(queryClient)
    expect(observer.getCurrentResult().fetchStatus).toBe('fetching')

    await call(collector, 'query_simulate_state', { queryKey: ['user'], state: 'pending' })
    const restored = await call(collector, 'query_restore_state', { queryKey: ['user'] })
    await settle()

    expect(restored).toMatchObject({ outcomes: [{ outcome: 'restored', refetched: true }] })
    expect(observer.getCurrentResult()).toMatchObject({ status: 'success', data: 'loaded' })
  })

  it('captures fresh state when re-simulating a query whose simulation real data superseded', async () => {
    const queryClient = client()
    let version = 0
    const observer = new QueryObserver<string, Error>(queryClient, {
      queryKey: ['user'],
      queryFn: async () => `v${++version}`,
    })
    watch(observer)
    await settle()
    const collector = started(queryClient)
    await call(collector, 'query_simulate_state', { queryKey: ['user'], state: 'error' })
    await queryClient.refetchQueries({ queryKey: ['user'] })

    await call(collector, 'query_simulate_state', { queryKey: ['user'], state: 'pending' })
    await call(collector, 'query_restore_state', { all: true })

    expect(observer.getCurrentResult()).toMatchObject({ status: 'success', data: 'v2' })
  })
})

describe('mutations', () => {
  it('rejects re-running a pending mutation and leaves the app mutation intact', async () => {
    const queryClient = client()
    const response = deferred<number>()
    let executions = 0
    const observer = new MutationObserver(queryClient, {
      mutationFn: async (value: number) => {
        executions += 1
        return response.promise.then((factor) => value * factor)
      },
    })
    const collector = started(queryClient)
    const appMutation = observer.mutate(2)
    await settle()
    const mutationId = queryClient.getMutationCache().getAll()[0]?.mutationId

    await expect(call(collector, 'mutation_rerun', { mutationId })).rejects.toThrow(/still pending/)
    response.resolve(10)

    await expect(appMutation).resolves.toBe(20)
    expect(executions).toBe(1)
    expect(observer.getCurrentResult()).toMatchObject({ status: 'success', data: 20 })
  })

  it('distinguishes a scoped mutation queued behind another from one in flight', async () => {
    const queryClient = client()
    const response = deferred<string>()
    const ran: string[] = []
    const scoped = (name: string) =>
      new MutationObserver(queryClient, {
        scope: { id: 'cart' },
        mutationFn: async () => {
          ran.push(name)
          return response.promise
        },
      })
    const collector = started(queryClient)
    const first = scoped('first').mutate()
    const second = scoped('second').mutate()
    await settle()

    const { mutations } = await call<{
      mutations: Array<{ status: string; isPaused: boolean; scopeId: string | null }>
    }>(collector, 'query_list_mutations', {})

    expect(ran).toEqual(['first'])
    expect(mutations).toMatchObject([
      { status: 'pending', isPaused: false, scopeId: 'cart' },
      { status: 'pending', isPaused: true, scopeId: 'cart' },
    ])
    response.resolve('done')
    await Promise.all([first, second])
  })
})

describe('query identity and observers', () => {
  it('resolves object keys regardless of property order, and never by prefix', async () => {
    const queryClient = client()
    queryClient.setQueryData(['todos', { page: 1, sort: 'asc' }], ['a'])
    const collector = started(queryClient)

    await expect(
      call(collector, 'query_get', { queryKey: ['todos', { sort: 'asc', page: 1 }] }),
    ).resolves.toMatchObject({ data: ['a'] })
    await expect(call(collector, 'query_get', { queryKey: ['todos'] })).rejects.toThrow(/not found/)
    expect(
      await call(collector, 'query_get_data', { queryKey: ['todos', { page: 1 }] }),
    ).toMatchObject({ found: false })
  })

  it('reports each observer of one key with the result it delivers', async () => {
    const queryClient = client()
    const queryFn = async () => [1, 2, 3]
    const all = new QueryObserver(queryClient, { queryKey: ['rows'], queryFn })
    const count = new QueryObserver(queryClient, {
      queryKey: ['rows'],
      queryFn,
      select: (rows: number[]) => rows.length,
    })
    const placeholder = new QueryObserver(queryClient, {
      queryKey: ['rows', 'next'],
      queryFn: () => new Promise<number[]>(() => {}),
      placeholderData: [0],
    })
    for (const observer of [all, count, placeholder]) cleanups.push(observer.subscribe(() => {}))
    await settle()
    const collector = started(queryClient)

    const rows = await call<{
      observerCount: number
      observers: Array<{ currentResult: unknown }>
    }>(collector, 'query_get', { queryKey: ['rows'] })
    const next = await call<{ status: string; observers: Array<{ currentResult: unknown }> }>(
      collector,
      'query_get',
      { queryKey: ['rows', 'next'] },
    )

    expect(rows.observerCount).toBe(2)
    expect(rows.observers.map((observer) => observer.currentResult)).toEqual([
      expect.objectContaining({ data: [1, 2, 3], status: 'success' }),
      expect.objectContaining({ data: 3, status: 'success' }),
    ])
    expect(next.status).toBe('pending')
    expect(next.observers[0]?.currentResult).toMatchObject({
      data: [0],
      status: 'success',
      isPlaceholderData: true,
    })
  })
})

describe('instrumentation safety', () => {
  it('lets an unobserved query expire at gcTime while Genie is attached', async () => {
    const queryClient = client()
    const observer = new QueryObserver(queryClient, {
      queryKey: ['short-lived'],
      queryFn: async () => 'value',
      gcTime: 10,
    })
    const unsubscribe = observer.subscribe(() => {})
    await settle()
    const collector = started(queryClient)
    await call(collector, 'query_get', { queryKey: ['short-lived'] })
    await call(collector, 'query_list', {})
    unsubscribe()

    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(queryClient.getQueryCache().find({ queryKey: ['short-lived'] })).toBeUndefined()
  })

  it('reads state without fetching and detaches every listener when stopped', async () => {
    const queryClient = client()
    let fetches = 0
    const observer = new QueryObserver(queryClient, {
      queryKey: ['stale'],
      queryFn: async () => ++fetches,
      staleTime: 0,
    })
    const delivered = watch(observer)
    await settle()
    const collector = queryCollector(queryClient)
    const stop = collector.start?.(ctx)
    for (const name of ['query_list', 'query_is_fetching', 'query_list_mutations']) {
      await call(collector, name, {})
    }
    await call(collector, 'query_get', { queryKey: ['stale'] })
    await call(collector, 'query_get_data', { queryKey: ['stale'] })
    expect(fetches).toBe(1)

    if (typeof stop === 'function') stop()

    expect(queryClient.getQueryCache().hasListeners()).toBe(false)
    expect(queryClient.getMutationCache().hasListeners()).toBe(false)
    expect(Object.hasOwn(observer, 'trackProp')).toBe(false)
    const deliveredBefore = delivered.length
    queryClient.setQueryData(['stale'], 99)
    expect(delivered.slice(deliveredBefore).map((result) => result.data)).toEqual([99])
  })
})

describe('evidence a verification needs to trust an absence', () => {
  it('lists simulated queries on query_is_fetching until they are restored', async () => {
    const queryClient = client()
    queryClient.setQueryData(['user'], 'v1')
    const collector = started(queryClient)
    const fetching = () => call<{ simulatedQueries: unknown[] }>(collector, 'query_is_fetching', {})

    expect((await fetching()).simulatedQueries).toEqual([])
    await call(collector, 'query_simulate_state', { queryKey: ['user'], state: 'error' })
    expect((await fetching()).simulatedQueries).toEqual([
      { queryHash: '["user"]', simulatedState: 'error' },
    ])
    await call(collector, 'query_restore_state', { queryKey: ['user'] })
    expect((await fetching()).simulatedQueries).toEqual([])
  })

  it('counts notifications evicted from the bounded history', async () => {
    const queryClient = client()
    const observer = new QueryObserver<number, Error>(queryClient, {
      queryKey: ['counter'],
      enabled: false,
    })
    watch(observer)
    const collector = started(queryClient)
    const notifications = () =>
      call<{ evictedEvents: number; events: unknown[] }>(collector, 'query_notifications', {
        limit: 1,
      })

    queryClient.setQueryData(['counter'], 0)
    expect((await notifications()).evictedEvents).toBe(0)
    for (let value = 1; value <= 1_005; value += 1) queryClient.setQueryData(['counter'], value)
    const report = await notifications()
    expect(report.evictedEvents).toBeGreaterThan(0)
    expect(report.events).toHaveLength(1)
  })
})
