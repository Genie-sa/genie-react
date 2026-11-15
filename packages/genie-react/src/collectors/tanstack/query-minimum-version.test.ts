import type { QueryClient as CurrentQueryClient } from '@tanstack/react-query'
import { QueryClient, QueryObserver } from 'tanstack-query-core-minimum'
import { afterEach, expect, it } from 'vitest'
import type { CollectorContext, GenieCollector } from '../../client'
import { queryCollector } from './query'

const ctx: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}
const cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup()
})

async function call<T>(collector: GenieCollector, name: string, args: unknown): Promise<T> {
  const tool = collector.tools?.find((candidate) => candidate.contract.name === name)
  if (!tool) throw new Error(`tool not found: ${name}`)
  const result = await tool.handler(tool.contract.input.parse(args) as never, ctx)
  expect(tool.contract.output.safeParse(result).error?.issues).toBeUndefined()
  return result as T
}

/** TanStack Query 5.0.0 is the oldest supported release; its Query keeps observers private. */
function minimumClient(): { queryClient: QueryClient; collectorClient: CurrentQueryClient } {
  const queryClient = new QueryClient()
  cleanups.push(() => queryClient.clear())
  return { queryClient, collectorClient: queryClient as unknown as CurrentQueryClient }
}

it('starts and lists queries on TanStack Query 5.0.0', async () => {
  const { queryClient, collectorClient } = minimumClient()
  queryClient.getQueryCache().build(queryClient, { queryKey: ['never-fetched'] })
  const early = new QueryObserver(queryClient, { queryKey: ['early'], queryFn: async () => 1 })
  cleanups.push(early.subscribe(() => {}))
  await new Promise((resolve) => setTimeout(resolve, 0))
  const collector = queryCollector(collectorClient)
  const stop = collector.start?.(ctx)
  if (typeof stop === 'function') cleanups.push(stop)

  const { queries } = await call<{ queries: Array<Record<string, unknown>> }>(
    collector,
    'query_list',
    {},
  )

  expect(queries).toEqual([
    expect.objectContaining({
      queryKey: ['never-fetched'],
      hasFetched: false,
      isDisabled: true,
      observerCount: 0,
    }),
    expect.objectContaining({
      queryKey: ['early'],
      hasFetched: true,
      isDisabled: false,
      observerCount: 1,
    }),
  ])
})

it('lists observers it saw attach and counts the ones it could not see', async () => {
  const { queryClient, collectorClient } = minimumClient()
  const queryFn = async () => [1, 2]
  const early = new QueryObserver(queryClient, { queryKey: ['rows'], queryFn })
  cleanups.push(early.subscribe(() => {}))
  await new Promise((resolve) => setTimeout(resolve, 0))
  const collector = queryCollector(collectorClient)
  const stop = collector.start?.(ctx)
  if (typeof stop === 'function') cleanups.push(stop)
  const late = new QueryObserver(queryClient, {
    queryKey: ['rows'],
    queryFn,
    select: (rows: number[]) => rows.length,
  })
  cleanups.push(late.subscribe(() => {}))

  const query = await call<{
    observerCount: number
    observersOmitted: number
    hasQueryFn: boolean
    observers: Array<{ hasSelect: boolean }>
  }>(collector, 'query_get', { queryKey: ['rows'] })

  expect(query).toMatchObject({ observerCount: 2, observersOmitted: 1, hasQueryFn: true })
  expect(query.observers.map((observer) => observer.hasSelect)).toEqual([true])
})
