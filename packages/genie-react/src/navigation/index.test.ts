import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createNavigationTools, type NavigationState } from './index'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function fixture() {
  let state: NavigationState = {
    key: 'stack',
    type: 'stack',
    index: 0,
    routes: [{ key: 'home', name: 'home' }],
  }
  const dispatch = vi.fn()
  const integration = createNavigationTools({
    getState: () => state,
    isCurrentHref: (href) => href === '/' && state.routes[state.index ?? 0]?.name === 'home',
    router: {
      push: dispatch,
      navigate: dispatch,
      replace: dispatch,
      dismissTo: dispatch,
      back: dispatch,
      canGoBack: () => state.routes.length > 1,
    },
  })
  const call = async (name: string, args: unknown = {}) => {
    const tool = integration.tools.find((tool) => tool.contract.name === `app_${name}`)
    if (!tool) throw new Error(`Missing tool ${name}`)
    return (await tool.handler(tool.contract.input.parse(args) as never)) as Record<string, unknown>
  }
  const change = (next: NavigationState) => {
    state = next
    integration.screenListeners.state()
  }
  const pushState = (key = 'details') =>
    change({
      key: 'stack',
      type: 'stack',
      index: state.routes.length,
      routes: [...state.routes, { key, name: 'details' }],
    })
  const end = (key: string, closing = false) =>
    integration.screenListeners.transitionEnd({ target: key, data: { closing } })
  return { integration, call, dispatch, change, pushState, end }
}

it('waits for the matching native end after state changes and exposes repeated pushes', async () => {
  const f = fixture()
  const first = f.call('navigate', { href: '/details', mode: 'push' })
  await Promise.resolve()
  f.pushState('details-1')
  let completed = false
  void first.then(() => {
    completed = true
  })
  await vi.advanceTimersByTimeAsync(0)
  expect(completed).toBe(false)
  f.end('unrelated')
  await vi.advanceTimersByTimeAsync(0)
  expect(completed).toBe(false)
  f.end('details-1')
  expect(await first).toMatchObject({
    settled: true,
    reason: 'transition-end',
    stackDepth: 2,
    currentRoute: { key: 'details-1' },
  })
  const second = f.call('navigate', { href: '/details', mode: 'push' })
  await Promise.resolve()
  f.pushState('details-2')
  f.end('details-2')
  expect(await second).toMatchObject({
    settled: true,
    stackDepth: 3,
    currentRoute: { key: 'details-2' },
  })
  expect(f.dispatch).toHaveBeenCalledTimes(2)
  f.integration.dispose()
})

it('expires a queued caller before the first transition ends and never dispatches it later', async () => {
  const f = fixture()
  const first = f.call('navigate', { href: '/details', mode: 'push', timeoutMs: 1000 })
  const queued = f.call('navigate', { href: '/other', mode: 'push', timeoutMs: 10 })
  await vi.advanceTimersByTimeAsync(10)
  expect(await queued).toMatchObject({ settled: false, reason: 'timeout' })
  expect(f.dispatch).toHaveBeenCalledTimes(1)
  f.pushState()
  f.end('details')
  expect(await first).toMatchObject({ settled: true })
  await vi.runAllTimersAsync()
  expect(f.dispatch).toHaveBeenCalledTimes(1)
  f.integration.dispose()
})

it('correlates a parent stack transition while returning the nested leaf route', async () => {
  const f = fixture()
  const pending = f.call('navigate', { href: '/tabs', mode: 'push' })
  await Promise.resolve()
  f.change({
    key: 'stack',
    type: 'stack',
    index: 1,
    routes: [
      { key: 'home', name: 'home' },
      {
        key: 'tabs',
        name: 'tabs',
        state: { type: 'tab', index: 0, routes: [{ key: 'feed', name: 'feed' }] },
      },
    ],
  })
  f.end('tabs')
  expect(await pending).toMatchObject({
    settled: true,
    currentRoute: { key: 'feed', name: 'feed' },
    stackDepth: 2,
    activeRoutePath: [
      { key: 'tabs', name: 'tabs' },
      { key: 'feed', name: 'feed' },
    ],
  })
  f.integration.dispose()
})

it('settles back from the closing removed route and preserves actual stack depth', async () => {
  const f = fixture()
  f.pushState()
  const pending = f.call('navigate_back')
  await Promise.resolve()
  f.change({ key: 'stack', type: 'stack', index: 0, routes: [{ key: 'home', name: 'home' }] })
  f.end('details', true)
  expect(await pending).toMatchObject({
    settled: true,
    stackDepth: 1,
    currentRoute: { key: 'home' },
  })
  f.integration.dispose()
})

it('answers proven no-ops without dispatch but refuses them during external transitions', async () => {
  const f = fixture()
  expect(await f.call('navigate', { href: '/' })).toMatchObject({ settled: true, reason: 'no-op' })
  expect(await f.call('navigate_back')).toMatchObject({ settled: true, reason: 'no-op' })
  f.integration.screenListeners.transitionStart({ target: 'home' })
  expect(await f.call('navigate', { href: '/' })).toMatchObject({
    settled: false,
    reason: 'transition-in-progress',
  })
  expect(await f.call('navigate_back')).toMatchObject({
    settled: false,
    reason: 'transition-in-progress',
  })
  expect(f.dispatch).not.toHaveBeenCalled()
  f.integration.dispose()
})

it('retains uncertain ownership after timeout until the late matching transition arrives', async () => {
  const f = fixture()
  const pending = f.call('navigate', { href: '/details', mode: 'push', timeoutMs: 10 })
  await vi.advanceTimersByTimeAsync(10)
  expect(await pending).toMatchObject({ settled: false, reason: 'timeout' })
  expect(await f.call('navigate', { href: '/other' })).toMatchObject({
    settled: false,
    reason: 'previous-navigation-unsettled',
  })
  f.pushState()
  f.end('details')
  expect(await f.call('navigation_state')).toMatchObject({ unsettledNavigation: false })
  f.integration.dispose()
})

it('disposal resolves active and queued callers and prevents later actions', async () => {
  const f = fixture()
  const active = f.call('navigate', { href: '/a', mode: 'push' })
  const queued = f.call('navigate', { href: '/b', mode: 'push' })
  await Promise.resolve()
  f.integration.dispose()
  expect(await active).toMatchObject({ settled: false, reason: 'disposed' })
  expect(await queued).toMatchObject({ settled: false, reason: 'disposed' })
  expect(f.dispatch).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})
