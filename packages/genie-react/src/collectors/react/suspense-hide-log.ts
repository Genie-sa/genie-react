import { type Fiber, getFiberId } from 'bippy'
import { nameOf } from './fiber'
import { instanceForMountedFiber } from './instance-identity'
import { getActiveObservation, getDocumentCommitId } from './observation'
import { forcedSuspenseBoundaries } from './overrides'
import { committedSuspenseState } from './suspense-state'

const HIDE_LOG_LIMIT = 200
const HIDDEN_SCAN_FIBER_LIMIT = 50_000
const HIDDEN_TARGET_LIMIT = 50
// React marks a fiber whose Offscreen visibility toggled; the flag bubbles into every ancestor's subtreeFlags.
const VISIBILITY = 0b10_0000_0000_0000

export interface HiddenTarget {
  componentName: string
  mountId: string
}

export interface SuspenseHide {
  hideId: string
  /** The commit in which the boundary replaced content already on screen with its fallback. */
  documentCommitId: number
  observationId: string | null
  boundaryId: number
  boundaryName: string
  forced: boolean
  /** Instances of the components the render observation targets that the fallback hid. */
  hiddenTargets: HiddenTarget[]
  hiddenTargetsOmitted: number
  /** False when the hidden content had more fibers than the scan reads, so a target may be missing from hiddenTargets. */
  hiddenScanComplete: boolean
}

export interface SuspenseHideLog {
  afterDocumentCommitId: number
  documentCommitId: number
  hides: SuspenseHide[]
  omittedByLimit: number
  complete: boolean
  incompleteReasons: ('hides-evicted' | 'commit-not-scanned')[]
}

/** Append-only history of boundaries hiding their content, so a fallback that came and went inside a window is still visible. */
const hideLog: SuspenseHide[] = []
let hideSequence = 0
let latestEvictedHideCommit = -1

export function resetSuspenseHideLogForTests(): void {
  hideLog.length = 0
  hideSequence = 0
  latestEvictedHideCommit = -1
}

/** React bubbles a visibility change into every ancestor's subtreeFlags, so a root without the flag hid nothing in this commit. */
export function mayHaveHidden(root: Fiber): boolean {
  return (((root.flags ?? 0) | (root.subtreeFlags ?? 0)) & VISIBILITY) !== 0
}

/** Records a Suspense boundary that committed its fallback in place of content it showed before; a boundary that mounts in its fallback hides nothing. */
export function recordSuspenseHide(fiber: Fiber, isTarget: (fiber: Fiber) => boolean): void {
  if (committedSuspenseState(fiber) !== 'fallback') return
  const previous = fiber.alternate
  if (!previous || previous.memoizedState != null) return
  const documentCommitId = getDocumentCommitId()
  const scan = hiddenTargetsOf(fiber, isTarget)
  hideSequence += 1
  hideLog.push({
    hideId: `hide:${documentCommitId}:${hideSequence}`,
    documentCommitId,
    observationId: getActiveObservation()?.id ?? null,
    boundaryId: getFiberId(fiber),
    boundaryName: suspenseBoundaryName(fiber),
    forced: forcedSuspenseBoundaries().some(
      (candidate) => candidate === fiber || candidate === previous,
    ),
    ...scan,
  })
  if (hideLog.length > HIDE_LOG_LIMIT) {
    const evicted = hideLog.shift()
    if (evicted) latestEvictedHideCommit = evicted.documentCommitId
  }
}

/** Target instances inside the primary children the fallback now hides; the fallback itself is a sibling and is not scanned. */
function hiddenTargetsOf(
  boundary: Fiber,
  isTarget: (fiber: Fiber) => boolean,
): Pick<SuspenseHide, 'hiddenTargets' | 'hiddenTargetsOmitted' | 'hiddenScanComplete'> {
  const hiddenTargets: HiddenTarget[] = []
  let hiddenTargetsOmitted = 0
  const primary = boundary.child
  const stack: Fiber[] = primary?.child ? [primary.child] : []
  let budget = HIDDEN_SCAN_FIBER_LIMIT
  while (stack.length > 0 && budget > 0) {
    const fiber = stack.pop() as Fiber
    budget -= 1
    if (fiber.sibling) stack.push(fiber.sibling)
    if (fiber.child) stack.push(fiber.child)
    if (!isTarget(fiber)) continue
    if (hiddenTargets.length >= HIDDEN_TARGET_LIMIT) {
      hiddenTargetsOmitted += 1
      continue
    }
    hiddenTargets.push({
      componentName: nameOf(fiber),
      mountId: instanceForMountedFiber(fiber).mountId,
    })
  }
  return { hiddenTargets, hiddenTargetsOmitted, hiddenScanComplete: stack.length === 0 }
}

export function suspenseBoundaryName(fiber: Fiber): string {
  const name = nameOf(fiber)
  return name === 'Anonymous' ? 'Suspense' : name
}

/** Hides committed after `afterDocumentCommitId`; complete only when none was evicted and every commit since was scanned. */
export function getSuspenseHideLog(
  afterDocumentCommitId: number,
  limit: number,
  commitNotScanned: boolean,
): SuspenseHideLog {
  const matching = hideLog.filter((entry) => entry.documentCommitId > afterDocumentCommitId)
  const incompleteReasons: SuspenseHideLog['incompleteReasons'] = []
  if (latestEvictedHideCommit > afterDocumentCommitId) incompleteReasons.push('hides-evicted')
  if (commitNotScanned) incompleteReasons.push('commit-not-scanned')
  return {
    afterDocumentCommitId,
    documentCommitId: getDocumentCommitId(),
    hides: matching.slice(0, limit).map((entry) => ({
      ...entry,
      hiddenTargets: entry.hiddenTargets.map((target) => ({ ...target })),
    })),
    omittedByLimit: Math.max(0, matching.length - limit),
    complete: incompleteReasons.length === 0,
    incompleteReasons,
  }
}
