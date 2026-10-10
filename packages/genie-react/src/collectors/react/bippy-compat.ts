// Helpers bippy removed, vendored (MIT, Aiden Bai) with identical semantics: didFiberCommit from 0.7.2, the rest from 0.6.1. Delete any bippy restores.
import { type Fiber, isHostFiber, MutationMask, ReactFiberFlags } from 'bippy'

/** A hook effect entry on a fiber's `updateQueue`. */
export interface Effect {
  [key: string]: unknown
  create: (...args: unknown[]) => unknown
  deps: null | unknown[]
  destroy: ((...args: unknown[]) => unknown) | null
  next: Effect | null
  tag: number
}

export const toUnsubscribe = <T extends () => void>(dispose: T): T & Disposable =>
  Object.assign(dispose, { [Symbol.dispose]: dispose })

const COMMIT_FLAGS = MutationMask | ReactFiberFlags.Cloned

/** Whether the fiber or its subtree carries commit work; true for any past commit, not only the current one. */
export const didFiberCommit = (fiber: Fiber): boolean =>
  (fiber.flags & COMMIT_FLAGS) !== 0 || (fiber.subtreeFlags & COMMIT_FLAGS) !== 0

/** Every host fiber the given fiber renders, descending only until each host boundary. */
export const getNearestHostFibers = (fiber: Fiber): Fiber[] => {
  const hostFibers: Fiber[] = []
  const stack: Fiber[] = []

  if (isHostFiber(fiber)) hostFibers.push(fiber)
  else if (fiber.child) stack.push(fiber.child)

  while (stack.length) {
    const current = stack.pop()
    if (!current) break
    if (isHostFiber(current)) hostFibers.push(current)
    else if (current.child) stack.push(current.child)
    if (current.sibling) stack.push(current.sibling)
  }
  return hostFibers
}

/** Render timings; `selfTime` subtracts child durations from `actualDuration`, which only a profiling build populates. */
export const getTimings = (fiber?: Fiber | null): { selfTime: number; totalTime: number } => {
  const totalTime = fiber?.actualDuration ?? 0
  let selfTime = totalTime
  let child = fiber?.child ?? null
  while (totalTime > 0 && child != null) {
    selfTime -= child.actualDuration ?? 0
    child = child.sibling
  }
  return { selfTime, totalTime }
}
