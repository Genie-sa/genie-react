import {
  _fiberRoots,
  type Fiber,
  type FiberRoot,
  getRDTHook,
  getRenderer,
  isCompositeFiber,
  type ReactRenderer,
} from 'bippy'
import type { z } from 'zod'
import type { renderMeasurementEnvironmentSchema, strictModeStatusSchema } from './render-contract'

type MeasurementEnvironment = z.infer<typeof renderMeasurementEnvironmentSchema>
export type RendererBundle = MeasurementEnvironment['bundle']
type StrictModeStatus = z.infer<typeof strictModeStatusSchema>

// React copies StrictLegacyMode onto every fiber below a StrictMode boundary or a strict root.
const STRICT_LEGACY_MODE = 0b1000
const STRICT_MODE_SCAN_LIMIT = 5_000

/** Read renderer metadata from the app document; Genie's own build mode says nothing about it. */
export function getMeasurementEnvironment(): MeasurementEnvironment {
  return {
    bundle: rendererBundle(),
    timingsBundleDependent: true,
    countsScope: 'observed-run',
  }
}

function rendererBundle(): RendererBundle {
  try {
    return bundleOf(getRDTHook().renderers.values())
  } catch {
    return 'unknown'
  }
}

/** The bundle of the renderers hosting these fibers, so a framework's own production renderer (the Next.js dev overlay) does not decide for app components it never renders; null for no fibers. */
export function rendererBundleOf(fibers: Iterable<Fiber>): RendererBundle | null {
  const renderers = new Set<ReactRenderer | null>()
  for (const fiber of fibers) {
    try {
      renderers.add(getRenderer(fiber))
    } catch {
      renderers.add(null)
    }
  }
  return renderers.size === 0 ? null : bundleOf(renderers)
}

function bundleOf(renderers: Iterable<ReactRenderer | null>): RendererBundle {
  let development = false
  let production = false
  for (const renderer of renderers) {
    const bundleType = renderer?.bundleType
    if (typeof bundleType === 'number' && bundleType > 0) development = true
    else if (bundleType === 0) production = true
    else return 'unknown'
  }
  if (development && production) return 'mixed'
  if (development) return 'development'
  if (production) return 'production'
  return 'unknown'
}

/** Whether mounted components render under StrictMode, read from the mode bits on their fibers; bounded, so a large tree without a mixed answer stays unknown. */
export function getStrictModeStatus(roots: Iterable<FiberRoot> = _fiberRoots): StrictModeStatus {
  let strict = 0
  let loose = 0
  let visited = 0
  for (const root of roots) {
    const stack: (Fiber | null | undefined)[] = [root.current?.child]
    while (stack.length > 0) {
      const fiber = stack.pop()
      if (!fiber) continue
      visited += 1
      if (visited > STRICT_MODE_SCAN_LIMIT) return strict > 0 && loose > 0 ? 'partial' : 'unknown'
      if (isCompositeFiber(fiber)) {
        if (((fiber.mode ?? 0) & STRICT_LEGACY_MODE) !== 0) strict += 1
        else loose += 1
        if (strict > 0 && loose > 0) return 'partial'
      }
      stack.push(fiber.sibling, fiber.child)
    }
  }
  if (strict > 0) return 'on'
  return loose > 0 ? 'off' : 'unknown'
}
