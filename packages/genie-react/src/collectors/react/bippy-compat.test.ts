import type { Fiber } from 'bippy'
import { describe, expect, it } from 'vitest'
import { getNearestHostFibers, getTimings } from './bippy-compat'
import { defaultWorkTags } from './work-tags'

const { FunctionComponent, HostComponent } = defaultWorkTags

const fiber = (props: Record<string, unknown>): Fiber =>
  ({
    stateNode: null,
    return: null,
    child: null,
    sibling: null,
    alternate: null,
    flags: 0,
    ...props,
  }) as unknown as Fiber

describe('getNearestHostFibers', () => {
  it('returns the fiber itself when it is already a host fiber', () => {
    const host = fiber({ tag: HostComponent, type: 'div' })
    expect(getNearestHostFibers(host)).toEqual([host])
  })

  it('collects every host fiber below a composite, without descending past a host boundary', () => {
    const nested = fiber({ tag: HostComponent, type: 'em' })
    const first = fiber({ tag: HostComponent, type: 'span', child: nested })
    const second = fiber({ tag: HostComponent, type: 'b' })
    first.sibling = second
    const composite = fiber({ tag: FunctionComponent, child: first })

    expect(getNearestHostFibers(composite)).toEqual([first, second])
  })

  it('descends through intermediate composites to reach hosts', () => {
    const host = fiber({ tag: HostComponent, type: 'div' })
    const inner = fiber({ tag: FunctionComponent, child: host })
    const outer = fiber({ tag: FunctionComponent, child: inner })

    expect(getNearestHostFibers(outer)).toEqual([host])
  })

  it('returns nothing for a childless composite', () => {
    expect(getNearestHostFibers(fiber({ tag: FunctionComponent }))).toEqual([])
  })
})

describe('getTimings', () => {
  it('subtracts child durations from the fiber total', () => {
    const second = fiber({ tag: HostComponent, actualDuration: 2 })
    const first = fiber({ tag: HostComponent, actualDuration: 3, sibling: second })
    const parent = fiber({ tag: FunctionComponent, actualDuration: 10, child: first })

    expect(getTimings(parent)).toEqual({ selfTime: 5, totalTime: 10 })
  })

  it('reports zero for a fiber React never profiled', () => {
    expect(getTimings(fiber({ tag: FunctionComponent }))).toEqual({ selfTime: 0, totalTime: 0 })
    expect(getTimings(null)).toEqual({ selfTime: 0, totalTime: 0 })
  })
})
