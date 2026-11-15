import type { Fiber } from 'bippy'
import { isHiddenOffscreen, own } from './suspense-debug-info'
import { isSuspenseFiber } from './work-tags'

export type CommittedSuspenseState = 'fallback' | 'dehydrated'

/** What a committed boundary shows instead of its children: React parks a non-null `memoizedState` for a fallback, and one holding `dehydrated` for server HTML that has not hydrated yet. */
export function committedSuspenseState(fiber: Fiber): CommittedSuspenseState | null {
  if (!isSuspenseFiber(fiber)) return null
  const memoizedState = own(fiber, 'memoizedState')
  if (memoizedState == null) return null
  return own(memoizedState, 'dehydrated') != null ? 'dehydrated' : 'fallback'
}

/** A boundary showing its fallback renders only the fallback; its primary children are hidden and cannot be on screen. */
export function visibleChildOf(fiber: Fiber, state: CommittedSuspenseState | null): Fiber | null {
  return state === 'fallback' ? (fiber.child?.sibling ?? null) : fiber.child
}

/** Visits every committed Suspense boundary under the given root fibers that can be on screen: hidden Offscreen and Activity subtrees, and the primary tree behind a fallback, are skipped. */
export function forEachVisibleSuspenseBoundary(
  roots: Iterable<Fiber>,
  fiberLimit: number,
  visit: (boundary: Fiber, state: CommittedSuspenseState | null) => void,
): { scanTruncated: boolean } {
  let visited = 0
  for (const root of roots) {
    const stack: Fiber[] = [root]
    while (stack.length > 0) {
      const fiber = stack.pop() as Fiber
      if (++visited > fiberLimit) return { scanTruncated: true }
      if (fiber.sibling) stack.push(fiber.sibling)
      if (isHiddenOffscreen(fiber)) continue
      if (isSuspenseFiber(fiber)) {
        const state = committedSuspenseState(fiber)
        visit(fiber, state)
        const child = visibleChildOf(fiber, state)
        if (child) stack.push(child)
        continue
      }
      if (fiber.child) stack.push(fiber.child)
    }
  }
  return { scanTruncated: false }
}
