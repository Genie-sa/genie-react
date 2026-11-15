import { type Fiber, type FiberRoot, type InstrumentationOptions, setFiberId } from 'bippy'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  options: null as InstrumentationOptions | null,
  safe: true,
  safetyChecks: 0,
  traverse: vi.fn(),
}))

vi.mock('bippy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('bippy')>()
  return {
    ...actual,
    instrument: (options: InstrumentationOptions) => {
      harness.options = options
      return () => {}
    },
    traverseRenderedFibers: harness.traverse,
  }
})

vi.mock('./safe-instrumentation', () => ({
  isSafeRenderer: () => {
    harness.safetyChecks += 1
    return harness.safe
  },
  supportedCommitHandler: (handler: (rendererId: number, root: FiberRoot) => void) => handler,
}))

vi.mock('./refresh-tracker', () => ({
  isRefreshCommit: () => false,
  noteExcludedRefreshCommit: () => {},
}))

vi.mock('bippy/source', () => ({
  formatOwnerStack: () => '',
  getFiberHooks: () => [],
  getSourceMap: async () => null,
  getSourceFromSourceMap: () => null,
  isSourceFile: () => true,
  normalizeFileName: (file: string) => file,
  parseStack: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
}))

import { getEffectAuditReport, recordEffect } from './effect-tracker'
import {
  clearRenders,
  disposeRenderTracking,
  getAnalysisFailedFiberCount,
  getDroppedPendingUnmountFiberCount,
  getPausedCommitCount,
  getPendingUnmountFiberCount,
  getRenders,
  getRendersMeasurement,
  getRenderTrackingCoverage,
  queuePendingUnmount,
  recordRender,
  startRenderTracking,
  stopRenderTracking,
} from './render-tracker'

function component(name: string): Fiber {
  const type = (): null => null
  Object.assign(type, { displayName: name })
  return {
    tag: 0,
    type,
    key: null,
    memoizedProps: {},
    memoizedState: null,
    child: null,
    sibling: null,
    return: null,
    alternate: null,
  } as unknown as Fiber
}

function rootWithComponent(name: string): FiberRoot {
  const root = { tag: 3, child: null, return: null } as unknown as Fiber
  const previous = { ...component(name), return: root } as Fiber
  const current = { ...previous, alternate: previous, actualDuration: 1 } as Fiber
  previous.alternate = current
  root.child = current
  return { current: root } as FiberRoot
}

const commit = (root: FiberRoot): void => {
  harness.options?.onCommitFiberRoot?.(1, root)
}

beforeEach(() => {
  disposeRenderTracking()
  clearRenders()
  harness.options = null
  harness.safe = true
  harness.safetyChecks = 0
  harness.traverse.mockReset().mockImplementation((root: FiberRoot, visit) => {
    const child = root.current.child
    if (child) visit(child, 'update')
  })
  startRenderTracking()
})

afterEach(() => disposeRenderTracking())

describe('paused commits on a root Bippy has already traversed', () => {
  it('skip the baseline walk, count as paused, and leave the next recorded commit intact', async () => {
    const root = rootWithComponent('Counter')
    commit(root)
    stopRenderTracking()
    commit(root)
    commit(root)
    commit(root)

    expect(harness.traverse).toHaveBeenCalledTimes(1)
    expect(getPausedCommitCount()).toBe(3)
    expect(getAnalysisFailedFiberCount()).toBe(0)

    startRenderTracking()
    commit(root)
    expect(harness.traverse).toHaveBeenCalledTimes(2)
    expect(await getRenders({ sort: 'renders', limit: 10 })).toMatchObject([
      { name: 'Counter', renders: 2 },
    ])
  })

  it('still walk a paused commit whose root reports a caught error, so the catch log keeps it', () => {
    const root = rootWithComponent('Checkout')
    commit(root)
    stopRenderTracking()
    commit(root)
    Object.assign(root.current, { subtreeFlags: 0b1000_0000 })
    commit(root)

    expect(harness.traverse).toHaveBeenCalledTimes(2)
  })

  it('still walk a root first committed while paused, so Bippy records its baseline', () => {
    const known = rootWithComponent('Known')
    commit(known)
    stopRenderTracking()
    const late = rootWithComponent('MountedWhilePaused')
    commit(late)
    commit(late)

    expect(harness.traverse.mock.calls.map(([root]) => root)).toEqual([known, late])
  })

  it('keep walking a root whose last traversal failed until a walk succeeds', () => {
    const root = rootWithComponent('Recovering')
    commit(root)
    harness.traverse.mockImplementationOnce(() => {
      throw new Error('traversal failed')
    })
    commit(root)
    stopRenderTracking()
    commit(root)
    commit(root)

    expect(harness.traverse).toHaveBeenCalledTimes(3)
  })

  it('walk again after tracking is disposed and reinstalled', () => {
    const root = rootWithComponent('Reinstalled')
    commit(root)
    disposeRenderTracking()
    startRenderTracking()
    stopRenderTracking()
    commit(root)

    expect(harness.traverse).toHaveBeenCalledTimes(2)
  })
})

describe('renderer safety for unmount callbacks', () => {
  it('is decided once per commit however many fibers it deletes', () => {
    const root = rootWithComponent('List')
    for (let index = 0; index < 50; index += 1)
      harness.options?.onCommitFiberUnmount?.(1, component(`Row${index}`))

    expect(harness.safetyChecks).toBe(1)
    expect(getPendingUnmountFiberCount()).toBe(50)
    commit(root)
    expect(getPendingUnmountFiberCount()).toBe(0)
  })

  it('is decided again in the next commit, so a renderer that stops being safe is ignored', () => {
    const root = rootWithComponent('List')
    harness.options?.onCommitFiberUnmount?.(1, component('Before'))
    commit(root)
    harness.safe = false
    harness.options?.onCommitFiberUnmount?.(1, component('After'))

    expect(getPendingUnmountFiberCount()).toBe(0)
  })
})

/** The eviction the buffer had before targeted entries were counted: protect the newest `reserve` targeted entries, evict the first unprotected one. */
function referenceEviction(targeted: boolean[], reserve: number): number {
  const protectedIndices = new Set<number>()
  let remaining = reserve
  for (let index = targeted.length - 1; index >= 0 && remaining > 0; index -= 1) {
    if (!targeted[index]) continue
    protectedIndices.add(index)
    remaining -= 1
  }
  return Math.max(
    0,
    targeted.findIndex((_, index) => !protectedIndices.has(index)),
  )
}

function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31
    return state / 2 ** 31
  }
}

describe('pending unmount eviction', () => {
  it('evicts the same entries as the reference rule across random buffers, reserves and clears', async () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const random = seededRandom(seed)
      const bufferLimit = 1 + Math.floor(random() * 5)
      const targetReserve = Math.floor(random() * 4)
      const configure = () =>
        clearRenders({ components: ['target'], lifecycle: { bufferLimit, targetReserve } })
      configure()
      let queue: { name: string; targeted: boolean }[] = []
      let dropped = 0
      let droppedTargeted = 0
      const mounted = new Set<string>()
      for (let step = 0; step < 60; step += 1) {
        if (random() < 0.05) {
          configure()
          queue = []
          dropped = 0
          droppedTargeted = 0
          mounted.clear()
          continue
        }
        const targeted = random() < 0.4
        const name = `${targeted ? 'Target' : 'Other'}${seed}x${step}`
        const fiber = component(name)
        recordRender(fiber, 'mount')
        mounted.add(name)
        queuePendingUnmount(1, fiber)
        queue.push({ name, targeted })
        if (queue.length > bufferLimit) {
          const [evicted] = queue.splice(
            referenceEviction(
              queue.map((entry) => entry.targeted),
              targetReserve,
            ),
            1,
          )
          if (evicted) {
            mounted.delete(evicted.name)
            dropped += 1
            if (evicted.targeted) droppedTargeted += 1
          }
        }
        expect(getDroppedPendingUnmountFiberCount(), `seed ${seed} step ${step}`).toBe(dropped)
      }
      const recorded = (await getRenders({ sort: 'renders', limit: 200 })).map(({ name }) => name)
      expect(new Set(recorded), `seed ${seed}`).toEqual(mounted)
      expect(getRenderTrackingCoverage('measurement').targeted?.complete).toBe(
        droppedTargeted === 0,
      )
    }
  })

  it('forgets targeted entries discarded by a paused commit before counting the next overflow', () => {
    clearRenders({ components: ['target'], lifecycle: { bufferLimit: 2, targetReserve: 1 } })
    const root = rootWithComponent('Host')
    commit(root)
    stopRenderTracking()
    queuePendingUnmount(1, component('TargetA'))
    queuePendingUnmount(1, component('TargetB'))
    commit(root)
    startRenderTracking()

    const kept = component('TargetC')
    recordRender(kept, 'mount')
    queuePendingUnmount(1, kept)
    queuePendingUnmount(1, component('OtherA'))
    queuePendingUnmount(1, component('OtherB'))

    expect(getDroppedPendingUnmountFiberCount()).toBe(1)
    expect(getRenderTrackingCoverage('measurement').targeted?.complete).toBe(true)
  })
})

describe('render report snapshots', () => {
  it('keep the unmount state a component had when the report started, while the report resolves', async () => {
    const fibers = ['SnapshotA', 'SnapshotB', 'SnapshotC'].map(component)
    for (const fiber of fibers) recordRender(fiber, 'mount')
    const report = getRendersMeasurement({
      sort: 'renders',
      limit: 10,
      appOnly: false,
      includeCursor: false,
    })
    for (const fiber of fibers) queuePendingUnmount(1, fiber)
    commit(rootWithComponent('Host'))

    expect((await report).components.map(({ name, unmounted }) => [name, unmounted])).toEqual([
      ['SnapshotA', false],
      ['SnapshotB', false],
      ['SnapshotC', false],
    ])
    expect(
      (await getRenders({ sort: 'renders', limit: 10 }))
        .filter(({ name }) => name.startsWith('Snapshot'))
        .every(({ unmounted }) => unmounted),
    ).toBe(true)
  })
})

describe('an unmount evicted from a full lifecycle buffer', () => {
  it('releases its effect record under the id it had while mounted, after Bippy reassigns the fiber', async () => {
    const effectOwners = async () =>
      (
        await getEffectAuditReport({ limit: 50, appOnly: false, getRetainedHookTree: () => null })
      ).components.map(({ name }) => name)
    clearRenders({ lifecycle: { bufferLimit: 1, targetReserve: 0 } })
    const effect: Record<string, unknown> = {
      tag: 0b1001,
      deps: [],
      create: () => {},
      inst: { destroy: undefined },
      destroy: null,
    }
    effect.next = effect
    const owner = Object.assign(component('EffectOwner'), {
      updateQueue: { lastEffect: effect },
      memoizedState: { memoizedState: effect, next: null },
    })
    recordEffect(owner, 'mount')
    expect(await effectOwners()).toContain('EffectOwner')

    queuePendingUnmount(1, owner)
    setFiberId(owner, 1_000_000)
    queuePendingUnmount(1, component('Other'))

    expect(getDroppedPendingUnmountFiberCount()).toBe(1)
    expect(await effectOwners()).not.toContain('EffectOwner')
  })
})
