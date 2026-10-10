import type { Fiber } from 'bippy'
import { describe, expect, it, vi } from 'vitest'
import { deepDiff } from '../react/deep-diff'
import { createRenderEvidenceBudget, inputCoverage } from '../react/render-budget'
import { diffProps } from '../react/render-inputs'
import { installProxyTagging, isKnownProxy } from './proxy-tagging'
import { isPlainObject, plainOwnKeys } from './safe-object'

const NativeProxy = Proxy
const nativeRevocable = Proxy.revocable

function countingHandler<T extends object>(): { handler: ProxyHandler<T>; traps: () => number } {
  let calls = 0
  const count =
    <K extends keyof ProxyHandler<T>>(trap: K) =>
    (...args: unknown[]) => {
      calls += 1
      return (Reflect[trap as keyof typeof Reflect] as (...input: unknown[]) => unknown)(...args)
    }
  return {
    handler: {
      get: count('get'),
      has: count('has'),
      ownKeys: count('ownKeys'),
      getOwnPropertyDescriptor: count('getOwnPropertyDescriptor'),
      getPrototypeOf: count('getPrototypeOf'),
    } as ProxyHandler<T>,
    traps: () => calls,
  }
}

const propsFiber = (prev: unknown, next: unknown): Fiber =>
  ({ memoizedProps: next, alternate: { memoizedProps: prev } }) as Fiber

describe('proxy tagging', () => {
  it('never installs in a production build', () => {
    vi.stubEnv('NODE_ENV', 'production')
    try {
      installProxyTagging()
      expect(globalThis.Proxy).toBe(NativeProxy)
      expect(isKnownProxy(new Proxy({}, {}))).toBe(false)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('preserves the Proxy constructor surface and installs once', () => {
    installProxyTagging()
    const Tagged = globalThis.Proxy
    installProxyTagging()

    expect(globalThis.Proxy).toBe(Tagged)
    expect(Tagged).not.toBe(NativeProxy)
    expect(Tagged.name).toBe('Proxy')
    expect(Tagged.length).toBe(2)
    expect('prototype' in Tagged).toBe(false)
    expect(Object.getPrototypeOf(Tagged)).toBe(Function.prototype)
    expect(() =>
      (Tagged as unknown as (target: object, handler: object) => object)({}, {}),
    ).toThrow(TypeError)
    expect(() => new Tagged(1 as unknown as object, {})).toThrow(TypeError)
    expect(() => ({}) instanceof (Tagged as unknown as typeof Object)).toThrow(TypeError)
    expect(() => {
      class Extended extends (Tagged as unknown as typeof Object) {}
      return Extended
    }).toThrow(TypeError)

    const target = { value: 1 }
    const proxy = new Tagged(target, { get: (_, key) => (key === 'value' ? 2 : undefined) })
    expect(proxy.value).toBe(2)
    expect(isKnownProxy(proxy)).toBe(true)
    expect(isKnownProxy(target)).toBe(false)
  })

  it('tags revocable proxies and keeps the revocable shape', () => {
    installProxyTagging()
    const { revocable } = globalThis.Proxy

    expect(revocable).not.toBe(nativeRevocable)
    expect(revocable.name).toBe('revocable')
    expect(revocable.length).toBe(2)
    expect('prototype' in revocable).toBe(false)
    expect(Object.getOwnPropertyDescriptor(globalThis.Proxy, 'revocable')).toMatchObject({
      writable: true,
      enumerable: false,
      configurable: true,
    })
    const result = Proxy.revocable({ value: 1 }, {})
    expect(Object.keys(result)).toEqual(['proxy', 'revoke'])
    expect(isKnownProxy(result.proxy)).toBe(true)
    result.revoke()
    expect(isPlainObject(result.proxy)).toBe(false)
    expect(deepDiff({ value: result.proxy }, { value: {} }, { plainObjectDepth: 1 })).toEqual({
      changes: [{ kind: 'reference-only', path: '/value' }],
      visited: 2,
      truncated: true,
    })
  })

  it('never reflects on a store proxy passed as a prop value or props container', () => {
    installProxyTagging()
    const store = countingHandler<{ items: number[] }>()
    const before = new Proxy({ items: [1] }, store.handler)
    const after = new Proxy({ items: [1] }, store.handler)
    const list = countingHandler<number[]>()
    const items = new Proxy([1, 2], list.handler)
    const evidence = createRenderEvidenceBudget()

    expect(
      diffProps(propsFiber({ state: before, items: [1, 2] }, { state: after, items }), evidence),
    ).toMatchObject([
      {
        name: 'state',
        referenceOnly: false,
        deepDiff: { changes: [{ kind: 'reference-only', path: '' }], truncated: true },
        after: { kind: 'object', preview: '[proxy not inspected]' },
      },
      { name: 'items', referenceOnly: false, deepDiff: { truncated: true } },
    ])
    expect(plainOwnKeys(after)).toBeUndefined()

    const containerEvidence = createRenderEvidenceBudget()
    expect(diffProps(propsFiber(before, after), containerEvidence)).toEqual([])
    expect(inputCoverage(containerEvidence).propsNotEnumerated).toBe(true)
    expect(store.traps()).toBe(0)
    expect(list.traps()).toBe(0)
    expect(inputCoverage(evidence).complete).toBe(true)
  })
})
