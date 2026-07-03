import { z } from 'zod'
import { defineCollector, defineCollectorTool, type GenieCollector } from '../client'
import { defineAgentToolContract } from '../protocol'

/** RAIL "long task" threshold: a frame gap above this is user-perceptible jank. */
const LONG_FRAME_MS = 50
/** Refresh rates displays actually ship with; the estimate snaps to the nearest. */
const COMMON_REFRESH_RATES = [30, 60, 75, 90, 120, 144, 165, 240]

export type FpsVerdict = 'smooth' | 'degraded' | 'janky'

export interface FpsReport {
  durationMs: number
  frames: number
  avgFps: number
  /** Longest gap between two frames — the single worst stall. */
  worstFrameMs: number
  /** Frame gaps above 50ms (RAIL long-task threshold). */
  longFrames: number
  /** Frames the display should have shown but didn't, against the estimated refresh rate. */
  droppedFrames: number
  /** Estimated display refresh rate (Hz), snapped to common panel rates. */
  refreshRate: number
  /** True when the tab was hidden during sampling — rAF throttles, numbers are unreliable. */
  hidden: boolean
  verdict: FpsVerdict
}

/** react-scan's meter thresholds (<30 red, <50 amber on 60Hz) as refresh-rate ratios, plus its 150ms high-severity stall rule — one long freeze feels worse than a low average. */
export function classifyFps(report: Omit<FpsReport, 'verdict'>): FpsVerdict {
  const ratio = report.avgFps / report.refreshRate
  if (ratio < 0.5 || report.worstFrameMs >= 150) return 'janky'
  if (ratio < 0.83 || report.longFrames > 0) return 'degraded'
  return 'smooth'
}

/** Fold raw rAF frame gaps into the report; pure so tests can drive it with synthetic deltas. */
export function buildFpsReport(deltas: number[], elapsedMs: number, hidden: boolean): FpsReport {
  const refreshRate = estimateRefreshRate(deltas)
  const budgetMs = 1000 / refreshRate
  let worstFrameMs = 0
  let longFrames = 0
  let droppedFrames = 0
  for (const delta of deltas) {
    if (delta > worstFrameMs) worstFrameMs = delta
    if (delta > LONG_FRAME_MS) longFrames += 1
    droppedFrames += Math.max(0, Math.round(delta / budgetMs) - 1)
  }
  const partial = {
    durationMs: Math.round(elapsedMs),
    frames: deltas.length,
    avgFps: elapsedMs > 0 ? Math.round((deltas.length / elapsedMs) * 10000) / 10 : 0,
    worstFrameMs: Math.round(worstFrameMs * 10) / 10,
    longFrames,
    droppedFrames,
    refreshRate,
    hidden,
  }
  return { ...partial, verdict: classifyFps(partial) }
}

/** The fastest sustained deltas approximate the display interval; p10 skips one-off timer jitter. */
export function estimateRefreshRate(deltas: number[]): number {
  const positive = deltas.filter((delta) => delta > 0).sort((a, b) => a - b)
  const p10 = positive[Math.floor(positive.length * 0.1)] ?? positive[0]
  if (p10 === undefined) return 60
  const rawHz = 1000 / p10
  return COMMON_REFRESH_RATES.reduce((nearest, rate) =>
    Math.abs(rate - rawHz) < Math.abs(nearest - rawHz) ? rate : nearest,
  )
}

/** Counts rAF callbacks for `durationMs`, starting at the first frame so every delta is a real frame interval. */
export function sampleFps(durationMs: number): Promise<FpsReport> {
  if (typeof requestAnimationFrame !== 'function') {
    throw new Error('No requestAnimationFrame in this environment.')
  }
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    throw new Error(
      'The tab is hidden — requestAnimationFrame is paused, so FPS cannot be measured. Focus the tab and retry.',
    )
  }
  return new Promise((resolve) => {
    const deltas: number[] = []
    let start = 0
    let last = 0
    let hidden = false
    let done = false
    const finish = (elapsedMs: number) => {
      if (done) return
      done = true
      clearTimeout(bail)
      resolve(buildFpsReport(deltas, elapsedMs, hidden))
    }
    // rAF stops when the tab hides mid-sample; report what we have (within the CLI's 20s invoke timeout) instead of hanging the caller.
    const bail = setTimeout(() => {
      hidden = true
      finish(last - start)
    }, durationMs + 5000)
    const tick = (timestamp: number) => {
      if (done) return
      if (start === 0) {
        start = timestamp
        last = timestamp
        requestAnimationFrame(tick)
        return
      }
      deltas.push(timestamp - last)
      last = timestamp
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') hidden = true
      if (timestamp - start >= durationMs) {
        finish(timestamp - start)
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

const browserFpsContract = defineAgentToolContract({
  name: 'browser_fps',
  title: 'FPS / frame health',
  description:
    'Sample the page frame rate for `durationMs` via requestAnimationFrame and report avg FPS, the worst single stall (worstFrameMs), long frames (>50ms), and frames dropped against the estimated display refresh rate — plus a smooth/degraded/janky verdict. Page-wide (main-thread) frame health, not React-specific; start an animation or interaction first, then sample it. The sample blocks for its duration, so drive the interaction from another call or beforehand.',
  group: 'perf',
  input: z.object({
    durationMs: z
      .number()
      .int()
      .min(250)
      .max(10000)
      .default(5000)
      .describe('How long to sample. Longer is steadier; 5000ms suits most interactions.'),
  }),
  output: z.object({
    durationMs: z.number(),
    frames: z.number(),
    avgFps: z.number(),
    worstFrameMs: z.number(),
    longFrames: z.number(),
    droppedFrames: z.number(),
    refreshRate: z.number(),
    hidden: z
      .boolean()
      .describe('True when the tab was hidden during sampling — numbers are unreliable.'),
    verdict: z.enum(['smooth', 'degraded', 'janky']),
  }),
  annotations: { readOnlyHint: true },
})

export function perfCollector(): GenieCollector {
  return defineCollector({
    meta: {
      id: 'perf',
      title: 'Frame performance',
      description: 'FPS sampling and frame health (page-wide, not React-specific)',
    },
    capabilities: ['perf'],
    tools: [
      defineCollectorTool({
        contract: browserFpsContract,
        handler: ({ durationMs }) => sampleFps(durationMs),
      }),
    ],
  })
}
