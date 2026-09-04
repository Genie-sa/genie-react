import { QueryClient, QueryObserver } from '@tanstack/react-query'
import type { Fiber } from 'bippy'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  instrumentQueryObserver,
  recordQueryNotification,
  registerQueryObserver,
  resetExternalStoreRegistryForTests,
} from '../causal/external-store-registry'
import { createCommitWorkBudget } from './commit-budget'
import { createRenderEvidenceBudget, inputCoverage } from './render-budget'
import { countExternalStoreHooks, diffExternalStoreChanges } from './render-causes'

interface HookNode {
  memoizedState: unknown
  queue?: unknown
  next: HookNode | null
}

const asFiber = (shape: unknown): Fiber => shape as Fiber

function hookChain(hooks: Array<Omit<HookNode, 'next'>>): HookNode | null {
  let next: HookNode | null = null
  for (let index = hooks.length - 1; index >= 0; index -= 1) {
    const hook = hooks[index]
    if (hook) next = { ...hook, next }
  }
  return next
}

function externalStoreHook(snapshot: unknown): Omit<HookNode, 'next'> {
  return {
    memoizedState: snapshot,
    queue: { value: snapshot, getSnapshot: () => snapshot },
  }
}

function causalFiber(
  currentHooks: Array<Omit<HookNode, 'next'>>,
  previousHooks: Array<Omit<HookNode, 'next'>>,
): Fiber {
  const type = (): null => null
  Object.assign(type, { displayName: 'QueryConsumer' })
  return asFiber({
    tag: 0,
    type,
    memoizedProps: {},
    memoizedState: hookChain(currentHooks),
    alternate: { memoizedProps: {}, memoizedState: hookChain(previousHooks) },
  })
}

function queryResult(updatedAt: number): Record<string, unknown> {
  return { status: 'success', fetchStatus: 'idle', dataUpdatedAt: updatedAt }
}

function queryObserver(queryHash: string): object {
  return {
    options: { queryHash },
    getCurrentQuery: () => ({ queryHash, queryKey: [queryHash] }),
    getCurrentResult: () => queryResult(2),
    subscribe: () => () => {},
  }
}

beforeEach(() => resetExternalStoreRegistryForTests())

describe('bounded causal inspection', () => {
  it('counts a normal terminal hook link exactly', () => {
    expect(
      countExternalStoreHooks(
        asFiber({ memoizedState: { ...externalStoreHook('value'), next: null } }),
      ),
    ).toBe(1)
  })

  it('returns an incomplete sentinel when a hostile hook chain cannot be counted', () => {
    const hook = externalStoreHook('value') as Record<string, unknown>
    Object.defineProperty(hook, 'next', {
      get: () => {
        throw new Error('must not run')
      },
    })

    expect(countExternalStoreHooks(asFiber({ memoizedState: hook }))).toBe(-1)
  })

  it('does not grant exact QueriesObserver evidence to unregistered lookalikes', () => {
    const before = queryResult(1)
    const after = queryResult(2)
    const group = {
      getCurrentResult: () => after,
      getObservers: () => [queryObserver('fake')],
    }

    expect(
      diffExternalStoreChanges(
        causalFiber(
          [{ memoizedState: group }, externalStoreHook(after)],
          [{ memoizedState: group }, externalStoreHook(before)],
        ),
      ),
    ).toMatchObject([{ kind: 'query', evidence: 'inferred', reason: 'query-result-shape' }])
  })

  it('does not grant exact QueryObserver evidence to an unregistered structural match', () => {
    const before = queryResult(1)
    const after = queryResult(2)
    const observer = {
      options: { queryHash: 'fake' },
      getCurrentQuery: () => ({ queryHash: 'fake', queryKey: ['fake'] }),
      getCurrentResult: () => after,
      subscribe: () => () => {},
    }

    expect(
      diffExternalStoreChanges(
        causalFiber(
          [{ memoizedState: observer }, externalStoreHook(after)],
          [{ memoizedState: observer }, externalStoreHook(before)],
        ),
      ),
    ).toMatchObject([{ kind: 'query', evidence: 'inferred', reason: 'query-result-shape' }])
  })

  it('requires a matching notification ID before calling a Query cause exact', () => {
    const before = queryResult(1)
    const after = queryResult(2)
    const observer = queryObserver('registered') as ReturnType<typeof queryObserver>
    Object.assign(observer, { getCurrentResult: () => after })
    registerQueryObserver(observer)

    const withoutDelivery = diffExternalStoreChanges(
      causalFiber(
        [{ memoizedState: observer }, externalStoreHook(after)],
        [{ memoizedState: observer }, externalStoreHook(before)],
      ),
    )
    expect(withoutDelivery).toMatchObject([
      {
        kind: 'query',
        evidence: 'inferred',
        reason: 'query-observer-result-identity',
        notificationId: null,
      },
    ])

    const notification = recordQueryNotification(observer, before, after, {
      trackedFields: ['dataUpdatedAt'],
      trackedFieldsCoverage: 'exact',
      fanout: 1,
    })
    const withDelivery = diffExternalStoreChanges(
      causalFiber(
        [{ memoizedState: observer }, externalStoreHook(after)],
        [{ memoizedState: observer }, externalStoreHook(before)],
      ),
    )
    expect(withDelivery).toMatchObject([
      {
        kind: 'query',
        evidence: 'exact',
        reason: 'query-notification-delivered',
        notificationId: notification.notificationId,
      },
    ])
  })

  it('keeps QueriesObserver identity inferred without a group delivery notification', () => {
    const before = queryResult(1)
    const after = queryResult(2)
    const child = queryObserver('registered')
    registerQueryObserver(child)
    const group = {
      getCurrentResult: () => after,
      getObservers: () => [child],
    }

    expect(
      diffExternalStoreChanges(
        causalFiber(
          [{ memoizedState: group }, externalStoreHook(after)],
          [{ memoizedState: group }, externalStoreHook(before)],
        ),
      ),
    ).toMatchObject([
      {
        kind: 'query',
        evidence: 'inferred',
        reason: 'queries-observer-result-identity',
        queries: [{ observerId: 'query-observer:1' }],
      },
    ])
  })

  it('caps a huge observer array before filtering sparse entries', () => {
    const before = queryResult(1)
    const after = queryResult(2)
    const child = queryObserver('late')
    registerQueryObserver(child)
    const children = new Array<unknown>(1_000_000)
    children[999_999] = child
    const group = {
      getCurrentResult: () => after,
      getObservers: () => children,
    }
    const evidence = createRenderEvidenceBudget()

    expect(
      diffExternalStoreChanges(
        causalFiber(
          [{ memoizedState: group }, externalStoreHook(after)],
          [{ memoizedState: group }, externalStoreHook(before)],
        ),
        evidence,
      ),
    ).toMatchObject([{ kind: 'query', evidence: 'inferred' }])
    expect(inputCoverage(evidence)).toMatchObject({ complete: false, scanTruncated: true })
  })

  it('never invokes accessor fields while diffing external-store snapshots', () => {
    let reads = 0
    const snapshot = (updatedAt: number): Record<string, unknown> => {
      const value = queryResult(updatedAt)
      Object.defineProperty(value, 'computed', {
        enumerable: true,
        get: () => {
          reads += 1
          return updatedAt
        },
      })
      return value
    }
    const before = snapshot(1)
    const after = snapshot(2)
    const evidence = createRenderEvidenceBudget()

    expect(
      diffExternalStoreChanges(
        causalFiber([externalStoreHook(after)], [externalStoreHook(before)]),
        evidence,
      ),
    ).toMatchObject([
      { kind: 'query', changedFields: ['dataUpdatedAt'], deepDiff: { truncated: true } },
    ])
    expect(reads).toBe(0)
    expect(inputCoverage(evidence)).toMatchObject({ complete: true, scanTruncated: false })
  })
})

it('does not blame Query when a real observer suppressed an unsubscribed change', () => {
  const client = new QueryClient()
  const key = ['issue-81']
  const data = { value: 1 }
  client.setQueryData(key, data, { updatedAt: 1 })
  const observer = new QueryObserver(client, {
    queryKey: key,
    enabled: false,
    notifyOnChangeProps: ['data'],
  })
  let notifications = 0
  const unsubscribe = observer.subscribe(() => {
    notifications += 1
  })
  try {
    const before = observer.getCurrentResult()
    registerQueryObserver(observer)
    client.setQueryData(key, data, { updatedAt: 2 })
    const after = observer.getCurrentResult()
    expect(after.data).toBe(before.data)
    expect(after.dataUpdatedAt).not.toBe(before.dataUpdatedAt)
    expect(notifications).toBe(0)
    const causes = diffExternalStoreChanges(
      causalFiber(
        [{ memoizedState: observer }, externalStoreHook(after)],
        [{ memoizedState: observer }, externalStoreHook(before)],
      ),
    )
    expect(causes.filter((cause) => cause.kind === 'query')).toEqual([])
  } finally {
    unsubscribe()
    client.clear()
  }
})

function policyCauses(
  options: Record<string, unknown>,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  evidence = createRenderEvidenceBudget(),
) {
  const observer = {
    options,
    getCurrentQuery: () => ({ queryHash: 'policy', queryKey: ['policy'] }),
    getCurrentResult: () => after,
    subscribe: () => () => {},
  }
  registerQueryObserver(observer)
  return diffExternalStoreChanges(
    causalFiber(
      [{ memoizedState: observer }, externalStoreHook(after)],
      [{ memoizedState: observer }, externalStoreHook(before)],
    ),
    evidence,
  )
}

describe('current Query notification policy compatibility', () => {
  it.each([
    { policy: ['data'], before: 1, after: 2, expected: ['data'] },
    { policy: ['data'], before: Number.NaN, after: Number.NaN, expected: ['data'] },
    { policy: ['data'], before: -0, after: 0, expected: [] },
    { policy: [], before: 1, after: 2, expected: [] },
    { policy: 'all', before: 1, after: 2, expected: ['data', 'dataUpdatedAt'] },
    { policy: ['refetch'], before: 1, after: 2, expected: [] },
  ])('checks $policy against Query field equality ($before → $after)', ({
    policy,
    before,
    after,
    expected,
  }) => {
    const causes = policyCauses(
      { queryHash: 'policy', notifyOnChangeProps: policy },
      { ...queryResult(1), data: before },
      { ...queryResult(2), data: after },
    )
    if (expected.length === 0) expect(causes).toEqual([])
    else
      expect(causes).toMatchObject([
        {
          kind: 'query',
          evidence: 'inferred',
          notificationPolicyCheck: {
            status: 'matched',
            basis: 'current-effective-policy',
            changedSubscribedFields: expected,
          },
        },
      ])
  })

  it.each([
    true,
    () => false,
  ])('includes implicit error subscriptions for throwOnError=%s', (throwOnError) => {
    const causes = policyCauses(
      { queryHash: 'policy', notifyOnChangeProps: ['data'], throwOnError },
      { ...queryResult(1), data: 1, error: null },
      { ...queryResult(2), data: 1, error: new Error('query failed') },
    )
    expect(causes).toMatchObject([
      {
        notificationPolicyCheck: { status: 'matched', changedSubscribedFields: ['error'] },
      },
    ])
  })

  it.each([
    { label: 'auto-tracked', policy: undefined },
    {
      label: 'dynamic',
      policy: () => {
        throw new Error('must not call app policy')
      },
    },
    { label: 'truncated', policy: [...Array.from({ length: 100 }, () => 'data'), 'dataUpdatedAt'] },
    {
      label: 'accessor',
      policy: Object.defineProperty(['data'], '0', {
        get: () => {
          throw new Error('must not read')
        },
      }),
    },
  ])('keeps $label policies explicitly unavailable', ({ policy }) => {
    expect(
      policyCauses(
        { queryHash: 'policy', notifyOnChangeProps: policy },
        { ...queryResult(1), data: 1 },
        { ...queryResult(2), data: 1 },
      ),
    ).toMatchObject([
      {
        kind: 'query',
        notificationPolicyCheck: {
          status: 'unavailable',
          basis: 'current-effective-policy',
          reason: 'policy-unavailable',
        },
      },
    ])
  })

  it('does not assume an unreadable throwOnError option excludes errors', () => {
    const options = Object.defineProperty(
      { queryHash: 'policy', notifyOnChangeProps: ['data'] },
      'throwOnError',
      {
        get: () => {
          throw new Error('must not read app option')
        },
      },
    )
    expect(
      policyCauses(options, { ...queryResult(1), data: 1 }, { ...queryResult(2), data: 1 }),
    ).toMatchObject([
      {
        notificationPolicyCheck: { status: 'unavailable', reason: 'policy-unavailable' },
      },
    ])
  })

  it('retains a candidate while the query identity is transitioning', () => {
    expect(
      policyCauses(
        { queryHash: 'previous-query', notifyOnChangeProps: ['data'] },
        { ...queryResult(1), data: 1 },
        { ...queryResult(2), data: 1 },
      ),
    ).toMatchObject([
      {
        notificationPolicyCheck: { status: 'unavailable', reason: 'identity-transitioning' },
      },
    ])
  })

  it('checks subscribed fields outside the bounded changedFields list', () => {
    expect(
      policyCauses(
        { queryHash: 'policy', notifyOnChangeProps: ['refetch'] },
        { ...queryResult(1), refetch: () => 1 },
        { ...queryResult(2), refetch: () => 2 },
      ),
    ).toMatchObject([
      {
        changedFields: ['dataUpdatedAt'],
        notificationPolicyCheck: { status: 'matched', changedSubscribedFields: ['refetch'] },
      },
    ])
  })

  it('does not rule out an unreadable subscribed field', () => {
    const after = Object.defineProperty(queryResult(2), 'data', {
      get: () => {
        throw new Error('must not invoke')
      },
    })
    expect(
      policyCauses(
        { queryHash: 'policy', notifyOnChangeProps: ['data'] },
        { ...queryResult(1), data: 1 },
        after,
      ),
    ).toMatchObject([
      {
        notificationPolicyCheck: { status: 'unavailable', reason: 'snapshot-fields-unavailable' },
      },
    ])
  })

  it('retains uncertainty when the budget expires before subscribed-field comparisons', () => {
    const budget = createCommitWorkBudget({ operationLimit: 1000, now: () => 0 })
    const evidence = createRenderEvidenceBudget(budget)
    const options = new Proxy(
      { queryHash: 'policy', notifyOnChangeProps: ['data'], throwOnError: false },
      {
        getOwnPropertyDescriptor(target, key) {
          if (key === 'throwOnError') budget.remainingOperations = 0
          return Reflect.getOwnPropertyDescriptor(target, key)
        },
      },
    )
    expect(
      policyCauses(
        options,
        { ...queryResult(1), data: 1 },
        { ...queryResult(2), data: 1 },
        evidence,
      ),
    ).toMatchObject([
      {
        notificationPolicyCheck: { status: 'unavailable', reason: 'snapshot-fields-unavailable' },
      },
    ])
    expect(inputCoverage(evidence)).toMatchObject({ complete: false, scanTruncated: true })
  })

  it('preserves a real delivered notification after the policy changes', () => {
    const client = new QueryClient()
    const queryKey = ['policy-change']
    client.setQueryData(queryKey, 1, { updatedAt: 1 })
    const observer = new QueryObserver(client, {
      queryKey,
      enabled: false,
      notifyOnChangeProps: ['dataUpdatedAt'],
    })
    registerQueryObserver(observer)
    const restore = instrumentQueryObserver(observer)
    let delivered = 0
    const unsubscribe = observer.subscribe(() => {
      delivered += 1
    })
    try {
      const before = observer.getCurrentResult()
      client.setQueryData(queryKey, 1, { updatedAt: 2 })
      const after = observer.getCurrentResult()
      observer.setOptions({ queryKey, enabled: false, notifyOnChangeProps: ['data'] })
      expect(delivered).toBe(1)
      const causes = diffExternalStoreChanges(
        causalFiber(
          [{ memoizedState: observer }, externalStoreHook(after)],
          [{ memoizedState: observer }, externalStoreHook(before)],
        ),
      )
      expect(causes).toMatchObject([
        {
          evidence: 'exact',
          reason: 'query-notification-delivered',
          notification: { deliveryReason: 'tracked-field-changed:dataUpdatedAt' },
        },
      ])
      expect(causes[0]).not.toHaveProperty('notificationPolicyCheck')
    } finally {
      unsubscribe()
      restore()
      client.clear()
    }
  })
})
