import type { Fiber } from 'bippy'
import { describe, expect, it } from 'vitest'
import { createCommitWorkBudget } from './commit-budget'
import { createRenderEvidenceBudget, inputCoverage } from './render-budget'
import { childrenChanged, diffProps } from './render-inputs'

const asFiber = (shape: unknown): Fiber => shape as Fiber

const propsFiber = (prev: unknown, next: unknown): Fiber =>
  asFiber({ memoizedProps: next, alternate: { memoizedProps: prev } })

describe('diffProps', () => {
  it('classifies a fresh deep-equal object prop as reference-only', () => {
    const onSelect = () => {}
    const evidence = createRenderEvidenceBudget()
    const changes = diffProps(
      propsFiber(
        { badge: { label: 'new', tone: 1 }, onSelect },
        { badge: { label: 'new', tone: 1 }, onSelect },
      ),
      evidence,
    )

    expect(changes).toEqual([
      expect.objectContaining({
        name: 'badge',
        referenceChanged: true,
        referenceOnly: true,
        deepDiff: { changes: [{ kind: 'reference-only', path: '' }], visited: 3, truncated: false },
      }),
    ])
    expect(inputCoverage(evidence).complete).toBe(true)
  })

  it('classifies a primitive prop change as a value change', () => {
    const evidence = createRenderEvidenceBudget()
    const changes = diffProps(propsFiber({ count: 0 }, { count: 1 }), evidence)

    expect(changes).toMatchObject([
      {
        name: 'count',
        referenceChanged: false,
        referenceOnly: false,
        before: 0,
        after: 1,
        deepDiff: { changes: [{ kind: 'value', path: '', before: 0, after: 1 }] },
      },
    ])
    expect(inputCoverage(evidence).complete).toBe(true)
  })

  it('reports added and removed props by presence', () => {
    expect(diffProps(propsFiber({ gone: 1 }, { added: 2 }))).toMatchObject([
      { name: 'gone', beforePresent: true, afterPresent: false },
      { name: 'added', beforePresent: false, afterPresent: true },
    ])
  })

  it('does not call a changed function prop reference-only', () => {
    expect(diffProps(propsFiber({ onClick: () => 1 }, { onClick: () => 1 }))).toMatchObject([
      { name: 'onClick', referenceChanged: true, referenceOnly: false },
    ])
  })

  it('reports an array nested in a plain object prop as reference-only at its path', () => {
    expect(
      diffProps(propsFiber({ filter: { items: [1, 2] } }, { filter: { items: [1, 2] } })),
    ).toMatchObject([
      {
        name: 'filter',
        referenceOnly: true,
        deepDiff: {
          changes: [{ kind: 'reference-only', path: '/items' }],
          truncated: false,
        },
      },
    ])
  })

  it('reports a presence-only change even when the present value is undefined', () => {
    expect(diffProps(propsFiber({ a: undefined }, {}))).toMatchObject([
      {
        name: 'a',
        beforePresent: true,
        afterPresent: false,
        deepDiff: { changes: [{ kind: 'removed', path: '', before: { type: 'undefined' } }] },
      },
    ])
    expect(diffProps(propsFiber({}, { a: undefined }))).toMatchObject([
      {
        name: 'a',
        deepDiff: { changes: [{ kind: 'added', path: '', after: { type: 'undefined' } }] },
      },
    ])
  })

  it('never claims reference-only for objects with symbol keys or for React elements', () => {
    const tag = Symbol('tag')
    const element = () => ({
      $$typeof: Symbol.for('react.transitional.element'),
      type: 'b',
      props: {},
    })

    expect(
      diffProps(
        propsFiber(
          { meta: { [tag]: 1 }, icon: element() },
          { meta: { [tag]: 2 }, icon: element() },
        ),
      ),
    ).toMatchObject([
      { name: 'meta', referenceOnly: false, deepDiff: { truncated: true } },
      {
        name: 'icon',
        referenceOnly: false,
        deepDiff: { changes: [{ kind: 'reference-only', path: '' }], truncated: true },
      },
    ])
  })

  it('previews walked plain-object props by their key names', () => {
    const [change] = diffProps(
      propsFiber({ badge: { label: 'a', tone: 1 } }, { badge: { label: 'b', tone: 1 } }),
    )

    expect(change?.after).toEqual({
      __genie_dehydrated__: true,
      kind: 'object',
      preview: '{label, tone}',
      path: [],
      size: 2,
    })
  })

  it('keeps nested objects opaque below the first prop level', () => {
    expect(
      diffProps(propsFiber({ style: { inner: { a: 1 } } }, { style: { inner: { a: 1 } } })),
    ).toMatchObject([
      {
        name: 'style',
        referenceOnly: false,
        deepDiff: { changes: [{ kind: 'reference-only', path: '/inner' }], truncated: true },
      },
    ])
  })
})

describe('render input safety', () => {
  it('never invokes accessor props and discloses incomplete coverage', () => {
    let reads = 0
    const props = (label: string): Record<string, unknown> => {
      const value = { safe: label }
      Object.defineProperty(value, 'computed', {
        enumerable: true,
        get: () => {
          reads += 1
          return label
        },
      })
      return value
    }
    const evidence = createRenderEvidenceBudget()
    const changes = diffProps(propsFiber(props('before'), props('after')), evidence)

    expect(changes).toMatchObject([{ name: 'safe', before: 'before', after: 'after' }])
    expect(reads).toBe(0)
    expect(inputCoverage(evidence)).toMatchObject({
      complete: false,
      scanTruncated: true,
      propsNotEnumerated: false,
    })
  })

  it('never asks an exotic props container for its keys', () => {
    let ownKeyScans = 0
    const props = (): object =>
      new Proxy(new (class Props {})(), {
        ownKeys(target) {
          ownKeyScans += 1
          return Reflect.ownKeys(target)
        },
      })
    const evidence = createRenderEvidenceBudget()

    expect(diffProps(propsFiber(props(), props()), evidence)).toEqual([])
    expect(ownKeyScans).toBe(0)
    expect(inputCoverage(evidence)).toMatchObject({
      complete: false,
      scanTruncated: false,
      propsNotEnumerated: true,
    })
  })

  it('treats props whose prototype lookup throws as not enumerated', () => {
    const props = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error('revoked')
        },
      },
    )
    const evidence = createRenderEvidenceBudget()

    expect(diffProps(propsFiber(props, { value: 1 }), evidence)).toEqual([])
    expect(inputCoverage(evidence).propsNotEnumerated).toBe(true)
  })

  it('stops at the attribution budget and discloses the truncated scan', () => {
    const attribution = createCommitWorkBudget({ operationLimit: 1, now: () => 0 })
    const commitWork = createCommitWorkBudget({ operationLimit: 5, now: () => 0 })
    const evidence = createRenderEvidenceBudget(attribution, commitWork)
    const changes = diffProps(propsFiber({ a: 1, b: 1, c: 1 }, { a: 2, b: 2, c: 2 }), evidence)

    expect(changes).toMatchObject([
      {
        name: 'a',
        deepDiff: { changes: [], visited: 0, truncated: true },
        before: { preview: '[omitted: commit budget]' },
      },
    ])
    expect(inputCoverage(evidence)).toEqual({
      complete: false,
      omittedInputs: 0,
      scanTruncated: true,
      propsNotEnumerated: false,
    })
    expect(commitWork.remainingOperations).toBe(5)
    expect(commitWork.exhaustedSubsystems.size).toBe(0)
  })

  it('caps attribution per fiber even when the commit pool has room', () => {
    const props = (value: number) =>
      Object.fromEntries(Array.from({ length: 1_200 }, (_, index) => [`p${index}`, value]))
    const evidence = createRenderEvidenceBudget(
      createCommitWorkBudget({ operationLimit: 50_000, now: () => 0 }),
    )

    expect(diffProps(propsFiber(props(0), props(1)), evidence)).toHaveLength(50)
    expect(inputCoverage(evidence)).toMatchObject({ complete: false, scanTruncated: true })
  })

  it('treats props whose key listing throws as not enumerated', () => {
    const props = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('revoked')
        },
      },
    )
    const evidence = createRenderEvidenceBudget()

    expect(diffProps(propsFiber(props, { value: 1 }), evidence)).toEqual([])
    expect(inputCoverage(evidence)).toMatchObject({
      propsNotEnumerated: true,
      scanTruncated: false,
    })
  })

  it('discloses a prop slot whose descriptor lookup throws', () => {
    let lookups = 0
    const props = new Proxy(
      { value: 1 },
      {
        getOwnPropertyDescriptor(target, key) {
          lookups += 1
          if (lookups > 1) throw new Error('trap')
          return Reflect.getOwnPropertyDescriptor(target, key)
        },
      },
    )
    const evidence = createRenderEvidenceBudget()

    expect(diffProps(propsFiber(props, { value: 2 }), evidence)).toEqual([])
    expect(inputCoverage(evidence)).toMatchObject({
      propsNotEnumerated: false,
      scanTruncated: true,
    })
  })

  it('truncates a plain-object prop walk that runs out of attribution budget', () => {
    const evidence = createRenderEvidenceBudget(
      createCommitWorkBudget({ operationLimit: 4, now: () => 0 }),
    )
    const [change] = diffProps(
      propsFiber({ badge: { a: 1, b: 2, c: 3 } }, { badge: { a: 1, b: 2, c: 3 } }),
      evidence,
    )

    expect(change).toMatchObject({
      name: 'badge',
      referenceOnly: false,
      deepDiff: { truncated: true },
    })
    expect(inputCoverage(evidence).scanTruncated).toBe(true)
  })

  it('retains at most the input evidence limit and counts the omitted changes', () => {
    const props = (value: number) =>
      Object.fromEntries(Array.from({ length: 52 }, (_, index) => [`p${index}`, value]))
    const evidence = createRenderEvidenceBudget()

    expect(diffProps(propsFiber(props(0), props(1)), evidence)).toHaveLength(50)
    expect(inputCoverage(evidence)).toMatchObject({ complete: false, omittedInputs: 2 })
  })

  it('never reads an accessor-backed children prop', () => {
    let reads = 0
    const props = Object.defineProperty({}, 'children', {
      enumerable: true,
      get: () => {
        reads += 1
        return 'child'
      },
    })
    const evidence = createRenderEvidenceBudget()

    expect(
      childrenChanged(
        asFiber({ memoizedProps: props, alternate: { memoizedProps: props } }),
        evidence,
      ),
    ).toBe(false)
    expect(reads).toBe(0)
    expect(inputCoverage(evidence)).toMatchObject({ complete: false, scanTruncated: true })
  })
})
