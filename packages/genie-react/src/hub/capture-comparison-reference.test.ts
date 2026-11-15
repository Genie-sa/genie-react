import { describe, expect, it } from 'vitest'
import type { CaptureArtifact } from '../protocol'
import { compareCaptureCohorts } from './capture-comparison'

const CREATED_AT = Date.parse('2026-07-13T08:00:00.000Z')

function renderCapture(id: string, renders: number, createdAtOffsetMs = 0): CaptureArtifact {
  return {
    schemaVersion: '1.0',
    captureId: id,
    name: id,
    createdAt: new Date(CREATED_AT + createdAtOffsetMs).toISOString(),
    session: { sessionId: 'session', app: { name: 'demo', reactVersion: '19.2.7' } },
    include: ['react'],
    consistency: { kind: 'react-commit-stable', attempts: 1, reactCommit: 1, reason: 'stable' },
    sections: {
      react: {
        status: 'ok',
        tools: {
          react_get_renders: {
            status: 'ok',
            capturedAt: new Date(CREATED_AT + createdAtOffsetMs).toISOString(),
            durationMs: 1,
            result: {
              observation: { id: `observation:${id}` },
              summary: { totalRenders: renders, semantics: 'exact' },
              comparable: true,
              notComparableReasons: [],
              components: [],
            },
          },
        },
      },
    },
    complete: true,
    warnings: [],
    sizeBytes: 1_000,
  }
}

function cohort(prefix: string, values: number[], startMs = 0): CaptureArtifact[] {
  return values.map((value, index) =>
    renderCapture(`${prefix}${index}`, value, startMs + index * 1_000),
  )
}

interface Policy {
  warmupRuns?: number
  minimumRuns?: number
  minimumEffectPct?: number
  maxRegressionPct?: number
}

function compareRenders(baseline: CaptureArtifact[], candidate: CaptureArtifact[], policy: Policy) {
  const result = compareCaptureCohorts(
    baseline,
    candidate,
    {
      baselineCaptureIds: baseline.map((capture) => capture.captureId),
      candidateCaptureIds: candidate.map((capture) => capture.captureId),
      metrics: ['react.renders'],
      minimumRuns: policy.minimumRuns ?? 5,
      warmupRuns: policy.warmupRuns ?? 0,
      outlierThreshold: 3.5,
      confidenceLevel: 0.95,
      minimumEffectPct: policy.minimumEffectPct ?? 5,
      budgets:
        policy.maxRegressionPct === undefined
          ? []
          : [{ metric: 'react.renders', maxRegressionPct: policy.maxRegressionPct }],
    },
    { comparisonId: 'cmp_reference', createdAt: '2026-07-13T09:00:00.000Z' },
  )
  const metric = result.metrics[0]
  if (!metric) throw new Error('missing react.renders metric')
  return { result, metric }
}

function referenceMedian(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
}

function referenceMean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** Brute force over every bitmask of the pooled sample, independent of the production enumeration. */
function referencePermutationP(baseline: number[], candidate: number[]): number {
  const pooled = [...baseline, ...candidate]
  const observed = Math.abs(referenceMean(candidate) - referenceMean(baseline))
  const tolerance = 1e-9 * Math.max(1, ...pooled.map(Math.abs))
  let total = 0
  let extreme = 0
  for (let mask = 0; mask < 1 << pooled.length; mask += 1) {
    const left: number[] = []
    const right: number[] = []
    pooled.forEach((value, index) => {
      if (mask & (1 << index)) left.push(value)
      else right.push(value)
    })
    if (left.length !== baseline.length) continue
    total += 1
    if (Math.abs(referenceMean(right) - referenceMean(left)) >= observed - tolerance) extreme += 1
  }
  return extreme / total
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

describe('capture comparison statistics against an independent reference', () => {
  it.each([
    [
      [10, 12, 11, 13, 12],
      [14, 15, 13, 16, 15],
    ],
    [
      [100, 101, 99, 100, 102, 98],
      [100, 103, 97, 101, 99, 100],
    ],
    [
      [5, 5, 6, 5, 6],
      [6, 6, 5, 6, 6],
    ],
    [
      [3.25, 7.5, 1.125, 9, 4],
      [8, 2.5, 6.75, 3, 10, 5.5],
    ],
  ])('matches the reference median and permutation p-value for %j vs %j', (before, after) => {
    const { metric } = compareRenders(cohort('b', before), cohort('c', after, 60_000), {
      minimumRuns: 1,
    })
    expect(metric.baseline.median).toBe(referenceMedian(before))
    expect(metric.candidate.median).toBe(referenceMedian(after))
    expect(metric.confidence.pValue).toBeCloseTo(referencePermutationP(before, after), 4)
  })

  it('reports p = 1 and no change for identical cohorts', () => {
    const { metric, result } = compareRenders(
      cohort('b', [7, 7, 7, 7, 7]),
      cohort('c', [7, 7, 7, 7, 7], 60_000),
      { maxRegressionPct: 0 },
    )
    expect(metric).toMatchObject({
      delta: { median: 0, regressionPct: 0 },
      confidence: { pValue: 1, significant: false },
      outlierBaselineCaptureIds: [],
      outlierCandidateCaptureIds: [],
    })
    expect(result.overall).toBe('pass')
  })

  it('keeps tied integer counts whose median absolute deviation is zero', () => {
    const { metric } = compareRenders(
      cohort('b', [5, 5, 5, 5, 5, 6, 6]),
      cohort('c', [6, 6, 6, 6, 6, 5, 5], 60_000),
      { maxRegressionPct: 0 },
    )
    expect(metric.outlierBaselineCaptureIds).toEqual([])
    expect(metric.outlierCandidateCaptureIds).toEqual([])
    expect(metric.baseline.samples).toBe(7)
    expect(metric.confidence.pValue).toBeCloseTo(
      referencePermutationP([5, 5, 5, 5, 5, 6, 6], [6, 6, 6, 6, 6, 5, 5]),
      4,
    )
    expect(metric.verdict).not.toBe('fail')
  })

  it('still rejects a single extreme outlier in a tied cohort', () => {
    const { metric } = compareRenders(
      cohort('b', [10, 10, 10, 10, 10]),
      cohort('c', [10, 10, 10, 10, 1_000], 60_000),
      { minimumRuns: 4, maxRegressionPct: 0 },
    )
    expect(metric.outlierCandidateCaptureIds).toEqual(['c4'])
    expect(metric).toMatchObject({ candidate: { samples: 4, median: 10 }, verdict: 'pass' })
  })

  it('discards the earliest capture as warm-up whatever order the IDs arrive in', () => {
    const baseline = cohort('b', [500, 10, 10, 10, 10, 10])
    const candidate = cohort('c', [500, 10, 10, 10, 10, 10], 60_000)
    const { result, metric } = compareRenders([...baseline].reverse(), [...candidate].reverse(), {
      warmupRuns: 1,
    })
    expect(result.excluded).toEqual({
      warmupBaselineCaptureIds: ['b0'],
      warmupCandidateCaptureIds: ['c0'],
    })
    expect(metric.baseline).toMatchObject({ samples: 5, max: 10 })
  })

  it('treats large-magnitude ties exactly when counting permutations as extreme', () => {
    const base = 4_000_000_000.1
    const before = [base + 0.1, base + 0.2, base + 0.3]
    const after = [base + 0.2, base + 0.3, base + 0.4]
    const { metric } = compareRenders(cohort('b', before), cohort('c', after, 60_000), {
      minimumRuns: 1,
    })
    expect(metric.confidence.pValue).toBeCloseTo(referencePermutationP(before, after), 4)
  })

  describe('A/A comparisons of the same build', () => {
    const TRIALS = 1_000
    const RUNS = 6
    const ALPHA = 0.05
    // Three binomial standard deviations above the stated level, so the bound tolerates sampling noise but not a doubled rate.
    const BOUND = ALPHA + 3 * Math.sqrt((ALPHA * (1 - ALPHA)) / TRIALS)

    function falseClaims(draw: (random: () => number) => number, seed: number) {
      const random = mulberry32(seed)
      let regressions = 0
      let changes = 0
      for (let trial = 0; trial < TRIALS; trial += 1) {
        const before = Array.from({ length: RUNS }, () => draw(random))
        const after = Array.from({ length: RUNS }, () => draw(random))
        const { metric } = compareRenders(cohort('b', before), cohort('c', after, 60_000), {
          maxRegressionPct: 0,
        })
        if (metric.verdict === 'fail') regressions += 1
        if (
          metric.confidence.significant &&
          Math.abs(metric.delta.regressionPct ?? 0) >= metric.confidence.minimumEffectPct
        )
          changes += 1
      }
      return { regressionRate: regressions / TRIALS, changeRate: changes / TRIALS }
    }

    it('keeps false regressions and improvements within the 5% level for tied counts', () => {
      const rates = falseClaims((random) => (random() < 0.7 ? 20 : 21), 1)
      expect(rates.regressionRate).toBeLessThanOrEqual(BOUND)
      expect(rates.changeRate).toBeLessThanOrEqual(BOUND)
    })

    it('keeps false regressions and improvements within the 5% level for skewed timings', () => {
      const rates = falseClaims((random) => {
        const normal = Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
        return Math.round(Math.exp(3 + 0.4 * normal) * 100) / 100
      }, 2)
      expect(rates.regressionRate).toBeLessThanOrEqual(BOUND)
      expect(rates.changeRate).toBeLessThanOrEqual(BOUND)
    })

    it('returns the same verdict whatever order the capture IDs arrive in', () => {
      const random = mulberry32(7)
      const before = cohort(
        'b',
        Array.from({ length: RUNS }, () => (random() < 0.5 ? 3 : 4)),
      )
      const after = cohort(
        'c',
        Array.from({ length: RUNS }, () => (random() < 0.5 ? 3 : 4)),
        60_000,
      )
      const forward = compareRenders(before, after, { warmupRuns: 1, maxRegressionPct: 0 })
      const shuffled = compareRenders(
        [...before].reverse(),
        [after[2], ...after.slice(3), ...after.slice(0, 2)].filter(
          (capture): capture is CaptureArtifact => capture !== undefined,
        ),
        {
          warmupRuns: 1,
          maxRegressionPct: 0,
        },
      )
      expect(shuffled.metric).toEqual(forward.metric)
    })
  })
})
