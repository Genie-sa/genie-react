// @vitest-environment jsdom
import '../collectors/react/hook'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocket } from 'ws'
import { GenieClient, type GenieCollector, type SocketLike } from '../client'
import { reactCollector } from '../collectors/react'
import { routerCollector } from '../collectors/tanstack/router'
import { newId } from '../protocol'
import { createTestBridge, type Frame, type Inbox, isResult, open, send } from './bridge-test-harness'
import type { StandaloneBridgeHandle } from './standalone'

let handle: StandaloneBridgeHandle
let client: GenieClient | null = null
let root: Root
let container: HTMLDivElement
let agent: { ws: WebSocket; inbox: Inbox }

beforeEach(async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  handle = createTestBridge({ clientBundlePath: 'unused-in-these-tests.js' })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  root.unmount()
  container.remove()
  client?.stop()
  client = null
  agent?.ws.close()
  await handle.close()
  vi.restoreAllMocks()
})

async function connect(collectors: GenieCollector[]): Promise<void> {
  const { url } = await handle.listen()
  client = new GenieClient({
    url,
    collectors,
    socketFactory: (target) => new WebSocket(target) as unknown as SocketLike,
  })
  client.start()
  agent = await open(`${url}?role=agent`)
  expect((await wait({ condition: 'ready', timeoutMs: 5_000 })).ok).toBe(true)
}

async function wait(args: Record<string, unknown>): Promise<Frame> {
  const id = newId()
  send(agent.ws, { kind: 'agent/invoke', id, tool: 'devtools_wait', args })
  const response = await agent.inbox.wait(isResult(id), 15_000)
  expect(response.ok).toBe(true)
  return response.result
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('devtools_wait for a component', () => {
  it('is not satisfied by a component whose name only contains the requested one', async () => {
    function CheckoutRow(): ReactNode {
      return createElement('p', null, 'row')
    }
    await connect([reactCollector()])
    root.render(createElement(CheckoutRow))
    await expect.poll(() => container.textContent).toBe('row')

    const result = await wait({ condition: 'component', name: 'Checkout', timeoutMs: 600 })
    expect(result).toMatchObject({ ok: false, reason: 'timeout' })

    expect(await wait({ condition: 'component', name: 'CheckoutRow', timeoutMs: 2_000 })).toMatchObject({
      ok: true,
    })
  })
})

describe('devtools_wait for TanStack Router navigation', () => {
  async function staleRouteApp() {
    const revalidation = deferred()
    let loads = 0
    const page = (text: string) => () => createElement('main', null, text)
    const rootRoute = createRootRoute({ component: () => createElement(Outlet) })
    const router = createRouter({
      routeTree: rootRoute.addChildren([
        createRoute({ getParentRoute: () => rootRoute, path: '/', component: page('home') }),
        createRoute({ getParentRoute: () => rootRoute, path: '/about', component: page('about') }),
        createRoute({
          getParentRoute: () => rootRoute,
          path: '/stale',
          staleTime: 0,
          loader: () => {
            loads += 1
            return loads === 1 ? 'first' : revalidation.promise.then(() => 'second')
          },
          component: page('stale'),
        }),
      ]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
      defaultPendingMs: 0,
      defaultPendingMinMs: 0,
    })
    await connect([reactCollector(), routerCollector(router)])
    root.render(createElement(RouterProvider, { router } as never))
    await router.load()
    await expect.poll(() => container.textContent).toBe('home')
    await new Promise((resolve) => setTimeout(resolve, 20))
    await router.navigate({ to: '/stale' })
    await router.navigate({ to: '/about' })
    await router.navigate({ to: '/stale' })
    await expect.poll(() => router.state.matches.at(-1)?.isFetching).toBeTruthy()
    expect(router.state.isLoading).toBe(false)
    return { router, revalidation }
  }

  it('navigation is not done while a stale-while-revalidate loader still runs', async () => {
    const { router, revalidation } = await staleRouteApp()

    const during = await wait({ condition: 'navigation', name: '/stale', timeoutMs: 600 })
    expect(during).toMatchObject({ ok: false, reason: 'timeout' })
    expect(during.lastObserved).toMatchObject({
      settled: false,
      pendingWork: expect.arrayContaining(['match-fetching:/stale']),
    })

    revalidation.resolve()
    const after = await wait({ condition: 'navigation', name: '/stale', timeoutMs: 5_000 })
    expect(after).toMatchObject({ ok: true, lastObserved: { settled: true, pendingWork: [] } })
    expect(router.state.matches.at(-1)?.loaderData).toBe('second')
  })

  it('the router domain of settled stays pending while a loader revalidates', async () => {
    const { revalidation } = await staleRouteApp()

    const during = await wait({ condition: 'settled', domains: ['router'], timeoutMs: 600 })
    expect(during).toMatchObject({ ok: false, reason: 'timeout' })
    expect(during.domains.router.lastObserved).toMatchObject({ settled: false })

    revalidation.resolve()
    const after = await wait({ condition: 'settled', domains: ['router'], timeoutMs: 5_000 })
    expect(after).toMatchObject({ ok: true })
    expect(after.domains.router.lastObserved).toMatchObject({ settled: true, pendingWork: [] })
  })
})
