import type { Fiber, FiberRoot, InstrumentationOptions } from 'bippy'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  options: null as InstrumentationOptions | null,
  refresh: false,
  safe: true,
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
  isSafeRenderer: () => harness.safe,
  supportedCommitHandler: (handler: (rendererId: number, root: FiberRoot) => void) => handler,
}))

vi.mock('./refresh-tracker', () => ({
  isRefreshCommit: () => harness.refresh,
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

import { noteCommittedRoot } from './fiber'
import { getInstanceTombstones } from './instance-identity'
import { getRenderCohort } from './render-cohort'
import {
  clearRenders,
  disposeRenderTracking,
  getAnalysisFailedFiberCount,
  getDroppedPendingUnmountFiberCount,
  getPendingUnmountFiberCount,
  getRenders,
  getRenderTrackingCoverage,
  startRenderTracking,
  stopRenderTracking,
} from './render-tracker'

function rootWithComponent(name: string): FiberRoot {
  const type = (): null => null
  Object.assign(type, { displayName: name })
  const root = { tag: 3, child: null, return: null } as unknown as Fiber
  const previous = {
    tag: 0,
    type,
    memoizedProps: {},
    memoizedState: null,
    child: null,
    sibling: null,
    return: root,
  } as unknown as Fiber
  const current = {
    ...previous,
    alternate: previous,
    actualDuration: 1,
    selfBaseDuration: 1,
  } as Fiber
  previous.alternate = current
  root.child = current
  return { current: root } as FiberRoot
}

beforeEach(() => {
  disposeRenderTracking()
  clearRenders()
  harness.options = null
  harness.refresh = false
  harness.safe = true
  harness.traverse.mockReset().mockImplementation((root: FiberRoot, visit) => {
    const child = root.current.child
    if (child) visit(child, 'update')
  })
  startRenderTracking()
})

afterEach(() => disposeRenderTracking())

describe('excluded commit traversal baselines', () => {
  it('advances a paused commit without publishing it, then records only the next commit', async () => {
    const root = rootWithComponent('PausedCounter')
    stopRenderTracking()
    harness.options?.onCommitFiberRoot?.(1, root)

    expect(await getRenders({ sort: 'renders', limit: 10 })).toEqual([])
    startRenderTracking()
    harness.options?.onCommitFiberRoot?.(1, root)

    expect(harness.traverse).toHaveBeenCalledTimes(2)
    expect(await getRenders({ sort: 'renders', limit: 10 })).toMatchObject([
      { name: 'PausedCounter', renders: 1 },
    ])
  })

  it('does not publish an unmount tombstone while profiling is paused', () => {
    const root = rootWithComponent('PausedUnmount')
    const child = root.current.child
    expect(child).not.toBeNull()

    stopRenderTracking()
    if (child) harness.options?.onCommitFiberUnmount?.(1, child)
    harness.options?.onCommitFiberRoot?.(1, root)

    expect(getInstanceTombstones()).toEqual([])
  })

  it('fails closed when an excluded baseline cannot advance', async () => {
    const root = rootWithComponent('RecoveredBaseline')
    harness.traverse.mockImplementationOnce(() => {
      throw new Error('baseline failed')
    })

    stopRenderTracking()
    harness.options?.onCommitFiberRoot?.(1, root)
    startRenderTracking()
    harness.options?.onCommitFiberRoot?.(1, root)
    expect(await getRenders({ sort: 'renders', limit: 10 })).toEqual([])

    harness.options?.onCommitFiberRoot?.(1, root)
    expect(await getRenders({ sort: 'renders', limit: 10 })).toMatchObject([
      { name: 'RecoveredBaseline', renders: 1 },
    ])
    expect(getAnalysisFailedFiberCount()).toBe(1)
  })

  it('fails closed when an active commit traversal throws before reaching a mounted instance', async () => {
    clearRenders({
      budget: {
        fiberLimit: 50,
        operationLimit: 20_000,
        timeLimitMs: 50,
        adaptive: false,
      },
    })
    const root = rootWithComponent('MissedByTraversal')
    harness.traverse.mockImplementationOnce((_root: FiberRoot, visit) => {
      for (let index = 0; index < 51; index += 1) {
        const child = rootWithComponent(`Visited${index}`).current.child
        if (child) visit(child, 'update')
      }
      throw new Error('active traversal failed')
    })

    expect(() => harness.options?.onCommitFiberRoot?.(1, root)).not.toThrow()
    expect(getAnalysisFailedFiberCount()).toBe(1)
    expect(
      getRenderCohort(
        root.current,
        { component: 'MissedByTraversal', exact: true, limit: 10 },
        getRenderTrackingCoverage('measurement'),
      ),
    ).toMatchObject({
      status: 'unknown',
      mountedIdle: 0,
      mountedUnknown: 1,
      coverage: { complete: false },
    })

    harness.options?.onCommitFiberRoot?.(1, root)
    expect(await getRenders({ sort: 'renders', limit: 10 })).toEqual([])

    harness.options?.onCommitFiberRoot?.(1, root)
    expect(await getRenders({ sort: 'renders', limit: 10 })).toMatchObject([
      { name: 'MissedByTraversal', renders: 1 },
    ])
  })

  it('keeps a post-clear recovery commit incomplete after an earlier traversal failure', async () => {
    const root = rootWithComponent('RecoveredAfterClear')
    harness.traverse.mockImplementationOnce(() => {
      throw new Error('active traversal failed')
    })
    harness.options?.onCommitFiberRoot?.(1, root)
    expect(getAnalysisFailedFiberCount()).toBe(1)

    clearRenders()
    expect(getAnalysisFailedFiberCount()).toBe(0)
    harness.options?.onCommitFiberRoot?.(1, root)

    expect(getAnalysisFailedFiberCount()).toBe(1)
    expect(
      getRenderCohort(
        root.current,
        { component: 'RecoveredAfterClear', exact: true, limit: 10 },
        getRenderTrackingCoverage('measurement'),
      ),
    ).toMatchObject({ status: 'unknown', mountedIdle: 0, mountedUnknown: 1 })
    expect(await getRenders({ sort: 'renders', limit: 10 })).toEqual([])

    harness.options?.onCommitFiberRoot?.(1, root)
    expect(await getRenders({ sort: 'renders', limit: 10 })).toMatchObject([
      { name: 'RecoveredAfterClear', renders: 1 },
    ])
  })

  it('keeps absence unknown until a budget-deferred unmount is published', () => {
    clearRenders({
      budget: {
        fiberLimit: 50,
        operationLimit: 1_000,
        timeLimitMs: 1,
        targetOperationReserve: 100,
        targetTimeReserveMs: 1,
        adaptive: false,
      },
    })
    const root = rootWithComponent('Gone')
    const gone = root.current.child
    const sentinel = rootWithComponent('Sentinel').current.child
    expect(gone).not.toBeNull()
    expect(sentinel).not.toBeNull()
    if (!gone || !sentinel) return

    ;(gone as { sibling: Fiber | null }).sibling = sentinel
    ;(sentinel as { return: Fiber }).return = root.current
    harness.options?.onCommitFiberUnmount?.(1, gone)
    ;(root.current as { child: Fiber }).child = sentinel
    ;(gone as { sibling: Fiber | null }).sibling = null

    const now = vi
      .spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValue(2)
    try {
      harness.options?.onCommitFiberRoot?.(1, root)
      expect(getPendingUnmountFiberCount()).toBe(1)
      expect(
        getRenderCohort(
          root.current,
          { component: 'Gone', exact: true, limit: 10 },
          {
            ...getRenderTrackingCoverage('measurement'),
            pendingUnmountFibers: getPendingUnmountFiberCount(),
          },
        ),
      ).toMatchObject({ status: 'unknown', matched: 0, unmounted: 0 })

      now.mockReturnValue(0)
      harness.options?.onCommitFiberRoot?.(1, root)
      expect(getPendingUnmountFiberCount()).toBe(0)
      expect(
        getRenderCohort(
          root.current,
          { component: 'Gone', exact: true, limit: 10 },
          {
            ...getRenderTrackingCoverage('measurement'),
            pendingUnmountFibers: getPendingUnmountFiberCount(),
          },
        ),
      ).toMatchObject({ status: 'unmounted', matched: 1, unmounted: 1 })
      expect(
        getRenderCohort(
          root.current,
          { component: 'Missing', exact: true, limit: 10 },
          {
            ...getRenderTrackingCoverage('measurement'),
            pendingUnmountFibers: getPendingUnmountFiberCount(),
          },
        ),
      ).toMatchObject({ status: 'absent', matched: 0, coverage: { complete: false } })
    } finally {
      now.mockRestore()
    }
  })

  it('does not let another renderer consume the pending-unmount budget', () => {
    clearRenders({
      budget: {
        fiberLimit: 50,
        operationLimit: 1,
        timeLimitMs: 50,
        adaptive: false,
      },
    })
    const root = rootWithComponent('Sentinel')
    const other = rootWithComponent('OtherRenderer').current.child
    const gone = rootWithComponent('GoneNow').current.child
    expect(other).not.toBeNull()
    expect(gone).not.toBeNull()
    if (!other || !gone) return

    harness.options?.onCommitFiberUnmount?.(2, other)
    harness.options?.onCommitFiberUnmount?.(1, gone)
    harness.options?.onCommitFiberRoot?.(1, root)

    expect(getPendingUnmountFiberCount()).toBe(1)
    expect(getInstanceTombstones().map(({ componentName }) => componentName)).toEqual(['GoneNow'])
  })

  it('retains a lifecycle coverage gap when tracking is disposed with a pending unmount', () => {
    const root = rootWithComponent('Sentinel')
    const gone = rootWithComponent('GoneDuringDispose').current.child
    expect(gone).not.toBeNull()
    if (!gone) return
    noteCommittedRoot(root)
    harness.options?.onCommitFiberUnmount?.(1, gone)
    expect(getPendingUnmountFiberCount()).toBe(1)

    disposeRenderTracking()

    expect(getPendingUnmountFiberCount()).toBe(0)
    expect(
      getRenderCohort(
        root.current,
        { component: 'GoneDuringDispose', exact: true, limit: 10 },
        {
          skippedCommitFibers: 0,
          droppedUnmountFibers: 0,
          analysisFailedFibers: getAnalysisFailedFiberCount(),
          truncatedInputFibers: 0,
          pendingUnmountFibers: getPendingUnmountFiberCount(),
        },
      ),
    ).toMatchObject({
      status: 'unknown',
      matched: 0,
      coverage: { complete: false, droppedUnmountFibers: 1 },
    })
  })

  it('preserves prior pending-unmount eviction coverage when tracking is disposed', () => {
    clearRenders({ lifecycle: { bufferLimit: 100, targetReserve: 0 } })
    const root = rootWithComponent('Sentinel')
    const evicted = rootWithComponent('EvictedDuringDispose').current.child
    expect(evicted).not.toBeNull()
    if (!evicted) return

    harness.options?.onCommitFiberUnmount?.(1, evicted)
    for (let index = 0; index < 100; index += 1) {
      const retained = rootWithComponent(`RetainedDuringDispose${index}`).current.child
      expect(retained).not.toBeNull()
      if (!retained) return
      harness.options?.onCommitFiberUnmount?.(1, retained)
    }
    harness.traverse.mockImplementationOnce(() => {})
    harness.options?.onCommitFiberRoot?.(1, root)
    expect(getPendingUnmountFiberCount()).toBe(0)
    expect(getDroppedPendingUnmountFiberCount()).toBe(1)

    disposeRenderTracking()

    expect(getDroppedPendingUnmountFiberCount()).toBe(1)
  })

  it('marks a refresh commit incomplete even before any instance identity was materialized', () => {
    const root = rootWithComponent('RefreshedBeforeIdentity')
    harness.refresh = true
    harness.options?.onCommitFiberRoot?.(1, root)
    harness.refresh = false

    expect(
      getRenderCohort(
        root.current,
        { component: 'RefreshedBeforeIdentity', exact: true, limit: 10 },
        {
          skippedCommitFibers: 0,
          droppedUnmountFibers: 0,
          analysisFailedFibers: getAnalysisFailedFiberCount(),
          truncatedInputFibers: 0,
          pendingUnmountFibers: getPendingUnmountFiberCount(),
        },
      ),
    ).toMatchObject({
      status: 'unknown',
      mountedIdle: 0,
      mountedUnknown: 1,
      coverage: { complete: false, droppedUnmountFibers: 1 },
    })
  })

  it('does not report an update that occurred while profiling was paused as idle', () => {
    const root = rootWithComponent('UpdatedWhilePaused')
    stopRenderTracking()
    harness.options?.onCommitFiberRoot?.(1, root)

    expect(getAnalysisFailedFiberCount()).toBe(1)
    expect(
      getRenderCohort(
        root.current,
        { component: 'UpdatedWhilePaused', exact: true, limit: 10 },
        {
          skippedCommitFibers: 0,
          droppedUnmountFibers: 0,
          analysisFailedFibers: getAnalysisFailedFiberCount(),
          truncatedInputFibers: 0,
          pendingUnmountFibers: getPendingUnmountFiberCount(),
        },
      ),
    ).toMatchObject({ status: 'unknown', mountedIdle: 0, mountedUnknown: 1 })
  })

  it('fails closed for roots whose supported renderer is unsafe for deep analysis', () => {
    const root = rootWithComponent('UnsafeRendererRow')
    harness.safe = false
    harness.options?.onCommitFiberRoot?.(1, root)

    expect(getAnalysisFailedFiberCount()).toBe(1)
    expect(
      getRenderCohort(
        root.current,
        { component: 'UnsafeRendererRow', exact: true, limit: 10 },
        {
          skippedCommitFibers: 0,
          droppedUnmountFibers: 0,
          analysisFailedFibers: getAnalysisFailedFiberCount(),
          truncatedInputFibers: 0,
          pendingUnmountFibers: getPendingUnmountFiberCount(),
        },
      ),
    ).toMatchObject({ status: 'unknown', mountedIdle: 0, mountedUnknown: 1 })
  })

  it('advances a refresh commit without publishing it, then records only the next commit', async () => {
    const root = rootWithComponent('RefreshedCounter')
    harness.refresh = true
    harness.options?.onCommitFiberRoot?.(1, root)

    harness.refresh = false
    harness.options?.onCommitFiberRoot?.(1, root)

    expect(harness.traverse).toHaveBeenCalledTimes(2)
    expect(await getRenders({ sort: 'renders', limit: 10 })).toMatchObject([
      { name: 'RefreshedCounter', renders: 1 },
    ])
  })
})
