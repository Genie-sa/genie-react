import { _fiberRoots, getFiberId } from 'bippy'
import { MAX_PENDING_WORK_BOUNDARIES, type PendingReactWork } from '../../protocol'
import { getTreeGeneration, nameOf } from './fiber'
import { getDocumentCommitId } from './observation'
import { forcedSuspenseBoundaries } from './overrides'
import { isRenderTrackingInstalled } from './render-tracker'
import { VisibleSuspenseBoundaryWalk } from './suspense-state'

export const PENDING_WORK_FIBERS_PER_CALL = 50_000

interface BoundaryScan {
  /** The committed tree the walk covers: no commit since it started and the same forced boundaries. */
  treeGeneration: number
  forced: ReadonlySet<number>
  walk: VisibleSuspenseBoundaryWalk
  suspendedBoundaries: number
  dehydratedBoundaries: number
  boundaries: PendingReactWork['boundaries']
}

let scan: BoundaryScan | null = null

function pendingLanesOf(root: unknown): number {
  const lanes = (root as { pendingLanes?: unknown }).pendingLanes
  return typeof lanes === 'number' ? lanes : 0
}

function sameIds(left: ReadonlySet<number>, right: ReadonlySet<number>): boolean {
  return left.size === right.size && [...left].every((id) => right.has(id))
}

/** A walk may resume only over the tree it started on. Without render tracking no commit is observed, so every call starts over. */
function resumableScan(forced: ReadonlySet<number>): BoundaryScan | null {
  const sameTree =
    scan !== null &&
    isRenderTrackingInstalled() &&
    scan.treeGeneration === getTreeGeneration() &&
    sameIds(scan.forced, forced)
  return sameTree ? scan : null
}

/** Reads the committed tree only (a fallback or unhydrated server HTML shows in `memoizedState`, a suspended transition only in its root's lanes), walking at most `fiberBudget` fibers per call and resuming there on the next call while no commit lands. */
export function getPendingReactWork(
  fiberBudget: number = PENDING_WORK_FIBERS_PER_CALL,
): PendingReactWork {
  const roots = [..._fiberRoots]
  const forced = new Set(forcedSuspenseBoundaries().map(getFiberId))
  const current = resumableScan(forced) ?? {
    treeGeneration: getTreeGeneration(),
    forced,
    walk: new VisibleSuspenseBoundaryWalk(roots.map((root) => root.current)),
    suspendedBoundaries: 0,
    dehydratedBoundaries: 0,
    boundaries: [],
  }
  scan = current
  current.walk.advance(fiberBudget, (fiber, state) => {
    if (state === null) return
    const boundaryId = getFiberId(fiber)
    if (current.forced.has(boundaryId)) return
    if (state === 'fallback') current.suspendedBoundaries += 1
    else current.dehydratedBoundaries += 1
    if (current.boundaries.length < MAX_PENDING_WORK_BOUNDARIES) {
      current.boundaries.push({ boundaryId, boundaryName: nameOf(fiber), state })
    }
  })
  return {
    documentCommitId: getDocumentCommitId(),
    scheduledRoots: roots.filter((root) => pendingLanesOf(root) !== 0).length,
    suspendedBoundaries: current.suspendedBoundaries,
    dehydratedBoundaries: current.dehydratedBoundaries,
    boundaries: [...current.boundaries],
    scanTruncated: !current.walk.complete,
    scannedFibers: current.walk.visitedFibers,
  }
}
