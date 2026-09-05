import { type Fiber, getFiberId } from 'bippy'
import { beforeEach, describe, expect, it } from 'vitest'
import { createCommitWorkBudget } from './commit-budget'
import {
  beginInstanceObservation,
  clearInstanceIdentityForTests,
  discardExcludedInstanceUnmount,
  getInstanceIdentityCoverage,
  getInstanceTombstones,
  instanceForMountedFiber,
  invalidateLiveInstancesForRefresh,
  noteInstanceRender,
  noteUnanalyzedInstanceRender,
  wasInstanceObserved,
  wasInstanceRenderUnanalyzed,
} from './instance-identity'

const asFiber = (value: unknown): Fiber => value as Fiber

function component(name: string, key: string | null = null): Fiber {
  const type = (): null => null
  Object.assign(type, { displayName: name })
  return asFiber({
    tag: 0,
    type,
    key,
    child: null,
    sibling: null,
    return: null,
    alternate: null,
    memoizedProps: {},
    memoizedState: null,
  })
}

function host(type: string): Fiber {
  return asFiber({
    tag: 5,
    type,
    key: null,
    child: null,
    sibling: null,
    return: null,
    alternate: null,
  })
}

function attach(parent: Fiber, children: Fiber[]): void {
  ;(parent as { child: Fiber | null }).child = children[0] ?? null
  children.forEach((child, index) => {
    ;(child as { return: Fiber }).return = parent
    ;(child as { sibling: Fiber | null }).sibling = children[index + 1] ?? null
  })
}

beforeEach(() => clearInstanceIdentityForTests())

describe('React component instance identity', () => {
  it('keeps a keyed physical mount stable when sibling order changes', () => {
    const parent = component('Rows')
    const a = component('Row', 'a')
    const b = component('Row', 'b')
    attach(parent, [a, b])

    const mounted = noteInstanceRender(a, 'mount', 1, 10)
    attach(parent, [b, a])
    const reordered = instanceForMountedFiber(a)

    expect(reordered).toMatchObject({
      fiberId: mounted.fiberId,
      mountId: mounted.mountId,
      mountGeneration: 1,
      mountGenerationEvidence: 'exact',
      key: 'a',
      siblingIndex: 1,
      logicalIdentityEvidence: 'keyed',
    })
    expect(reordered.logicalPath).toBe(mounted.logicalPath)
  })

  it('labels unkeyed and duplicate-key identities as positional', () => {
    const parent = component('Rows')
    const first = component('Row', 'same')
    const second = component('Row', 'same')
    const unkeyed = component('Row')
    attach(parent, [first, second, unkeyed])

    expect(instanceForMountedFiber(first).logicalIdentityEvidence).toBe('positional')
    expect(instanceForMountedFiber(unkeyed)).toMatchObject({
      siblingIndex: 2,
      logicalIdentityEvidence: 'positional',
      mountGenerationEvidence: 'inferred',
    })
  })

  it('creates a tombstone and increments generation when the same key remounts', () => {
    beginInstanceObservation('observation:1')
    const parent = component('Rows')
    const first = component('Row', 'a')
    attach(parent, [first])
    const firstMount = noteInstanceRender(first, 'mount', 1, 10)

    // React can detach return/sibling links before the DevTools unmount callback.
    ;(first as { return: Fiber | null }).return = null
    const removed = noteInstanceRender(first, 'unmount', 2, 11)
    const replacement = component('Row', 'a')
    attach(parent, [replacement])
    const secondMount = noteInstanceRender(replacement, 'mount', 3, 12)

    expect(removed.mountId).toBe(firstMount.mountId)
    expect(removed.parent?.name).toBe('Rows')
    expect(removed.logicalPath).toBe(firstMount.logicalPath)
    expect(secondMount.mountId).not.toBe(firstMount.mountId)
    expect(secondMount.mountGeneration).toBe(2)
    expect(getInstanceTombstones()).toEqual([
      expect.objectContaining({
        componentName: 'Row',
        observationId: 'observation:1',
        profileCommitId: 2,
        documentCommitId: 11,
        instance: expect.objectContaining({ mountId: firstMount.mountId }),
      }),
    ])
  })

  it('tracks whether a mounted instance rendered in the active observation', () => {
    beginInstanceObservation('observation:1')
    const fiber = component('Idle')
    const idle = instanceForMountedFiber(fiber)
    expect(wasInstanceObserved(idle.fiberId)).toBe(false)

    noteInstanceRender(fiber, 'update', 1, 1)
    expect(wasInstanceObserved(idle.fiberId)).toBe(true)

    beginInstanceObservation('observation:2')
    expect(wasInstanceObserved(idle.fiberId)).toBe(false)
  })

  it('prunes skipped-render uncertainty when exact evidence resolves the instance', () => {
    beginInstanceObservation('observation:1')
    const updated = component('Updated')
    const updatedId = instanceForMountedFiber(updated).fiberId
    noteUnanalyzedInstanceRender(updated)
    expect(wasInstanceRenderUnanalyzed(updatedId)).toBe(true)

    noteInstanceRender(updated, 'update', 1, 1)
    expect(wasInstanceRenderUnanalyzed(updatedId)).toBe(false)
    noteUnanalyzedInstanceRender(updated)
    expect(wasInstanceRenderUnanalyzed(updatedId)).toBe(false)

    const unmounted = component('Unmounted')
    const unmountedId = instanceForMountedFiber(unmounted).fiberId
    noteUnanalyzedInstanceRender(unmounted)
    noteInstanceRender(unmounted, 'unmount', 2, 2)
    expect(wasInstanceRenderUnanalyzed(unmountedId)).toBe(false)

    const excluded = component('Excluded')
    const excludedId = instanceForMountedFiber(excluded).fiberId
    noteUnanalyzedInstanceRender(excluded)
    discardExcludedInstanceUnmount(excluded)
    expect(wasInstanceRenderUnanalyzed(excludedId)).toBe(false)
  })

  it('bounds skipped-render identity detail and fails closed on overflow', () => {
    beginInstanceObservation('observation:1')
    const first = component('Skipped0')
    const firstId = instanceForMountedFiber(first).fiberId
    noteUnanalyzedInstanceRender(first)
    for (let index = 1; index < 1_000; index += 1) {
      noteUnanalyzedInstanceRender(component(`Skipped${index}`))
    }

    expect(getInstanceIdentityCoverage().unanalyzedRenderIdentityComplete).toBe(true)
    expect(wasInstanceRenderUnanalyzed(firstId)).toBe(true)

    noteUnanalyzedInstanceRender(component('Skipped1000'))
    expect(getInstanceIdentityCoverage().unanalyzedRenderIdentityComplete).toBe(false)
    expect(wasInstanceRenderUnanalyzed(firstId)).toBe(false)

    beginInstanceObservation('observation:2')
    expect(getInstanceIdentityCoverage().unanalyzedRenderIdentityComplete).toBe(true)
  })

  it('deduplicates current and alternate skipped-render callbacks without consuming the bound', () => {
    beginInstanceObservation('observation:1')
    const current = component('Alternating')
    const alternate = { ...current, alternate: current } as Fiber
    ;(current as { alternate: Fiber }).alternate = alternate

    for (let index = 0; index < 2_000; index += 1) {
      noteUnanalyzedInstanceRender(index % 2 === 0 ? current : alternate)
    }

    expect(getFiberId(current)).toBe(getFiberId(alternate))
    expect(getInstanceIdentityCoverage().unanalyzedRenderIdentityComplete).toBe(true)
    expect(wasInstanceRenderUnanalyzed(getFiberId(current))).toBe(true)
  })

  it('prunes refresh-invalidated detail without manufacturing complete identity coverage', () => {
    beginInstanceObservation('observation:1')
    const fiber = component('RefreshedSkipped')
    const fiberId = instanceForMountedFiber(fiber).fiberId
    noteUnanalyzedInstanceRender(fiber)

    invalidateLiveInstancesForRefresh()

    expect(wasInstanceRenderUnanalyzed(fiberId)).toBe(false)
    expect(getInstanceIdentityCoverage().unanalyzedRenderIdentityComplete).toBe(false)
    beginInstanceObservation('observation:2')
    expect(getInstanceIdentityCoverage().unanalyzedRenderIdentityComplete).toBe(true)
  })

  it('drops HMR-invalidated live identity and records a lifecycle coverage gap', () => {
    beginInstanceObservation('observation:1')
    const fiber = component('RefreshedRow')
    const before = noteInstanceRender(fiber, 'mount', 1, 1)

    discardExcludedInstanceUnmount(fiber)
    const after = instanceForMountedFiber(fiber)

    expect(after.mountId).not.toBe(before.mountId)
    expect(after.mountGeneration).toBe(2)
    expect(getInstanceIdentityCoverage().excludedLifecycleFibers).toBe(1)
    expect(getInstanceTombstones()).toEqual([])
  })

  it('includes host ancestry so positional rows in separate wrappers do not collide', () => {
    const root = component('Root')
    const left = host('div')
    const right = host('div')
    const leftRow = component('Row')
    const rightRow = component('Row')
    attach(root, [left, right])
    attach(left, [leftRow])
    attach(right, [rightRow])

    const leftIdentity = instanceForMountedFiber(leftRow)
    const rightIdentity = instanceForMountedFiber(rightRow)

    expect(leftIdentity.logicalPath).toContain('<div>[index=0]')
    expect(rightIdentity.logicalPath).toContain('<div>[index=1]')
    expect(leftIdentity.logicalPath).not.toBe(rightIdentity.logicalPath)
  })

  it('bounds tombstones and reports exactly what was dropped', () => {
    beginInstanceObservation('observation:1')
    const row = component('Row')
    for (let index = 0; index < 1_001; index += 1) {
      noteInstanceRender(row, 'unmount', index, index)
    }

    expect(getInstanceTombstones()).toHaveLength(1_000)
    expect(getInstanceIdentityCoverage().droppedTombstones).toBe(1)
  })

  it('bounds generation history and downgrades identities after eviction', () => {
    let last: ReturnType<typeof instanceForMountedFiber> | null = null
    for (let index = 0; index < 10_001; index += 1) {
      last = instanceForMountedFiber(component(`Row${index}`))
    }

    expect(getInstanceIdentityCoverage().generationHistoryEvictions).toBe(1)
    expect(last?.mountGenerationEvidence).toBe('unknown')
  })
})

describe('commit-scoped sibling identity work', () => {
  const work = () => createCommitWorkBudget({ operationLimit: 1_000_000, now: () => 0 })

  it('identifies a wide keyed list with linear app-owned sibling reads', () => {
    const parent = component('Rows')
    const rows = Array.from({ length: 100 }, (_, index) => component('Row', String(index)))
    attach(parent, rows)
    let siblingReads = 0
    rows.forEach((row, index) => {
      Object.defineProperty(row, 'sibling', {
        get() {
          siblingReads += 1
          return rows[index + 1] ?? null
        },
      })
    })
    const budget = work()

    rows.forEach((row, index) => {
      expect(noteInstanceRender(row, 'mount', 1, 1, budget)).toMatchObject({
        siblingIndex: index,
        key: String(index),
        logicalIdentityEvidence: 'keyed',
      })
    })

    // Recovering every position and key must not re-read the list for every row.
    expect(siblingReads).toBeLessThanOrEqual(rows.length * 2)
  })

  it('recomputes positions and key uniqueness after the next commit reorders siblings', () => {
    const parent = component('Rows')
    const a = component('Row', 'a')
    const b = component('Row', 'b')
    attach(parent, [a, b])
    const mounted = noteInstanceRender(a, 'mount', 1, 1, work())

    attach(parent, [b, a])
    const reordered = noteInstanceRender(a, 'update', 2, 2, work())
    expect(reordered).toMatchObject({ siblingIndex: 1, logicalIdentityEvidence: 'keyed' })
    expect(reordered.mountId).toBe(mounted.mountId)
    expect(reordered.logicalPath).toBe(mounted.logicalPath)

    ;(b as { key: string }).key = 'a'
    const duplicated = noteInstanceRender(a, 'update', 3, 3, work())
    expect(duplicated).toMatchObject({ siblingIndex: 1, logicalIdentityEvidence: 'positional' })
    expect(duplicated.logicalPath).toContain('Row[index=1]')
  })

  it('does not let a cached sibling scan bypass an expired commit deadline', () => {
    const parent = component('Rows')
    const a = component('Row', 'a')
    const b = component('Row', 'b')
    attach(parent, [a, b])
    let now = 0
    const budget = createCommitWorkBudget({ now: () => now, timeLimitMs: 1 })
    expect(noteInstanceRender(a, 'mount', 1, 1, budget).logicalIdentityEvidence).toBe('keyed')

    now = 1
    expect(noteInstanceRender(b, 'mount', 1, 1, budget)).toMatchObject({
      siblingIndex: null,
      logicalIdentityEvidence: 'unknown',
    })
  })

  it('does not infer key uniqueness when the shared operation budget interrupts the scan', () => {
    const parent = component('Rows')
    const rows = Array.from({ length: 100 }, (_, index) => component('Row', String(index)))
    attach(parent, rows)
    const budget = createCommitWorkBudget({ now: () => 0, operationLimit: 10 })

    expect(
      noteInstanceRender(rows[0] as Fiber, 'mount', 1, 1, budget).logicalIdentityEvidence,
    ).toBe('unknown')
    expect(
      noteInstanceRender(rows[1] as Fiber, 'mount', 1, 1, budget).logicalIdentityEvidence,
    ).toBe('unknown')
  })

  it('does not infer key uniqueness from a bounded prefix of a larger sibling list', () => {
    const parent = component('Rows')
    const rows = Array.from({ length: 2_001 }, (_, index) => component('Row', String(index)))
    attach(parent, rows)
    const budget = work()

    const first = noteInstanceRender(rows[0] as Fiber, 'mount', 1, 1, budget)
    const last = noteInstanceRender(rows[2_000] as Fiber, 'mount', 1, 1, budget)

    expect(first).toMatchObject({ siblingIndex: 0, logicalIdentityEvidence: 'positional' })
    expect(last).toMatchObject({ siblingIndex: null, logicalIdentityEvidence: 'unknown' })
  })
})
