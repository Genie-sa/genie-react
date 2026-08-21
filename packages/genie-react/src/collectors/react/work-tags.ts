import { type Fiber, getReactWorkTags, getReactWorkTagsForFiber } from 'bippy'

// React renumbers work tags between majors, so a tag only means something relative to its renderer; bippy memoizes the per-fiber lookup in a WeakMap filled at commit time.

/** Work tags for the React version bundled with this build, for fibers with no attached renderer. */
export const defaultWorkTags = getReactWorkTags()

export const isClassComponentFiber = (fiber: Fiber): boolean =>
  fiber.tag === getReactWorkTagsForFiber(fiber).ClassComponent

export const isContextProviderFiber = (fiber: Fiber): boolean =>
  fiber.tag === getReactWorkTagsForFiber(fiber).ContextProvider

export const isSuspenseFiber = (fiber: Fiber): boolean =>
  fiber.tag === getReactWorkTagsForFiber(fiber).SuspenseComponent

export const isHostTextFiber = (fiber: Fiber): boolean =>
  fiber.tag === getReactWorkTagsForFiber(fiber).HostText

/** Fibers that own a hook effect list. Memo fibers wrap an inner fiber that carries the effects as one of these. */
export const ownsEffectList = (fiber: Fiber): boolean => {
  const tags = getReactWorkTagsForFiber(fiber)
  return (
    fiber.tag === tags.FunctionComponent ||
    fiber.tag === tags.ForwardRef ||
    fiber.tag === tags.SimpleMemoComponent
  )
}
