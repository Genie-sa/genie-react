import { _fiberRoots, type Fiber, getFiberId } from 'bippy'
import { MAX_PENDING_WORK_BOUNDARIES, type PendingReactWork } from '../../protocol'
import { nameOf } from './fiber'
import { forcedSuspenseBoundaries } from './overrides'
import { getDocumentCommitId } from './observation'
import { isSuspenseFiber } from './work-tags'

const MAX_SCANNED_FIBERS = 50_000

function pendingLanesOf(root: unknown): number {
  const lanes = (root as { pendingLanes?: unknown }).pendingLanes
  return typeof lanes === 'number' ? lanes : 0
}

/** Reads the committed tree only: a boundary's fallback is visible in `memoizedState`, a suspended transition only in its root's lanes. */
export function getPendingReactWork(): PendingReactWork {
  const forced = new Set(forcedSuspenseBoundaries().map(getFiberId))
  const boundaries: PendingReactWork['boundaries'] = []
  let scheduledRoots = 0
  let suspendedBoundaries = 0
  let scanned = 0
  let scanTruncated = false
  for (const root of _fiberRoots) {
    if (pendingLanesOf(root) !== 0) scheduledRoots += 1
    const stack: Fiber[] = [root.current]
    while (stack.length > 0) {
      const fiber = stack.pop() as Fiber
      if (++scanned > MAX_SCANNED_FIBERS) {
        scanTruncated = true
        break
      }
      if (isSuspenseFiber(fiber) && fiber.memoizedState != null) {
        const boundaryId = getFiberId(fiber)
        if (!forced.has(boundaryId)) {
          suspendedBoundaries += 1
          if (boundaries.length < MAX_PENDING_WORK_BOUNDARIES) {
            boundaries.push({ boundaryId, boundaryName: nameOf(fiber) })
          }
        }
      }
      if (fiber.sibling) stack.push(fiber.sibling)
      if (fiber.child) stack.push(fiber.child)
    }
    if (scanTruncated) break
  }
  return {
    documentCommitId: getDocumentCommitId(),
    scheduledRoots,
    suspendedBoundaries,
    boundaries,
    scanTruncated,
  }
}
