import {
  type Fiber,
  getFiberId,
  getReactWorkTagsForFiber,
  isCompositeFiber,
  isHostFiber,
} from 'bippy'
import { type CommitWorkBudget, consumeCommitWork } from './commit-budget'
import { nameOf } from './fiber'
import { ownUpdateScheduled } from './render-output'

const WRAPPER_SEARCH_LIMIT = 8
const CASCADE_SEARCH_LIMIT = 1_000
const HOC_NAME = /^[^()]+\((.+)\)$/

export interface RenderedComponentRef {
  componentId: number
  componentName: string
}

/** The component that wraps this one without rendering anything else: a higher-order component such as `Connect(Inner)` or `withRouter(Inner)`, or the outer fiber of `memo(forwardRef(Inner))`. Providers and fragments between them are allowed; a host element or a sibling is not. */
export function wrapperOf(fiber: Fiber, commitWork?: CommitWorkBudget): Fiber | null {
  try {
    let child = fiber
    let parent = fiber.return
    for (let depth = 0; parent && depth < WRAPPER_SEARCH_LIMIT; depth += 1) {
      if (!consumeCommitWork(commitWork, 'wrapper-relation')) return null
      if (parent.child !== child || child.sibling !== null || isHostFiber(parent)) return null
      if (isCompositeFiber(parent)) return wraps(parent, fiber) ? parent : null
      child = parent
      parent = parent.return
    }
    return null
  } catch {
    return null
  }
}

function wraps(wrapper: Fiber, inner: Fiber): boolean {
  const innerName = nameOf(inner)
  const wrapperName = nameOf(wrapper)
  if (HOC_NAME.exec(wrapperName)?.[1] === innerName) return true
  return (
    wrapper.tag === getReactWorkTagsForFiber(wrapper).MemoComponent && wrapperName === innerName
  )
}

/** Walk up from the parent that rendered this component to the nearest ancestor React scheduled an update on: the render that started the cascade. Null when the chain is broken or unreadable. Answers are cached per commit, so siblings share one walk. */
export function cascadeOrigin(
  parent: Fiber,
  renderedFibers: ReadonlySet<Fiber>,
  cache: Map<Fiber, RenderedComponentRef | null>,
  commitWork?: CommitWorkBudget,
): RenderedComponentRef | null {
  const walked: Fiber[] = []
  const settle = (origin: RenderedComponentRef | null): RenderedComponentRef | null => {
    for (const fiber of walked) cache.set(fiber, origin)
    return origin
  }
  let current: Fiber | null = parent
  for (let steps = 0; current && steps < CASCADE_SEARCH_LIMIT; steps += 1) {
    const known = cache.get(current)
    if (known !== undefined) return settle(known)
    if (!consumeCommitWork(commitWork, 'parent-ancestry')) return null
    walked.push(current)
    const own = ownUpdateScheduled(current)
    if (own === true) {
      return settle({ componentId: getFiberId(current), componentName: nameOf(current) })
    }
    if (own === null) return settle(null)
    let ancestor: Fiber | null = current.return
    while (ancestor && !isCompositeFiber(ancestor)) ancestor = ancestor.return
    if (!ancestor) return settle(null)
    const rendered =
      renderedFibers.has(ancestor) ||
      (ancestor.alternate !== null && renderedFibers.has(ancestor.alternate))
    if (!rendered) return settle(null)
    current = ancestor
  }
  return null
}
