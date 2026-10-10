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

  it('stops at the commit work budget and discloses the truncated scan', () => {
    const evidence = createRenderEvidenceBudget(createCommitWorkBudget({ operationLimit: 1 }))
    const changes = diffProps(propsFiber({ a: 1, b: 1, c: 1 }, { a: 2, b: 2, c: 2 }), evidence)

    expect(changes.length).toBeLessThan(3)
    expect(inputCoverage(evidence)).toMatchObject({ complete: false, scanTruncated: true })
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
