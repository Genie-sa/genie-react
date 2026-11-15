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

export type SuspenseBoundaryVisitor = (
  boundary: Fiber,
  state: CommittedSuspenseState | null,
) => void

/** A depth-first walk over every committed Suspense boundary that can be on screen: hidden Offscreen and Activity subtrees, and the primary tree behind a fallback, are skipped. It stops at a fiber budget and resumes on a later call, which is sound only while the walked tree stays committed. */
export class VisibleSuspenseBoundaryWalk {
  private readonly stack: Fiber[]
  private visited = 0

  constructor(roots: Iterable<Fiber>) {
    this.stack = [...roots].reverse()
  }

  get visitedFibers(): number {
    return this.visited
  }

  get complete(): boolean {
    return this.stack.length === 0
  }

  /** Visits at most `fiberBudget` more fibers and reports whether the walk has covered the whole tree. */
  advance(fiberBudget: number, visit: SuspenseBoundaryVisitor): boolean {
    for (let budget = fiberBudget; budget > 0 && this.stack.length > 0; budget -= 1) {
      const fiber = this.stack.pop() as Fiber
      this.visited += 1
      if (fiber.sibling) this.stack.push(fiber.sibling)
      if (isHiddenOffscreen(fiber)) continue
      if (isSuspenseFiber(fiber)) {
        const state = committedSuspenseState(fiber)
        visit(fiber, state)
        const child = visibleChildOf(fiber, state)
        if (child) this.stack.push(child)
        continue
      }
      if (fiber.child) this.stack.push(fiber.child)
    }
    return this.complete
  }
}

export function forEachVisibleSuspenseBoundary(
  roots: Iterable<Fiber>,
  fiberLimit: number,
  visit: SuspenseBoundaryVisitor,
): { scanTruncated: boolean } {
  return { scanTruncated: !new VisibleSuspenseBoundaryWalk(roots).advance(fiberLimit, visit) }
}
