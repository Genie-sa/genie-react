/**
 * Helpers bippy 0.7 removed from its public surface, vendored from 0.6.1 (MIT, Aiden Bai)
 * with identical semantics. Delete from here if bippy ever restores them.
 */
import { type Fiber, isHostFiber } from 'bippy'

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

/**
 * Render timings for a fiber. `selfTime` subtracts child durations from `actualDuration`,
 * which React only populates in a profiling build.
 */
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
