import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { beforeEach, expect, it } from 'vitest'
import {
  instrumentQueryObserver,
  listQueryNotifications,
  recordRouterNotification,
  resetExternalStoreRegistryForTests,
  routerNotificationFor,
} from './external-store-registry'

setFlagsFromString('--expose-gc')
const collectGarbage = runInNewContext('gc') as () => void

beforeEach(() => resetExternalStoreRegistryForTests())

async function collected(reference: WeakRef<object>): Promise<boolean> {
  for (let attempt = 0; attempt < 10 && reference.deref() !== undefined; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
    collectGarbage()
  }
  return reference.deref() === undefined
}

it('keeps notification evidence without retaining an unmounted observer or its data', async () => {
  const queryClient = new QueryClient()
  const retained = await (async () => {
    const observer = new QueryObserver(queryClient, { queryKey: ['report'], enabled: false })
    const unsubscribe = observer.subscribe(() => {})
    const stop = instrumentQueryObserver(observer)
    queryClient.setQueryData(['report'], { rows: Array.from({ length: 1_000 }, (_, i) => i) })
    const data = queryClient.getQueryData<object>(['report'])
    stop()
    unsubscribe()
    queryClient.clear()
    return { observer: new WeakRef(observer), data: new WeakRef(data ?? {}) }
  })()

  expect(await collected(retained.observer)).toBe(true)
  expect(await collected(retained.data)).toBe(true)
  expect(listQueryNotifications({ limit: 10 }).events).toEqual([
    expect.objectContaining({ notificationId: 'query-notification:1', fanout: 1 }),
  ])
})

it('releases Router snapshots once they are no longer the latest delivery', async () => {
  const store = {}
  const first = (() => {
    const snapshot = { matches: [{ loaderData: new Array(1_000).fill('row') }] }
    recordRouterNotification(store, snapshot)
    return new WeakRef(snapshot)
  })()
  const latest = { matches: [] }
  recordRouterNotification(store, latest)

  expect(await collected(first)).toBe(true)
  expect(routerNotificationFor(store, latest)?.notificationId).toBe('router-notification:2')
})
