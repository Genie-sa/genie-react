import { getRDTHook } from 'bippy'
import type { z } from 'zod'
import type { renderMeasurementEnvironmentSchema } from './render-contract'

type MeasurementEnvironment = z.infer<typeof renderMeasurementEnvironmentSchema>

/** Read renderer metadata from the app document; Genie's own build mode says nothing about it. */
export function getMeasurementEnvironment(): MeasurementEnvironment {
  return {
    bundle: rendererBundle(),
    timingsBundleDependent: true,
    countsScope: 'observed-run',
  }
}

function rendererBundle(): MeasurementEnvironment['bundle'] {
  let development = false
  let production = false
  try {
    for (const renderer of getRDTHook().renderers.values()) {
      if (renderer.bundleType === 1) development = true
      else if (renderer.bundleType === 0) production = true
      else return 'unknown'
    }
  } catch {
    return 'unknown'
  }
  if (development && production) return 'mixed'
  if (development) return 'development'
  if (production) return 'production'
  return 'unknown'
}
