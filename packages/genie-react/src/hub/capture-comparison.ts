import {
  type CaptureArtifact,
  type CaptureComparison,
  type CaptureMetric,
  type devtoolsCaptureCompareContract,
  INPUT_ATTRIBUTION_REASONS,
  type ToolInput,
} from '../protocol'
import type { RendererBundle } from './verify/evidence'
import { hostingRendererProblem } from './verify/guards'

type ComparisonInput = ToolInput<typeof devtoolsCaptureCompareContract>
type ParsedComparisonInput = ComparisonInput & {
  metrics: CaptureMetric[]
  minimumRuns: number
  warmupRuns: number
  outlierThreshold: number
  confidenceLevel: number
  minimumEffectPct: number
  budgets: NonNullable<ComparisonInput['budgets']>
}
type MetricResult = CaptureComparison['metrics'][number]
type MetricBudget = NonNullable<MetricResult['budget']>

const METRIC_DIRECTIONS: Record<CaptureMetric, MetricResult['direction']> = {
  'react.commits': 'lower-is-better',
  'react.renders': 'lower-is-better',
  'react.updates': 'lower-is-better',
  'react.unnecessary': 'lower-is-better',
  'react.selfTimeMs': 'lower-is-better',
  'effects.hot': 'lower-is-better',
  'query.pending': 'lower-is-better',
  'memory.usedHeapBytes': 'lower-is-better',
  'performance.avgFps': 'higher-is-better',
  'performance.droppedFrames': 'lower-is-better',
}

const CAUSE_DEPENDENT_METRICS: ReadonlySet<CaptureMetric> = new Set(['react.unnecessary'])

// Partial render-cause attribution leaves render counts and timings exact, so only cause-derived metrics are gated by it.
const ATTRIBUTION_ONLY_REASONS: ReadonlySet<string> = new Set(INPUT_ATTRIBUTION_REASONS)

// appOnly totals keep unknown-ownership components, so they are exact for whichever components are unknown; commits do not depend on ownership at all.
const CLASSIFICATION_INCOMPLETE = 'app-source-classification-incomplete'
const OWNERSHIP_INDEPENDENT_METRICS: ReadonlySet<CaptureMetric> = new Set(['react.commits'])

// A commit by a renderer Genie does not analyze (the Next.js dev overlay's production React) counts as a failed fiber analysis without touching any counted component.
const ANALYSIS_FAILED = 'fiber-analysis-failed'
const RENDERER_NOT_ANALYZED = 'renderer-not-analyzed'

export function compareCaptureCohorts(
  baseline: CaptureArtifact[],
  candidate: CaptureArtifact[],
  input: ParsedComparisonInput,
  identity: { comparisonId: string; createdAt: string },
): CaptureComparison {
  baseline = chronological(baseline)
  candidate = chronological(candidate)
  const warmupBaselineCaptureIds = baseline
    .slice(0, input.warmupRuns)
    .map((capture) => capture.captureId)
  const warmupCandidateCaptureIds = candidate
    .slice(0, input.warmupRuns)
    .map((capture) => capture.captureId)
  const usableBaseline = baseline.slice(input.warmupRuns)
  const usableCandidate = candidate.slice(input.warmupRuns)
  const budgets = new Map(input.budgets.map((budget) => [budget.metric, budget]))
  const hygiene = sampleHygiene(baseline, candidate)
  const metrics = input.metrics.map((metric) =>
    compareMetric(metric, usableBaseline, usableCandidate, input, budgets.get(metric), [
      ...hygiene.reasons,
      ...(metric.startsWith('react.') ? hygiene.renderReasons : []),
    ]),
  )
  const budgeted = metrics.filter((metric) => metric.budget !== undefined)
  const violations = budgeted
    .filter((metric) => metric.verdict === 'fail')
    .map((metric) => ({ metric: metric.metric, reasons: metric.reasons }))
  const overall: CaptureComparison['overall'] =
    hygiene.reasons.length > 0
      ? 'not-comparable'
      : budgeted.length === 0
        ? 'informational'
        : violations.length > 0
          ? 'fail'
          : budgeted.some((metric) => metric.verdict === 'not-comparable')
            ? 'not-comparable'
            : budgeted.some((metric) => metric.verdict === 'insufficient-data')
              ? 'insufficient-data'
              : budgeted.some((metric) => metric.verdict === 'inconclusive')
                ? 'inconclusive'
                : 'pass'

  return {
    schemaVersion: '1.0',
    kind: 'capture-comparison',
    comparisonId: identity.comparisonId,
    createdAt: identity.createdAt,
    minimumRuns: input.minimumRuns,
    policy: {
      warmupRuns: input.warmupRuns,
      outlierThreshold: input.outlierThreshold,
      confidenceLevel: input.confidenceLevel,
      minimumEffectPct: input.minimumEffectPct,
    },
    excluded: { warmupBaselineCaptureIds, warmupCandidateCaptureIds },
    baselineCaptureIds: baseline.map((capture) => capture.captureId),
    candidateCaptureIds: candidate.map((capture) => capture.captureId),
    overall,
    notComparableReasons: hygiene.reasons,
    metrics,
    violations,
    warnings: input.metrics.some((metric) => metric.startsWith('react.'))
      ? [...hygiene.warnings, ...renderScopeWarnings([...baseline, ...candidate])]
      : hygiene.warnings,
  }
}

/** Warm-up means the first runs taken, so cohorts are ordered by capture time, not by the order the caller listed IDs. */
function chronological(captures: CaptureArtifact[]): CaptureArtifact[] {
  return [...captures].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
  )
}

function compareMetric(
  metric: CaptureMetric,
  baseline: CaptureArtifact[],
  candidate: CaptureArtifact[],
  input: ParsedComparisonInput,
  budget: MetricBudget | undefined,
  hygieneReasons: string[],
): MetricResult {
  const baselineSamples = samplesFor(metric, baseline)
  const candidateSamples = samplesFor(metric, candidate)
  const isOutlier = pooledOutlierRule(
    [...baselineSamples.samples, ...candidateSamples.samples],
    input.outlierThreshold,
  )
  const baselineFiltered = partitionOutliers(baselineSamples.samples, isOutlier)
  const candidateFiltered = partitionOutliers(candidateSamples.samples, isOutlier)
  const baselineValues = baselineFiltered.kept.map((sample) => sample.value)
  const candidateValues = candidateFiltered.kept.map((sample) => sample.value)
  const baselineStats = summarizeSamples(baselineValues)
  const candidateStats = summarizeSamples(candidateValues)
  const medianDelta = nullableDifference(candidateStats.median, baselineStats.median)
  const regressionPct = metricRegressionPct(
    METRIC_DIRECTIONS[metric],
    baselineStats.median,
    candidateStats.median,
  )
  const sampleFloor = Math.min(baselineStats.samples, candidateStats.samples)
  const notComparableReasons = unique([
    ...hygieneReasons,
    ...baselineSamples.notComparableReasons,
    ...candidateSamples.notComparableReasons,
    ...crossCohortReasons(metric, baselineSamples, candidateSamples),
  ])
  const reasons: string[] = [...notComparableReasons]
  let verdict: MetricResult['verdict'] = budget ? 'pass' : 'informational'
  const confidence = comparisonConfidence(
    baselineValues,
    candidateValues,
    baselineStats,
    candidateStats,
    regressionPct,
    input,
  )

  if (notComparableReasons.length > 0) {
    verdict = 'not-comparable'
  } else if (sampleFloor < input.minimumRuns) {
    verdict = 'insufficient-data'
    reasons.push(
      `requires ${input.minimumRuns} usable samples per cohort after warm-up and outlier exclusion; found ${baselineStats.samples} baseline and ${candidateStats.samples} candidate`,
    )
  } else if (budget && candidateStats.median !== null) {
    if (budget.maxValue !== undefined && candidateStats.median > budget.maxValue) {
      verdict = 'fail'
      reasons.push(`candidate median ${candidateStats.median} exceeds maxValue ${budget.maxValue}`)
    }
    if (budget.minValue !== undefined && candidateStats.median < budget.minValue) {
      verdict = 'fail'
      reasons.push(`candidate median ${candidateStats.median} is below minValue ${budget.minValue}`)
    }
    if (budget.maxRegressionPct !== undefined) {
      if (regressionPct === null) {
        verdict = verdict === 'fail' ? 'fail' : 'insufficient-data'
        reasons.push('percentage regression is undefined because the baseline median is zero')
      } else if (regressionPct > budget.maxRegressionPct) {
        if (Math.abs(regressionPct) < input.minimumEffectPct || !confidence.significant) {
          verdict = verdict === 'fail' ? 'fail' : 'inconclusive'
          reasons.push(
            `regression ${regressionPct}% exceeds maxRegressionPct ${budget.maxRegressionPct}% but does not clear the ${input.minimumEffectPct}% practical-effect and ${input.confidenceLevel} confidence gates`,
          )
        } else {
          verdict = 'fail'
          reasons.push(
            `regression ${regressionPct}% exceeds maxRegressionPct ${budget.maxRegressionPct}% with ${confidence.achieved ?? 0} confidence`,
          )
        }
      }
    }
  } else if (regressionPct !== null) {
    reasons.push(
      confidence.significant && Math.abs(regressionPct) >= input.minimumEffectPct
        ? `${regressionPct > 0 ? 'regressed' : 'improved'} ${Math.abs(regressionPct)}% (median ${baselineStats.median} -> ${candidateStats.median}, p=${confidence.pValue})`
        : `no significant change (${regressionPct}%, p=${confidence.pValue}); pass budgets to gate on it`,
    )
  }

  return {
    metric,
    direction: METRIC_DIRECTIONS[metric],
    baseline: baselineStats,
    candidate: candidateStats,
    missingBaselineCaptureIds: baselineSamples.missing,
    missingCandidateCaptureIds: candidateSamples.missing,
    excludedCaptureIds: { ...baselineSamples.excluded, ...candidateSamples.excluded },
    outlierBaselineCaptureIds: baselineFiltered.rejected.map((sample) => sample.captureId),
    outlierCandidateCaptureIds: candidateFiltered.rejected.map((sample) => sample.captureId),
    comparable: notComparableReasons.length === 0,
    notComparableReasons,
    delta: { median: medianDelta, regressionPct },
    ...(budget ? { budget } : {}),
    confidence,
    verdict,
    reasons,
  }
}

function samplesFor(metric: CaptureMetric, captures: CaptureArtifact[]): SampleCollection {
  const samples: MetricSample[] = []
  const missing: string[] = []
  const excluded: Record<string, string[]> = {}
  const notComparableReasons: string[] = []
  const refreshRates: number[] = []
  const coverageSignatures: string[] = []
  const ownershipSignatures: string[] = []
  for (const capture of captures) {
    const evidence = metricEvidence(capture, metric)
    if (metric.startsWith('react.')) {
      coverageSignatures.push(evidence.coverageSignature ?? 'unreported')
    }
    if (!evidence.comparable) {
      notComparableReasons.push(...evidence.reasons)
      missing.push(capture.captureId)
      excluded[capture.captureId] = evidence.reasons
      continue
    }
    const value = captureMetricValue(capture, metric)
    if (value === null) {
      missing.push(capture.captureId)
      excluded[capture.captureId] = ['metric-value-unavailable']
    } else {
      samples.push({ captureId: capture.captureId, value })
    }
    if (evidence.refreshRate !== null) refreshRates.push(evidence.refreshRate)
    if (evidence.ownershipSignature !== null) ownershipSignatures.push(evidence.ownershipSignature)
  }
  return {
    samples,
    missing,
    excluded,
    notComparableReasons,
    refreshRates,
    coverageSignatures,
    ownershipSignatures,
  }
}

interface MetricSample {
  captureId: string
  value: number
}

interface SampleCollection {
  samples: MetricSample[]
  missing: string[]
  excluded: Record<string, string[]>
  notComparableReasons: string[]
  refreshRates: number[]
  coverageSignatures: string[]
  /** The unknown-ownership components each comparable sample counted, for metrics that sum components. */
  ownershipSignatures: string[]
}

interface MetricEvidence {
  comparable: boolean
  reasons: string[]
  refreshRate: number | null
  coverageSignature: string | null
  ownershipSignature: string | null
}

function metricEvidence(capture: CaptureArtifact, metric: CaptureMetric): MetricEvidence {
  const neutral = { refreshRate: null, coverageSignature: null, ownershipSignature: null }
  if (metric.startsWith('react.')) {
    const result = toolResult(capture, 'react', 'react_get_renders')
    if (!isRecord(result)) return { comparable: true, reasons: [], ...neutral }
    const causeDependent = CAUSE_DEPENDENT_METRICS.has(metric)
    const coverageSignature = renderCoverageSignature(result, causeDependent)
    const withCoverage = { ...neutral, coverageSignature }
    if (
      (metric === 'react.unnecessary' || metric === 'react.selfTimeMs') &&
      finiteNumber(result.omittedByLimit) !== null &&
      (finiteNumber(result.omittedByLimit) ?? 0) > 0
    ) {
      return { comparable: false, reasons: ['render-component-list-truncated'], ...withCoverage }
    }
    const reported =
      result.comparable === false
        ? stringArray(result.notComparableReasons, 'render-evidence-not-comparable')
        : []
    const unknownComponents = reported.includes(CLASSIFICATION_INCOMPLETE)
      ? countedUnknownComponents(result)
      : []
    const ownershipSignature = unknownComponents === null ? null : JSON.stringify(unknownComponents)
    const excused = (reason: string): boolean =>
      (!causeDependent && ATTRIBUTION_ONLY_REASONS.has(reason)) ||
      (reason === CLASSIFICATION_INCOMPLETE &&
        (OWNERSHIP_INDEPENDENT_METRICS.has(metric) || ownershipSignature !== null)) ||
      (reason === ANALYSIS_FAILED && onlyUnanalyzedRenderersFailed(result))
    const reasons = reported.filter((reason) => !excused(reason))
    if (reasons.length > 0) return { comparable: false, reasons, ...withCoverage }
    // Both excused reasons downgrade the summary's semantics on their own, so they also explain a non-exact summary.
    const summaryExplained = reported.some(
      (reason) => reason === CLASSIFICATION_INCOMPLETE || reason === ANALYSIS_FAILED,
    )
    const semantics = isRecord(result.summary) ? result.summary.semantics : undefined
    if (semantics !== 'exact' && !summaryExplained) {
      return {
        comparable: false,
        reasons: ['render-evidence-semantics-not-exact'],
        ...withCoverage,
      }
    }
    return {
      comparable: true,
      reasons: [],
      ...withCoverage,
      ownershipSignature: OWNERSHIP_INDEPENDENT_METRICS.has(metric) ? null : ownershipSignature,
    }
  }
  if (metric.startsWith('performance.')) {
    const result = toolResult(capture, 'performance', 'browser_fps')
    if (!isRecord(result)) return { comparable: true, reasons: [], ...neutral }
    const refreshRate = finiteNumber(result.refreshRate)
    if (result.hidden === true || result.comparable === false) {
      return {
        comparable: false,
        reasons: stringArray(
          result.notComparableReasons,
          result.hidden === true ? 'document-hidden-during-sample' : 'fps-not-comparable',
        ),
        ...neutral,
        refreshRate,
      }
    }
    return { comparable: true, reasons: [], ...neutral, refreshRate }
  }
  return { comparable: true, reasons: [], ...neutral }
}

/** The unknown-ownership components a capture counted, or null when the capture did not name all of them. */
function countedUnknownComponents(result: Record<string, unknown>): string[] | null {
  const classification = isRecord(result.sourceClassification) ? result.sourceClassification : null
  if (!classification || !Array.isArray(classification.unknownComponents)) return null
  if (finiteNumber(classification.unknownComponentsOmitted) !== 0) return null
  return stringArray(classification.unknownComponents, '').filter(Boolean).sort()
}

/** Whether every failed fiber analysis was a commit by a renderer Genie does not analyze, and verify's renderer rule accepts the page. */
function onlyUnanalyzedRenderersFailed(result: Record<string, unknown>): boolean {
  const coverage = isRecord(result.coverage) ? result.coverage : null
  const failed = finiteNumber(coverage?.analysisFailedFibers)
  if (!coverage || !failed || !Array.isArray(coverage.incompleteBecause)) return false
  const unanalyzed = coverage.incompleteBecause.reduce(
    (sum: number, entry: unknown) =>
      isRecord(entry) && entry.reason === RENDERER_NOT_ANALYZED
        ? sum + (finiteNumber(entry.fibers) ?? 0)
        : sum,
    0,
  )
  // Counts only ever include components on the development renderers Genie analyzes, so those host everything compared.
  return (
    unanalyzed === failed && hostingRendererProblem(pageBundle(result), ['development']) === null
  )
}

function pageBundle(result: Record<string, unknown>): RendererBundle {
  const { bundle } = result
  return bundle === 'development' || bundle === 'mixed' || bundle === 'production'
    ? bundle
    : 'unknown'
}

/** What render metrics did and did not count, when a capture relied on an excused gap. */
function renderScopeWarnings(captures: CaptureArtifact[]): string[] {
  const unanalyzed: string[] = []
  const unknown = new Set<string>()
  for (const capture of captures) {
    const result = toolResult(capture, 'react', 'react_get_renders')
    if (!isRecord(result) || result.comparable !== false) continue
    const reported = stringArray(result.notComparableReasons, '')
    if (reported.includes(ANALYSIS_FAILED) && onlyUnanalyzedRenderersFailed(result)) {
      unanalyzed.push(capture.captureId)
    }
    if (reported.includes(CLASSIFICATION_INCOMPLETE)) {
      for (const name of countedUnknownComponents(result) ?? []) unknown.add(name)
    }
  }
  const warnings: string[] = []
  if (unanalyzed.length > 0) {
    warnings.push(
      `A React renderer Genie does not analyze (a production build, such as the Next.js dev overlay) committed in ${unanalyzed.join(', ')}; it hosts none of the counted components, so render metrics cover the development renderer only.`,
    )
  }
  if (unknown.size > 0) {
    warnings.push(
      `Ownership of ${[...unknown].sort().join(', ')} is unknown; app-only render totals count them, and component metrics are compared only when every capture names the same ones.`,
    )
  }
  return warnings
}

function crossCohortReasons(
  metric: CaptureMetric,
  baseline: SampleCollection,
  candidate: SampleCollection,
): string[] {
  const reasons: string[] = []
  if (metric.startsWith('react.')) {
    const signatures = new Set([...baseline.coverageSignatures, ...candidate.coverageSignatures])
    if (signatures.size > 1) reasons.push('render-coverage-policy-mismatch-between-cohorts')
    const ownership = new Set([...baseline.ownershipSignatures, ...candidate.ownershipSignatures])
    if (ownership.size > 1) reasons.push('unknown-ownership-differs-between-captures')
  }
  if (metric.startsWith('performance.')) {
    const rates = new Set([...baseline.refreshRates, ...candidate.refreshRates])
    if (rates.size > 1) reasons.push('inferred-refresh-rate-mode-mismatch')
  }
  return reasons
}

function renderCoverageSignature(
  result: Record<string, unknown>,
  includeAttribution: boolean,
): string | null {
  const coverage = isRecord(result.coverage) ? result.coverage : null
  if (!coverage) return null
  const targeted = isRecord(coverage.targeted) ? coverage.targeted : null
  const observationBudget = isRecord(coverage.observationBudget) ? coverage.observationBudget : null
  return JSON.stringify({
    ...(includeAttribution
      ? {
          complete: coverage.complete ?? null,
          inputAttributionComplete: coverage.inputAttributionComplete ?? null,
          semantics: coverage.semantics ?? null,
        }
      : {}),
    coverageDomain: coverage.coverageDomain ?? null,
    targeted: targeted
      ? {
          components: stringArray(targeted.components, '').filter(Boolean).sort(),
          roots: numberArray(targeted.roots).sort((left, right) => left - right),
        }
      : null,
    observationBudget: observationBudget
      ? {
          adaptive: observationBudget.adaptive ?? null,
          adaptiveScale: observationBudget.adaptiveScale ?? null,
          fiberLimit: observationBudget.fiberLimit ?? null,
          operationLimit: observationBudget.operationLimit ?? null,
          timeLimitMs: observationBudget.timeLimitMs ?? null,
          targetOperationReserve: observationBudget.targetOperationReserve ?? null,
          targetTimeReserveMs: observationBudget.targetTimeReserveMs ?? null,
          lifecycleBufferLimit: observationBudget.lifecycleBufferLimit ?? null,
          lifecycleTargetReserve: observationBudget.lifecycleTargetReserve ?? null,
        }
      : null,
  })
}

/** Modified z-scores (Iglewicz and Hoaglin) over both cohorts pooled: a label-blind rule keeps the permutation test exact where per-cohort trimming inflates false A/A changes, and a zero MAD falls back to the mean absolute deviation instead of rejecting every value off the median. */
function pooledOutlierRule(samples: MetricSample[], threshold: number): (value: number) => boolean {
  if (samples.length < 3) return () => false
  const values = samples.map((sample) => sample.value).sort((left, right) => left - right)
  const median = quantile(values, 0.5)
  const deviations = values.map((value) => Math.abs(value - median)).sort((a, b) => a - b)
  const mad = quantile(deviations, 0.5)
  const meanDeviation = deviations.reduce((sum, value) => sum + value, 0) / deviations.length
  const scale = mad > 0 ? mad / 0.6745 : meanDeviation * 1.253314
  return (value) => scale > 0 && Math.abs(value - median) / scale > threshold
}

function partitionOutliers(
  samples: MetricSample[],
  isOutlier: (value: number) => boolean,
): { kept: MetricSample[]; rejected: MetricSample[] } {
  const kept: MetricSample[] = []
  const rejected: MetricSample[] = []
  for (const sample of samples) (isOutlier(sample.value) ? rejected : kept).push(sample)
  return { kept, rejected }
}

export function summarizeSamples(values: number[]): MetricResult['baseline'] {
  if (values.length === 0) {
    return { samples: 0, median: null, p95: null, mad: null, min: null, max: null }
  }
  const sorted = [...values].sort((left, right) => left - right)
  const median = quantile(sorted, 0.5)
  const deviations = sorted.map((value) => Math.abs(value - median)).sort((a, b) => a - b)
  return {
    samples: sorted.length,
    median: round4(median),
    p95: round4(quantile(sorted, 0.95)),
    mad: round4(quantile(deviations, 0.5)),
    min: round4(sorted[0] ?? 0),
    max: round4(sorted.at(-1) ?? 0),
  }
}

function comparisonConfidence(
  baseline: number[],
  candidate: number[],
  baselineStats: MetricResult['baseline'],
  candidateStats: MetricResult['candidate'],
  observedEffectPct: number | null,
  input: ParsedComparisonInput,
): MetricResult['confidence'] {
  const pValue = permutationPValue(baseline, candidate)
  const baselineScale = Math.abs(baselineStats.median ?? 0)
  const pooledMad = Math.max(baselineStats.mad ?? 0, candidateStats.mad ?? 0)
  const noiseFloorPct =
    baselineScale > 0 ? round4(((pooledMad * 1.4826) / baselineScale) * 100) : null
  const achieved = pValue === null ? null : round4(1 - pValue)
  return {
    level: input.confidenceLevel,
    pValue,
    achieved,
    significant: pValue !== null && pValue <= 1 - input.confidenceLevel,
    minimumEffectPct: input.minimumEffectPct,
    observedEffectPct,
    noiseFloorPct,
  }
}

/** Exact two-sided permutation test over the mean difference after robust outlier rejection. */
function permutationPValue(baseline: number[], candidate: number[]): number | null {
  if (baseline.length === 0 || candidate.length === 0) return null
  const combined = [...baseline, ...candidate]
  const baselineSize = baseline.length
  const candidateSize = candidate.length
  const total = combined.reduce((sum, value) => sum + value, 0)
  // Each split's mean difference follows from its baseline sum, so the walk carries one number instead of allocating index sets.
  const meanDifference = (baselineSum: number): number =>
    Math.abs((total - baselineSum) / candidateSize - baselineSum / baselineSize)
  const observed = meanDifference(baseline.reduce((sum, value) => sum + value, 0))
  // Sums of large values accumulate rounding far above Number.EPSILON, so ties are judged relative to the data's magnitude.
  const tolerance = 1e-9 * Math.max(1, ...combined.map((value) => Math.abs(value)))
  let permutations = 0
  let atLeastAsExtreme = 0

  const visit = (start: number, chosen: number, baselineSum: number): void => {
    if (chosen === baselineSize) {
      permutations += 1
      if (meanDifference(baselineSum) >= observed - tolerance) atLeastAsExtreme += 1
      return
    }
    const remaining = baselineSize - chosen
    for (let index = start; index <= combined.length - remaining; index += 1) {
      visit(index + 1, chosen + 1, baselineSum + (combined[index] ?? 0))
    }
  }
  visit(0, 0, 0)
  return permutations === 0 ? null : round4(atLeastAsExtreme / permutations)
}

/** Type-7 linear quantile, matching the common R/NumPy default and behaving sensibly for small samples. */
function quantile(sorted: number[], probability: number): number {
  if (sorted.length === 1) return sorted[0] ?? 0
  const position = (sorted.length - 1) * probability
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const lower = sorted[lowerIndex] ?? 0
  const upper = sorted[upperIndex] ?? lower
  return lower + (upper - lower) * (position - lowerIndex)
}

function metricRegressionPct(
  direction: MetricResult['direction'],
  baselineMedian: number | null,
  candidateMedian: number | null,
): number | null {
  if (baselineMedian === null || candidateMedian === null) return null
  if (baselineMedian === 0) return candidateMedian === 0 ? 0 : null
  const regression =
    direction === 'lower-is-better'
      ? candidateMedian - baselineMedian
      : baselineMedian - candidateMedian
  return round4((regression / Math.abs(baselineMedian)) * 100)
}

function nullableDifference(after: number | null, before: number | null): number | null {
  return after === null || before === null ? null : round4(after - before)
}

function captureMetricValue(capture: CaptureArtifact, metric: CaptureMetric): number | null {
  switch (metric) {
    case 'react.commits':
      return numberAt(toolResult(capture, 'react', 'react_get_renders'), 'commits')
    case 'react.renders':
      return numberAt(toolResult(capture, 'react', 'react_get_renders'), 'summary', 'totalRenders')
    case 'react.updates':
      return numberAt(toolResult(capture, 'react', 'react_get_renders'), 'summary', 'totalUpdates')
    case 'react.unnecessary':
      return sumComponents(
        toolResult(capture, 'react', 'react_get_renders'),
        (component) => component.unnecessary,
      )
    case 'react.selfTimeMs':
      // The summary view omits cumulativeSelfTime when one render makes it equal to selfTime.
      return sumComponents(
        toolResult(capture, 'react', 'react_get_renders'),
        (component) => component.cumulativeSelfTime ?? component.selfTime,
      )
    case 'effects.hot':
      return hotEffectCount(toolResult(capture, 'effects', 'react_effect_audit'))
    case 'query.pending': {
      const result = toolResult(capture, 'query', 'query_is_fetching')
      const fetching = numberAt(result, 'fetching')
      const mutating = numberAt(result, 'mutating')
      return fetching === null || mutating === null ? null : fetching + mutating
    }
    case 'memory.usedHeapBytes':
      return numberAt(toolResult(capture, 'memory', 'browser_get_memory'), 'usedJSHeapSize')
    case 'performance.avgFps': {
      const result = toolResult(capture, 'performance', 'browser_fps')
      return isRecord(result) && result.hidden === true ? null : numberAt(result, 'avgFps')
    }
    case 'performance.droppedFrames': {
      const result = toolResult(capture, 'performance', 'browser_fps')
      return isRecord(result) && result.hidden === true ? null : numberAt(result, 'droppedFrames')
    }
  }
}

function toolResult(
  capture: CaptureArtifact,
  domain: keyof CaptureArtifact['sections'],
  tool: string,
): unknown {
  const result = capture.sections[domain]?.tools[tool]
  return result?.status === 'ok' ? result.result : null
}

function sumComponents(
  result: unknown,
  read: (component: Record<string, unknown>) => unknown,
): number | null {
  if (!isRecord(result) || !Array.isArray(result.components)) return null
  let total = 0
  for (const component of result.components) {
    const value = isRecord(component) ? read(component) : undefined
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    total += value
  }
  return round4(total)
}

function hotEffectCount(result: unknown): number | null {
  if (!isRecord(result) || !Array.isArray(result.components)) return null
  let hot = 0
  for (const component of result.components) {
    if (!isRecord(component) || !Array.isArray(component.effects)) return null
    for (const effect of component.effects) {
      if (isRecord(effect) && isRecord(effect.hotness) && effect.hotness.label === 'hot') hot += 1
    }
  }
  return hot
}

function numberAt(value: unknown, ...path: string[]): number | null {
  let current = value
  for (const key of path) {
    if (!isRecord(current)) return null
    current = current[key]
  }
  return typeof current === 'number' && Number.isFinite(current) ? current : null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringArray(value: unknown, fallback: string): string[] {
  if (!Array.isArray(value)) return [fallback]
  const strings = value.filter((item): item is string => typeof item === 'string')
  return strings.length > 0 ? strings : [fallback]
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
    : []
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

/** Conditions that make every metric's samples incomparable, found across all captures of both cohorts, warm-up included. */
function sampleHygiene(
  baseline: CaptureArtifact[],
  candidate: CaptureArtifact[],
): { reasons: string[]; renderReasons: string[]; warnings: string[] } {
  const all = [...baseline, ...candidate]
  const reasons: string[] = []
  const renderReasons: string[] = []
  const warnings: string[] = []

  const environments = new Map<string, string[]>()
  for (const capture of all) {
    const signature = environmentSignature(capture)
    environments.set(signature, [...(environments.get(signature) ?? []), capture.captureId])
  }
  if (environments.size > 1) {
    reasons.push('runtime-environment-mismatch')
    warnings.push(
      `Captures ran in ${environments.size} runtime environments (app, React, TanStack, React bundle): ${[
        ...environments,
      ]
        .map(([signature, ids]) => `${signature} for ${ids.join(', ')}`)
        .join('; ')}.`,
    )
  }

  for (const [label, cohort] of [
    ['baseline', baseline],
    ['candidate', candidate],
  ] as const) {
    const tabs = new Set(cohort.map(tabOf))
    if (tabs.size > 1) {
      reasons.push('cohort-spans-multiple-tabs')
      warnings.push(
        `The ${label} cohort mixes captures from ${tabs.size} tabs: ${[...tabs].join(', ')}.`,
      )
    }
  }

  const standIns = all.filter((capture) => capture.session.standIn === true)
  if (standIns.length > 0) {
    reasons.push('capture-from-stand-in-tab')
    warnings.push(
      `Another tab answered for a silent targeted tab in ${standIns.map((capture) => capture.captureId).join(', ')}.`,
    )
  }

  const runs = new Map<string, string[]>()
  const withoutWindow: string[] = []
  for (const capture of all) {
    const window = observationWindowOf(capture)
    if (window === undefined) continue
    if (window === null) {
      withoutWindow.push(capture.captureId)
      continue
    }
    const run = JSON.stringify([capture.session.sessionId, window])
    runs.set(run, [...(runs.get(run) ?? []), capture.captureId])
  }
  const repeated = [...runs.values()].filter((ids) => ids.length > 1)
  if (repeated.length > 0) {
    reasons.push('repeated-snapshot-of-one-run')
    warnings.push(
      `Captures share one observation window, so each group is one run: ${repeated.map((ids) => ids.join(' = ')).join('; ')}. Clear renders before each run.`,
    )
  }
  if (withoutWindow.length > 0) {
    renderReasons.push('render-observation-window-missing')
    warnings.push(
      `No observation window was open for ${withoutWindow.join(', ')}, so their render counts are cumulative, not one run. Run react_clear_renders before each run.`,
    )
  }
  return { reasons: unique(reasons), renderReasons, warnings }
}

function environmentSignature(capture: CaptureArtifact): string {
  const renders = toolResult(capture, 'react', 'react_get_renders')
  return JSON.stringify({
    name: capture.session.app.name ?? null,
    reactVersion: capture.session.app.reactVersion ?? null,
    tanstack: capture.session.app.tanstack ?? null,
    bundle: isRecord(renders) && typeof renders.bundle === 'string' ? renders.bundle : null,
  })
}

function tabOf(capture: CaptureArtifact): string {
  return capture.session.logicalSessionId ?? capture.session.sessionId
}

/** The render observation window a capture read: its id, `null` when none was open, `undefined` without render evidence. */
function observationWindowOf(capture: CaptureArtifact): string | null | undefined {
  const renders = toolResult(capture, 'react', 'react_get_renders')
  if (!isRecord(renders)) return undefined
  const observation = renders.observation
  return isRecord(observation) && typeof observation.id === 'string' ? observation.id : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000
}
