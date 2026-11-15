import { _fiberRoots, type Fiber, type FiberRoot, instrument, type Unsubscribe } from 'bippy'
import { supportedCommitHandler } from './safe-instrumentation'
import { isHiddenOffscreen, own, retryQueueOf } from './suspense-debug-info'
import { isSuspenseFiber } from './work-tags'

// React 19's RetryLanes. A root carries one right after it commits a Suspense fallback that waits on promises; React then prerenders the boundary and keeps the promises on that uncommitted attempt until it commits the attempt about 300ms later.
const RETRY_LANES = 62_914_560
const CAPTURE_DELAYS_MS = [16, 120]
const CAPTURE_WALK_LIMIT = 20_000

interface Held {
  deref(): object | undefined
}

const hold = (value: object): Held =>
  typeof WeakRef === 'function' ? new WeakRef(value) : { deref: () => value }

const captured = new WeakMap<Fiber, Held[]>()
const scheduledRoots = new WeakSet<FiberRoot>()
const timers = new Set<ReturnType<typeof setTimeout>>()
let instrumentation: Unsubscribe | null = null

function forget(boundary: Fiber): void {
  captured.delete(boundary)
  if (boundary.alternate) captured.delete(boundary.alternate)
}

function showsFallback(boundary: Fiber): boolean {
  const state = own(boundary, 'memoizedState')
  return state != null && own(state, 'dehydrated') == null
}

/** Remember the promises on each fallback boundary's uncommitted attempt, before React commits that attempt and clears them. */
export function captureRetryQueues(root: Fiber): void {
  const stack: Fiber[] = root.child ? [root.child] : []
  let visited = 0
  while (stack.length > 0 && visited < CAPTURE_WALK_LIMIT) {
    const fiber = stack.pop() as Fiber
    visited += 1
    if (fiber.sibling) stack.push(fiber.sibling)
    if (isHiddenOffscreen(fiber)) continue
    if (isSuspenseFiber(fiber)) {
      if (!showsFallback(fiber)) {
        forget(fiber)
      } else {
        const wakeables = retryQueueOf(fiber)
        if (wakeables.length > 0) {
          const held = wakeables.map(hold)
          captured.set(fiber, held)
          if (fiber.alternate) captured.set(fiber.alternate, held)
        }
        const fallback = fiber.child?.sibling
        if (fallback) stack.push(fallback)
        continue
      }
    }
    if (fiber.child) stack.push(fiber.child)
  }
}

export function retryCacheOf(boundary: Fiber): WeakSet<object> | Set<object> | null {
  const cache = own(boundary, 'stateNode')
  return cache instanceof WeakSet || cache instanceof Set ? cache : null
}

/** Captured promises this committed fallback still waits on. React adds a promise to the boundary's retry cache when the fallback commits and deletes it when the promise settles, so membership is exact. */
export function capturedWakeablesOf(boundary: Fiber): object[] {
  const held = captured.get(boundary)
  const cache = retryCacheOf(boundary)
  if (!held || !cache || !showsFallback(boundary)) return []
  return held.flatMap((ref) => {
    const wakeable = ref.deref()
    return wakeable && cache.has(wakeable) ? [wakeable] : []
  })
}

function scheduleCapture(root: FiberRoot): void {
  if (scheduledRoots.has(root)) return
  scheduledRoots.add(root)
  for (const [index, delay] of CAPTURE_DELAYS_MS.entries()) {
    const timer = setTimeout(() => {
      timers.delete(timer)
      if (index === CAPTURE_DELAYS_MS.length - 1) scheduledRoots.delete(root)
      try {
        captureRetryQueues(root.current)
      } catch {
        // Capture is best effort; a read still sees whatever React keeps live.
      }
    }, delay)
    timers.add(timer)
  }
}

/** Watches commits for a root with retry lanes, the only time a fallback's promises sit on an uncommitted attempt; the check per commit is one lane test. */
export function startSuspenseCapture(): void {
  if (instrumentation) return
  instrumentation = instrument({
    name: 'genie-react-suspense',
    onCommitFiberRoot: supportedCommitHandler((_rendererId, root) => {
      const lanes = own(root, 'pendingLanes')
      if (typeof lanes === 'number' && (lanes & RETRY_LANES) !== 0) scheduleCapture(root)
    }),
  })
  for (const root of _fiberRoots) {
    try {
      captureRetryQueues(root.current)
    } catch {
      // A root that cannot be walked yet is captured on its next retry commit.
    }
  }
}

export function disposeSuspenseCapture(): void {
  for (const timer of timers) clearTimeout(timer)
  timers.clear()
  instrumentation?.()
  instrumentation = null
}
