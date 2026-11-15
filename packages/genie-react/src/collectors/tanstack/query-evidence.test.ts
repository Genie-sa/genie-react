// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, type RenderResult, render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CollectorContext } from '../../client'
import { queryCollector } from './query'

const context: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}

let queryClient: QueryClient
let collector: ReturnType<typeof queryCollector>
let stopCollector: (() => void) | undefined
let view: RenderResult | null = null

async function call<T>(name: string, input: unknown): Promise<T> {
  const tool = collector.tools?.find((candidate) => candidate.contract.name === name)
  if (!tool) throw new Error(`Missing tool ${name}`)
  return (await tool.handler(tool.contract.input.parse(input) as never, context)) as T
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
  collector = queryCollector(queryClient)
  stopCollector = collector.start?.(context) || undefined
})

afterEach(() => {
  view?.unmount()
  view = null
  stopCollector?.()
  queryClient.clear()
})

interface FilterCalls {
  calls: Array<{
    method: string
    byGenie: boolean
    filters: { queryKey: unknown; exact: boolean }
    matchedCount: number
    matched: Array<{ queryHash: string; isActive: boolean }>
    nearMisses: string[]
    stack: string[]
  }>
}

function CustomerName({ id }: { id: string }): ReactNode {
  const { data } = useQuery({
    queryKey: ['customers', 'detail', id],
    queryFn: () => Promise.resolve({ name: `Customer ${id}` }),
  })
  return createElement('h1', null, data?.name ?? 'loading')
}

async function mountCustomer(): Promise<void> {
  await act(async () => {
    view = render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(CustomerName, { id: 'c-0042' }),
      ),
    )
  })
  await act(async () => {
    await queryClient.getQueryCache().find({ queryKey: ['customers', 'detail', 'c-0042'] })?.promise
  })
}

describe('query_invalidations', () => {
  it('shows an invalidation that matched no query, with the cached key it missed', async () => {
    await mountCustomer()
    function saveCustomer() {
      return queryClient.invalidateQueries({ queryKey: ['customers', 'c-0042'] })
    }
    await act(async () => saveCustomer())

    const { calls } = await call<FilterCalls>('query_invalidations', {})
    expect(calls).toEqual([
      expect.objectContaining({
        method: 'invalidateQueries',
        byGenie: false,
        filters: expect.objectContaining({ queryKey: ['customers', 'c-0042'], exact: false }),
        matchedCount: 0,
        matched: [],
        nearMisses: ['["customers","detail","c-0042"]'],
      }),
    ])
    expect(calls[0]?.stack.join('\n')).toContain('saveCustomer')
  })

  it('lists the queries a matching invalidation reached, once, without the refetch it makes itself', async () => {
    await mountCustomer()
    queryClient.setQueryData(['customers', 'detail', 'c-0007'], { name: 'unobserved' })
    await act(async () => queryClient.invalidateQueries({ queryKey: ['customers', 'detail'] }))

    const { calls } = await call<FilterCalls>('query_invalidations', {})
    expect(calls.map((entry) => entry.method)).toEqual(['invalidateQueries'])
    expect(calls[0]?.matchedCount).toBe(2)
    expect(calls[0]?.matched.map((query) => [query.queryHash, query.isActive]).sort()).toEqual([
      ['["customers","detail","c-0007"]', false],
      ['["customers","detail","c-0042"]', true],
    ])
  })

  it('marks calls Genie made for the agent so they are not mistaken for the app', async () => {
    await mountCustomer()
    await call('query_invalidate', { queryKey: ['customers'] })

    const { calls } = await call<FilterCalls>('query_invalidations', {})
    expect(calls).toEqual([
      expect.objectContaining({ method: 'invalidateQueries', byGenie: true, matchedCount: 1 }),
    ])
  })
})

describe('query_notifications', () => {
  it('names the query each notification came from and filters by it', async () => {
    await mountCustomer()
    await act(async () => {
      queryClient.setQueryData(['customers', 'detail', 'c-0042'], { name: 'Renamed' })
    })

    const all = await call<{ events: Array<{ queryHash: string | null; queryKey: unknown }> }>(
      'query_notifications',
      {},
    )
    expect(all.events.length).toBeGreaterThan(0)
    expect(all.events.every((event) => event.queryHash === '["customers","detail","c-0042"]')).toBe(
      true,
    )
    expect(all.events[0]?.queryKey).toEqual(['customers', 'detail', 'c-0042'])
    const none = await call<{ events: unknown[] }>('query_notifications', {
      queryHash: '["orders"]',
    })
    expect(none.events).toEqual([])
  })
})

describe('query_get where', () => {
  const orders = Array.from({ length: 1051 }, (_, index) => ({
    id: `o-${String(index).padStart(4, '0')}`,
    status: index === 998 ? 'on-hold' : 'processing',
    customer: { id: `c-${index % 7}` },
  }))

  beforeEach(() => {
    queryClient.setQueryData(['orders', 'list'], { items: orders, total: orders.length })
  })

  it('finds one entity by id beyond the first 100 items and gives its path', async () => {
    const result = await call<{ data: unknown; selection: unknown }>('query_get', {
      queryKey: ['orders', 'list'],
      path: ['items'],
      where: { field: 'id', equals: 'o-0998' },
    })
    expect(result.data).toBeUndefined()
    expect(result.selection).toEqual({
      matchCount: 1,
      scanned: 1051,
      scanTruncated: false,
      containerFound: true,
      matches: [
        {
          path: ['items', 998],
          value: { id: 'o-0998', status: 'on-hold', customer: { id: 'c-4' } },
        },
      ],
    })
  })

  it('compares a nested field and counts every match even past the listed ones', async () => {
    const result = await call<{ selection: { matchCount: number; matches: unknown[] } }>(
      'query_get_data',
      {
        queryKey: ['orders', 'list'],
        path: ['items'],
        where: { field: ['customer', 'id'], equals: 'c-3' },
      },
    )
    expect(result.selection.matchCount).toBe(150)
    expect(result.selection.matches).toHaveLength(20)
  })

  it('reports no match, and a path with nothing to search, instead of guessing', async () => {
    const missing = await call<{ selection: unknown }>('query_get', {
      queryKey: ['orders', 'list'],
      path: ['items'],
      where: { field: 'id', equals: 998 },
    })
    expect(missing.selection).toMatchObject({ matchCount: 0, containerFound: true })
    const notAList = await call<{ selection: unknown }>('query_get', {
      queryKey: ['orders', 'list'],
      path: ['total'],
      where: { field: 'id', equals: 'o-0001' },
    })
    expect(notAList.selection).toMatchObject({ matchCount: 0, containerFound: false })
  })
})
