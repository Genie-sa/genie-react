import { type Fiber, getReactWorkTags, getReactWorkTagsForFiber } from 'bippy'

/**
 * React renumbers fiber work tags between major versions, so a tag is only meaningful
 * relative to the renderer that produced the fiber. Bippy memoizes the per-fiber lookup
 * in a WeakMap populated at commit time, so resolving per call stays cheap on hot paths.
 */

/** Work tags for the React version bundled with this build, for fibers with no attached renderer. */
export const defaultWorkTags = getReactWorkTags()

export const isClassComponentFiber = (fiber: Fiber): boolean =>
  fiber.tag === getReactWorkTagsForFiber(fiber).ClassComponent

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
