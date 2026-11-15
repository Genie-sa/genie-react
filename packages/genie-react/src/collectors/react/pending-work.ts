import { _fiberRoots, getFiberId } from 'bippy'
import { MAX_PENDING_WORK_BOUNDARIES, type PendingReactWork } from '../../protocol'
import { nameOf } from './fiber'
import { getDocumentCommitId } from './observation'
import { forcedSuspenseBoundaries } from './overrides'
import { forEachVisibleSuspenseBoundary } from './suspense-state'

const MAX_SCANNED_FIBERS = 50_000

function pendingLanesOf(root: unknown): number {
  const lanes = (root as { pendingLanes?: unknown }).pendingLanes
  return typeof lanes === 'number' ? lanes : 0
}

/** Reads the committed tree only: a boundary's fallback or unhydrated server HTML is visible in `memoizedState`, a suspended transition only in its root's lanes. */
export function getPendingReactWork(): PendingReactWork {
  const forced = new Set(forcedSuspenseBoundaries().map(getFiberId))
  const roots = [..._fiberRoots]
  const boundaries: PendingReactWork['boundaries'] = []
  let suspendedBoundaries = 0
  let dehydratedBoundaries = 0
  const { scanTruncated } = forEachVisibleSuspenseBoundary(
    roots.map((root) => root.current),
    MAX_SCANNED_FIBERS,
    (fiber, state) => {
      if (state === null) return
      const boundaryId = getFiberId(fiber)
      if (forced.has(boundaryId)) return
      if (state === 'fallback') suspendedBoundaries += 1
      else dehydratedBoundaries += 1
      if (boundaries.length < MAX_PENDING_WORK_BOUNDARIES) {
        boundaries.push({ boundaryId, boundaryName: nameOf(fiber), state })
      }
    },
  )
  return {
    documentCommitId: getDocumentCommitId(),
    scheduledRoots: roots.filter((root) => pendingLanesOf(root) !== 0).length,
    suspendedBoundaries,
    dehydratedBoundaries,
    boundaries,
    scanTruncated,
  }
}
