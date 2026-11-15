// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { notifyManager, QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, type RenderResult, render } from '@testing-library/react'
import { createElement, type ReactNode, startTransition, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectorContext } from '../../client'
import { resetExternalStoreRegistryForTests } from '../causal/external-store-registry'
import {
  clearRenders,
  disposeRenderTracking,
  getRenderCauseEventsReport,
  startRenderTracking,
} from '../react/render-tracker'
import { queryCollector } from './query'

vi.mock('bippy/source', () => ({
  getSource: async () => null,
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
}))

const ctx: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}

interface QueryCause {
  kind: string
  evidence: string
  observerId?: string
  queryHash?: string
  notificationId?: string | null
}

interface Notification {
  notificationId: string
  observerId: string
  renderEventIds: string[]
}

let view: RenderResult | null = null
let stopCollector: (() => void) | undefined
let queryClient: QueryClient
let collector: ReturnType<typeof queryCollector>

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  resetExternalStoreRegistryForTests()
  expect(startRenderTracking()).toBe(true)
  queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
  collector = queryCollector(queryClient)
  const stop = collector.start?.(ctx)
  stopCollector = typeof stop === 'function' ? stop : undefined
})

afterEach(() => {
  view?.unmount()
  view = null
  stopCollector?.()
  queryClient.clear()
  disposeRenderTracking()
})

async function mount(children: ReactNode): Promise<void> {
  await act(async () => {
    view = render(createElement(QueryClientProvider, { client: queryClient }, children))
  })
}

async function notifications(): Promise<Notification[]> {
  const tool = collector.tools?.find(
    (candidate) => candidate.contract.name === 'query_notifications',
  )
  const result = (await tool?.handler({ limit: 500 } as never, ctx)) as { events: Notification[] }
  return result.events
}

async function queryCauses(component: string): Promise<QueryCause[][]> {
  const report = await getRenderCauseEventsReport({ component, limit: 50, appOnly: false })
  return report.events.map((event) =>
    (event.causes as QueryCause[]).filter((cause) => cause.kind === 'query'),
  )
}

const observe = () => clearRenders({ budget: { timeLimitMs: 500, adaptive: false } })

/** TanStack delivers observer notifications on a timer, so React work lands after the update call. */
async function deliver(update: () => void): Promise<void> {
  await act(async () => {
    update()
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
}

function Reader({ queryKey, label }: { queryKey: string; label?: string }): ReactNode {
  const query = useQuery({ queryKey: [queryKey], queryFn: async () => `${queryKey}-0` })
  return createElement('span', null, `${label ?? queryKey}:${String(query.data)}`)
}

describe('Query to React causality with real useQuery', () => {
  it('grades a render exact only through the notification its own observer delivered', async () => {
    function Changed(): ReactNode {
      return createElement(Reader, { queryKey: 'changed' })
    }
    function Untouched(): ReactNode {
      return createElement(Reader, { queryKey: 'untouched' })
    }
    queryClient.setQueryData(['changed'], 'changed-0')
    queryClient.setQueryData(['untouched'], 'untouched-0')
    await mount([createElement(Changed, { key: 'a' }), createElement(Untouched, { key: 'b' })])
    observe()

    await deliver(() => queryClient.setQueryData(['changed'], 'changed-1'))

    const [renderCauses, ...otherRenders] = await queryCauses('Reader')
    expect(otherRenders).toEqual([])
    expect(renderCauses).toEqual([
      expect.objectContaining({ evidence: 'exact', queryHash: '["changed"]' }),
    ])
    const delivered = (await notifications()).find(
      (event) => event.notificationId === renderCauses?.[0]?.notificationId,
    )
    expect(delivered?.observerId).toBe(renderCauses?.[0]?.observerId)
    expect(delivered?.renderEventIds).toHaveLength(1)
  })

  it('joins two queries updated in one batched tick to their own notifications', async () => {
    function Both(): ReactNode {
      const first = useQuery({ queryKey: ['first'], queryFn: async () => 0 })
      const second = useQuery({ queryKey: ['second'], queryFn: async () => 0 })
      return createElement('span', null, `${first.data}/${second.data}`)
    }
    queryClient.setQueryData(['first'], 0)
    queryClient.setQueryData(['second'], 0)
    await mount(createElement(Both))
    observe()

    await deliver(() =>
      notifyManager.batch(() => {
        queryClient.setQueryData(['first'], 1)
        queryClient.setQueryData(['second'], 2)
      }),
    )

    const events = await queryCauses('Both')
    expect(events).toHaveLength(1)
    const causes = events[0] ?? []
    expect(causes.map((cause) => [cause.queryHash, cause.evidence])).toEqual([
      ['["first"]', 'exact'],
      ['["second"]', 'exact'],
    ])
    const delivered = await notifications()
    for (const cause of causes) {
      const notification = delivered.find((event) => event.notificationId === cause.notificationId)
      expect(notification?.observerId).toBe(cause.observerId)
    }
    expect(new Set(causes.map((cause) => cause.notificationId)).size).toBe(2)
  })

  it('never grades an undelivered result change as exact when another cause re-renders', async () => {
    let bump: () => void = () => {}
    function Tracked(): ReactNode {
      const [count, setCount] = useState(0)
      bump = () => setCount((value) => value + 1)
      const query = useQuery({
        queryKey: ['tracked'],
        queryFn: async () => 'same',
        notifyOnChangeProps: ['data'],
      })
      return createElement('span', null, `${count}:${query.data}`)
    }
    queryClient.setQueryData(['tracked'], 'same')
    await mount(createElement(Tracked))
    observe()

    await deliver(() => {
      queryClient.setQueryData(['tracked'], 'same', { updatedAt: Date.now() + 1_000 })
      startTransition(() => bump())
    })

    const events = await queryCauses('Tracked')
    expect(events.length).toBeGreaterThan(0)
    for (const causes of events) {
      expect(causes.filter((cause) => cause.evidence === 'exact')).toEqual([])
    }
  })

  it('does not attach a sibling query notification to a component that rendered for its own state', async () => {
    let bump: () => void = () => {}
    function Local(): ReactNode {
      const [count, setCount] = useState(0)
      bump = () => setCount((value) => value + 1)
      return createElement('span', null, count)
    }
    queryClient.setQueryData(['sibling'], 'sibling-0')
    await mount([
      createElement(Local, { key: 'local' }),
      createElement(Reader, { key: 'r', queryKey: 'sibling' }),
    ])
    observe()

    await deliver(() => {
      queryClient.setQueryData(['sibling'], 'sibling-1')
      bump()
    })

    expect((await queryCauses('Local')).flat()).toEqual([])
    expect(await queryCauses('Reader')).toEqual([
      [expect.objectContaining({ evidence: 'exact', queryHash: '["sibling"]' })],
    ])
  })
})
