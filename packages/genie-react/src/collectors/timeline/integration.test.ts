// @vitest-environment jsdom
import 'bippy/install-hook-only'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { type RenderResult, render } from '@testing-library/react'
import { act, createElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CollectorContext, GenieCollector } from '../../client'
import { type TimelineReadReport, type TimelineReport, timelineCollector } from './index'

const context: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}
let root: RenderResult
let container: HTMLDivElement
let cleanup: (() => void) | undefined
function call<T>(collector: GenieCollector, name: string, input: unknown): T {
  const tool = collector.tools?.find((candidate) => candidate.contract.name === name)
  if (!tool) throw new Error(`Missing tool ${name}`)
  return tool.handler(input as never, context) as T
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  container = document.createElement('div')
  document.body.append(container)
  root = render(null, { container })
})
afterEach(async () => {
  cleanup?.()
  cleanup = undefined
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

it('records actual React commits without changing render outcomes and detaches on stop', async () => {
  await act(async () => root.rerender(createElement('span', null, 'before')))
  const collector = timelineCollector()
  cleanup = collector.start?.(context) || undefined
  const recording = call<TimelineReport>(collector, 'timeline_start', { name: 'render' })
  expect(recording.coverage.react.status).toBe('available')
  await act(async () => root.rerender(createElement('span', null, 'after')))
  expect(container.textContent).toBe('after')
  const report = call<TimelineReadReport>(collector, 'timeline_read', { id: recording.id })
  const commits = report.events.filter((event) => event.domain === 'react')
  expect(commits).toHaveLength(1)
  expect(commits[0]?.type).toBe('commit')
  call(collector, 'timeline_stop', { id: recording.id })
  await act(async () => root.rerender(createElement('span', null, 'stopped')))
  expect(container.textContent).toBe('stopped')
  expect(call<TimelineReadReport>(collector, 'timeline_read', { id: recording.id }).events).toEqual(
    report.events,
  )
})

it('observes real TanStack navigation around a loader and retains only in-window lifecycle events', async () => {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => createElement('span', null, 'home'),
  })
  let releaseLoader: (() => void) | undefined
  const loaded = new Promise<void>((resolve) => {
    releaseLoader = resolve
  })
  const ordersRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/orders',
    loader: () => loaded,
    component: () => createElement('span', null, 'orders'),
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, ordersRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  })
  await act(async () => {
    await router.load()
    root.rerender(createElement(RouterProvider, { router }))
  })
  const collector = timelineCollector({ router })
  cleanup = collector.start?.(context) || undefined
  const recording = call<TimelineReport>(collector, 'timeline_start', { name: 'navigation' })
  let navigation: Promise<void> | undefined
  await act(async () => {
    navigation = router.navigate({ to: '/orders', search: { token: 'secret' } })
  })
  const pending = call<TimelineReadReport>(collector, 'timeline_read', {
    id: recording.id,
    domains: ['navigation'],
  })
  expect(pending.events.map((event) => event.type)).toEqual(['onBeforeNavigate', 'onBeforeLoad'])
  await act(async () => {
    releaseLoader?.()
    await navigation
  })
  expect(container.textContent).toBe('orders')
  call(collector, 'timeline_stop', { id: recording.id })
  const settled = call<TimelineReadReport>(collector, 'timeline_read', {
    id: recording.id,
    domains: ['navigation'],
  })
  expect(settled.events.map((event) => event.type)).toEqual([
    'onBeforeNavigate',
    'onBeforeLoad',
    'onLoad',
    'onResolved',
  ])
  expect(
    settled.events.every((event) => event.details.from === '/' && event.details.to === '/orders'),
  ).toBe(true)
  expect(JSON.stringify(settled.events)).not.toContain('secret')
  await act(async () => {
    await router.navigate({ to: '/' })
  })
  expect(
    call<TimelineReadReport>(collector, 'timeline_read', {
      id: recording.id,
      domains: ['navigation'],
    }),
  ).toEqual(settled)
})
