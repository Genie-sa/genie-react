import { z } from 'zod'
import { defineCollector, defineCollectorTool, type GenieCollector } from '../client'
import { defineAgentToolContract } from '../protocol'

interface PerformanceMemory {
  readonly usedJSHeapSize?: number | null
  readonly totalJSHeapSize?: number | null
  readonly jsHeapSizeLimit?: number | null
}

interface MemoryAttribution {
  readonly url: string
  readonly scope: string
  readonly container?: { readonly id: string; readonly src: string }
}

interface MemoryBreakdownEntry {
  readonly bytes: number
  readonly attribution: readonly MemoryAttribution[]
  readonly types: readonly string[]
}

interface MemoryMeasurement {
  readonly bytes: number
  readonly breakdown: readonly MemoryBreakdownEntry[]
}

type PerformanceWithMemory = Performance & {
  memory?: PerformanceMemory
  measureUserAgentSpecificMemory?: () => Promise<MemoryMeasurement>
}

function getPerformance(): PerformanceWithMemory | undefined {
  return typeof performance === 'undefined' ? undefined : performance
}

function getPerformanceMemory(): PerformanceMemory | undefined {
  return getPerformance()?.memory
}

function getMeasureMemory(): (() => Promise<MemoryMeasurement>) | undefined {
  const perf = getPerformance()
  const measure = perf?.measureUserAgentSpecificMemory
  return typeof measure === 'function' ? measure.bind(perf) : undefined
}

function isCrossOriginIsolated(): boolean | undefined {
  return typeof crossOriginIsolated === 'undefined' ? undefined : crossOriginIsolated
}

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

export function normalizePerformanceMemory(memory: PerformanceMemory): {
  supported: boolean
  usedJSHeapSize?: number
  totalJSHeapSize?: number
  jsHeapSizeLimit?: number
} {
  const usedJSHeapSize = finiteNumber(memory.usedJSHeapSize)
  const totalJSHeapSize = finiteNumber(memory.totalJSHeapSize)
  const jsHeapSizeLimit = finiteNumber(memory.jsHeapSizeLimit)
  return {
    supported: [usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit].some(
      (value) => value !== undefined,
    ),
    ...(usedJSHeapSize !== undefined ? { usedJSHeapSize } : {}),
    ...(totalJSHeapSize !== undefined ? { totalJSHeapSize } : {}),
    ...(jsHeapSizeLimit !== undefined ? { jsHeapSizeLimit } : {}),
  }
}

const memoryBreakdownEntrySchema = z.object({
  bytes: z.number(),
  attribution: z.array(
    z.object({
      url: z.string().optional(),
      scope: z.string().optional(),
      container: z.object({ id: z.string(), src: z.string().optional() }).optional(),
    }),
  ),
  types: z.array(z.string()),
})

const browserGetMemoryContract = defineAgentToolContract({
  name: 'browser_get_memory',
  title: 'JavaScript heap usage',
  description:
    'Read the current JavaScript heap size (used/total/limit, in bytes) via performance.memory when the runtime exposes numeric fields. This is runtime-wide, not React-specific memory. Chromium and React Native/Hermes expose different fields and precision; otherwise this returns supported:false with an explanatory note.',
  group: 'memory',
  input: z.object({}),
  output: z.object({
    supported: z.boolean(),
    usedJSHeapSize: z.number().optional(),
    totalJSHeapSize: z.number().optional(),
    jsHeapSizeLimit: z.number().optional(),
    note: z.string(),
  }),
  annotations: { readOnlyHint: true },
})

const browserMeasureMemoryContract = defineAgentToolContract({
  name: 'browser_measure_memory',
  title: 'Measure page memory (standardized)',
  description:
    'Estimate the memory used by this page via the standardized performance.measureUserAgentSpecificMemory(). Returns total bytes plus a per-realm breakdown (JS heap, DOM, etc.) — page-wide browser memory, NOT React-specific memory. Requires a Chromium-based browser and a cross-origin-isolated context (COOP+COEP headers); otherwise returns supported:false with a note. Sampling can be delayed by the browser.',
  group: 'memory',
  input: z.object({}),
  output: z.object({
    supported: z.boolean(),
    bytes: z.number().optional(),
    breakdown: z.array(memoryBreakdownEntrySchema).optional(),
    note: z.string(),
  }),
  annotations: { readOnlyHint: true },
})

export function memoryCollector(): GenieCollector {
  return defineCollector({
    meta: {
      id: 'memory',
      title: 'Runtime memory',
      description: 'JavaScript runtime heap readings (not React-specific memory)',
    },
    capabilities: ['memory'],
    tools: [
      defineCollectorTool({
        contract: browserGetMemoryContract,
        handler: () => {
          const memory = getPerformanceMemory()
          if (!memory) {
            return {
              supported: false,
              note: 'performance.memory is unavailable in this runtime. Chromium and some React Native/Hermes versions expose it; other browsers and runtimes may not.',
            }
          }
          const normalized = normalizePerformanceMemory(memory)
          if (!normalized.supported) {
            return {
              supported: false,
              note: 'performance.memory is present but did not expose numeric heap fields in this runtime.',
            }
          }
          return {
            ...normalized,
            note: 'JavaScript heap reported by the current runtime, not React-specific memory. Availability and precision vary by runtime.',
          }
        },
      }),
      defineCollectorTool({
        contract: browserMeasureMemoryContract,
        handler: async () => {
          const measure = getMeasureMemory()
          if (!measure) {
            return {
              supported: false,
              note: 'performance.measureUserAgentSpecificMemory() is unavailable. It requires a Chromium-based browser and a cross-origin-isolated context (COOP "same-origin" + COEP "require-corp" headers).',
            }
          }
          if (isCrossOriginIsolated() === false) {
            return {
              supported: false,
              note: 'performance.measureUserAgentSpecificMemory() requires a cross-origin-isolated context, but crossOriginIsolated is false. Serve the app with COOP "same-origin" and COEP "require-corp" headers.',
            }
          }
          const measurement = await measure()
          return {
            supported: true,
            bytes: measurement.bytes,
            breakdown: measurement.breakdown.map((entry) => ({
              bytes: entry.bytes,
              attribution: entry.attribution.map((attribution) => ({
                url: attribution.url,
                scope: attribution.scope,
                ...(attribution.container ? { container: { ...attribution.container } } : {}),
              })),
              types: [...entry.types],
            })),
            note: 'Page-wide browser memory estimate across all realms (JS heap, DOM, etc.), not React-specific memory. The browser may delay sampling.',
          }
        },
      }),
    ],
  })
}
