import {
  RENDER_INPUT_SCAN_TRUNCATED,
  RENDER_PROPS_NOT_ENUMERATED,
  type ToolOutput,
} from '../../protocol'
import type { reactRendersDiffContract } from './contracts'
import type { SourceClassificationCoverage } from './render-reports'

export interface ComponentAggregate {
  definitionKey: string
  name: string
  source: string | null
  renders: number
  mounts: number
  updates: number
  selfTime: number
  totalTime: number
  unnecessary: number
  referenceOnlyPropRenders: number
  /** Legacy alias for referenceOnlyPropRenders. */
  unstableRenders: number
}

export type RenderBudgetLimit =
  | 'fiberLimit'
  | 'operationLimit'
  | 'timeLimitMs'
  | 'targetOperationReserve'
  | 'targetTimeReserveMs'

export interface RenderBudgetAdvice {
  exhaustedLimits: RenderBudgetLimit[]
  suggestedBudget: Record<RenderBudgetLimit, number>
  next: string
}

export interface RenderTrackingCoverage {
  sourceClassification?: SourceClassificationCoverage
  complete: boolean
  inputAttributionComplete: boolean
  /** `unknown` when appOnly membership is unresolved: kept rows may be library code, so counts are neither exact nor a lower bound. */
  semantics: 'exact' | 'lower-bound' | 'unknown'
  coverageDomain: 'render-measurement' | 'render-causality'
  skippedCommitFibers: number
  droppedUnmountFibers: number
  analysisFailedFibers: number
  /** Commits after profiling paused: outside the measured window, so counts read now miss them. */
  pausedCommits: number
  /** Commits while no window, span or recording was open: Genie did not analyse them at all. */
  unobservedCommits: number
  /** Commits from a Fast Refresh, or soon enough after one to be indistinguishable, while a window observed: Genie did not analyse them. */
  refreshCommitsExcluded: number
  truncatedInputFibers: number
  propsNotEnumeratedFibers: number
  budgetExhaustedCommits: number
  budgetExhaustedSubsystems: { subsystem: string; commits: number }[]
  budgetAdvice?: RenderBudgetAdvice
  incompleteBecause?: IncompleteCoverageReason[]
  targeted?: {
    components: string[]
    roots: number[]
    processedFibers: number
    skippedFibers: number
    complete: boolean
  }
  observationBudget?: {
    adaptive: boolean
    adaptiveScale: number
    fiberLimit: number
    operationLimit: number
    timeLimitMs: number
    targetOperationReserve: number
    targetTimeReserveMs: number
    lifecycleBufferLimit: number
    lifecycleTargetReserve: number
  }
}

export type AnalysisFailureReason = 'renderer-not-analyzed' | 'traversal-failed' | 'analysis-failed'

/** Which fibers were lost and why, behind the coverage counters. */
export interface CoverageGapDetails {
  analysisFailures: { reason: AnalysisFailureReason; fibers: number }[]
  truncatedInputComponents: string[]
  propsNotEnumeratedComponents: string[]
}

export interface IncompleteCoverageReason {
  reason:
    | 'budget-exhausted'
    | 'unmounts-dropped'
    | 'commits-after-profile-stop'
    | 'commits-not-observed'
    | 'commits-during-fast-refresh'
    | AnalysisFailureReason
    | 'inputs-truncated'
    | 'props-not-enumerated'
    | 'source-classification-incomplete'
    | 'render-events-evicted'
  fibers: number
  components?: string[]
  detail: string
  next?: string
}

type RenderTrackingCoverageInput = Omit<
  RenderTrackingCoverage,
  | 'complete'
  | 'inputAttributionComplete'
  | 'semantics'
  | 'coverageDomain'
  | 'targeted'
  | 'observationBudget'
  | 'incompleteBecause'
> & { gaps?: CoverageGapDetails }

export const RECENT_RENDER_EVENT_LIMIT = 1_000
/** Events of components react_clear_renders names that eviction passes over. */
export const NAMED_RENDER_EVENT_RESERVE = 500

/** Render events the window's bounded history evicted, and how many of them belong to the components a read selects. */
export interface EvictedRenderEvents {
  total: number
  selected: number
  /** The selected components that lost the most events, up to 10. */
  components: string[]
  /** Whether a selected component that lost events is one the window names, so naming it again cannot keep them. */
  namedByWindow: boolean
}

export const UNOBSERVED_COMMITS_NEXT =
  'Open a window with react_clear_renders (or devtools_interaction_begin), repeat the interaction, then read again. To observe a page load, load the page with _genie_observe in its URL.'

const ANALYSIS_FAILURE_DETAIL: Record<AnalysisFailureReason, string> = {
  'renderer-not-analyzed':
    'A React renderer that is a production build or older than React 18 committed, such as a framework overlay; its components are not analyzed.',
  'traversal-failed': 'Genie could not walk a committed tree and skipped it until the next commit.',
  'analysis-failed': 'Analyzing a component threw, so its render is not counted.',
}

/** Every counter that makes coverage incomplete, as a reason an agent can act on. */
function incompleteCoverageReasons(
  input: RenderTrackingCoverageInput,
  scope: 'causal' | 'measurement',
): IncompleteCoverageReason[] {
  const reasons: IncompleteCoverageReason[] = []
  if (input.skippedCommitFibers > 0 || input.budgetExhaustedCommits > 0) {
    reasons.push({
      reason: 'budget-exhausted',
      fibers: input.skippedCommitFibers,
      detail: `${input.budgetExhaustedCommits} commits ran out of analysis budget.`,
      ...(input.budgetAdvice ? { next: input.budgetAdvice.next } : {}),
    })
  }
  if (input.droppedUnmountFibers > 0) {
    reasons.push({
      reason: 'unmounts-dropped',
      fibers: input.droppedUnmountFibers,
      detail: 'More components unmounted than the lifecycle buffer keeps.',
      next: 'Run react_clear_renders with a larger lifecycle.bufferLimit, repeat the step, and read again.',
    })
  }
  if (input.pausedCommits > 0) {
    reasons.push({
      reason: 'commits-after-profile-stop',
      fibers: 0,
      detail: `${input.pausedCommits} commits happened after react_profile_stop paused recording, so counts are a lower bound for that time.`,
      next: 'Run react_clear_renders, repeat the step, and read before stopping the profile.',
    })
  }
  if (input.unobservedCommits > 0) {
    reasons.push({
      reason: 'commits-not-observed',
      fibers: 0,
      detail: `${input.unobservedCommits} commits happened while no render window, profile, measurement or timeline was open. Genie analyses renders and effects only while one is open, so nothing from those commits is recorded.`,
      next: UNOBSERVED_COMMITS_NEXT,
    })
  }
  if (input.refreshCommitsExcluded > 0) {
    reasons.push({
      reason: 'commits-during-fast-refresh',
      fibers: 0,
      detail: `${input.refreshCommitsExcluded} commits came from a Fast Refresh edit, or less than a second after one with no user input in between, so Genie could not tell them from the edit and did not analyse them.`,
      next: 'Wait a second after the edit applies, run react_clear_renders, repeat the step, and read again.',
    })
  }
  const failures = input.gaps?.analysisFailures ?? []
  for (const { reason, fibers } of failures) {
    reasons.push({ reason, fibers, detail: ANALYSIS_FAILURE_DETAIL[reason] })
  }
  const explained = failures.reduce((sum, failure) => sum + failure.fibers, 0)
  if (input.analysisFailedFibers > explained) {
    reasons.push({
      reason: 'analysis-failed',
      fibers: input.analysisFailedFibers - explained,
      detail: ANALYSIS_FAILURE_DETAIL['analysis-failed'],
    })
  }
  if (scope === 'measurement') return reasons
  if (input.truncatedInputFibers > 0) {
    reasons.push({
      reason: 'inputs-truncated',
      fibers: input.truncatedInputFibers,
      components: input.gaps?.truncatedInputComponents,
      detail:
        'An input held values Genie compares only in part, such as functions, class instances or objects past the inspected depth; read deepDiff.truncated on these components.',
    })
  }
  if (input.propsNotEnumeratedFibers > 0) {
    reasons.push({
      reason: 'props-not-enumerated',
      fibers: input.propsNotEnumeratedFibers,
      components: input.gaps?.propsNotEnumeratedComponents,
      detail: 'A props object was not a plain object, so its keys were not read.',
    })
  }
  return reasons
}

export function buildRenderTrackingCoverage(
  input: RenderTrackingCoverageInput,
  scope: 'causal' | 'measurement',
): RenderTrackingCoverage {
  const measurementComplete =
    input.skippedCommitFibers === 0 &&
    input.droppedUnmountFibers === 0 &&
    input.analysisFailedFibers === 0 &&
    input.pausedCommits === 0 &&
    input.unobservedCommits === 0 &&
    input.refreshCommitsExcluded === 0 &&
    input.budgetExhaustedCommits === 0
  const inputAttributionComplete =
    measurementComplete && input.truncatedInputFibers === 0 && input.propsNotEnumeratedFibers === 0
  const { gaps: _gaps, ...counters } = input
  const incompleteBecause = incompleteCoverageReasons(input, scope)
  return {
    ...counters,
    ...(incompleteBecause.length > 0 ? { incompleteBecause } : {}),
    complete: scope === 'measurement' ? measurementComplete : inputAttributionComplete,
    inputAttributionComplete,
    semantics: (scope === 'measurement' ? measurementComplete : inputAttributionComplete)
      ? 'exact'
      : 'lower-bound',
    coverageDomain: scope === 'measurement' ? 'render-measurement' : 'render-causality',
  }
}

export function renderSummarySemantics(
  coverage: RenderTrackingCoverage,
  observedRenders: number,
): 'exact' | 'lower-bound' | 'unknown' {
  if (coverage.complete) return 'exact'
  return observedRenders > 0 ? 'lower-bound' : 'unknown'
}

export function renderEvidenceComparability(
  coverage: RenderTrackingCoverage,
  attributionStatus: 'current' | 'stale',
): { comparable: boolean; notComparableReasons: string[] } {
  const reasons: string[] = []
  if (coverage.skippedCommitFibers > 0) reasons.push('skipped-commit-fibers')
  if (coverage.droppedUnmountFibers > 0) reasons.push('dropped-unmount-fibers')
  if (coverage.analysisFailedFibers > 0) reasons.push('fiber-analysis-failed')
  if (coverage.pausedCommits > 0) reasons.push('commits-after-profile-stop')
  if (coverage.unobservedCommits > 0) reasons.push('commits-not-observed')
  if (coverage.refreshCommitsExcluded > 0) reasons.push('commits-during-fast-refresh')
  if (coverage.truncatedInputFibers > 0) reasons.push(RENDER_INPUT_SCAN_TRUNCATED)
  if (coverage.propsNotEnumeratedFibers > 0) reasons.push(RENDER_PROPS_NOT_ENUMERATED)
  if (coverage.budgetExhaustedCommits > 0) reasons.push('commit-analysis-budget-exhausted')
  if (attributionStatus === 'stale') reasons.push('report-attribution-stale')
  return { comparable: reasons.length === 0, notComparableReasons: reasons }
}

interface Snapshot {
  appOnly: boolean
  commits: number
  clears: number
  components: ComponentAggregate[]
  coverage: RenderTrackingCoverage
}

type RendersDiff = ToolOutput<typeof reactRendersDiffContract>
type RenderDelta = RendersDiff['regressed'][number]

const snapshots = new Map<string, Snapshot>()

const aggregateKey = (aggregate: ComponentAggregate): string => aggregate.definitionKey

const round1 = (value: number): number => Math.round(value * 10) / 10

const pctChange = (before: number, delta: number): number | null =>
  before === 0 ? null : round1((delta / before) * 100)

const toDelta = (
  name: string,
  source: string | null,
  before: ComponentAggregate,
  after: ComponentAggregate,
): RenderDelta => ({
  name,
  ...(source ? { source } : {}),
  deltaMs: round1(after.selfTime - before.selfTime),
  before: { renders: before.renders, selfTime: round1(before.selfTime) },
  after: { renders: after.renders, selfTime: round1(after.selfTime) },
})

export function storeRenderSnapshot(
  label: string,
  commits: number,
  clears: number,
  components: ComponentAggregate[],
  coverage: RenderTrackingCoverage,
  appOnly = true,
): { label: string; commits: number; components: number; coverage: RenderTrackingCoverage } {
  snapshots.set(label, { commits, clears, components, coverage, appOnly })
  return { label, commits, components: components.length, coverage }
}

export const snapshotLabels = (): string[] => [...snapshots.keys()]

export function diffRenderSnapshot(
  baseline: string,
  thresholdMs: number,
  commits: number,
  clears: number,
  after: ComponentAggregate[],
  coverage: RenderTrackingCoverage,
  appOnly = true,
): RendersDiff {
  const snapshot = snapshots.get(baseline)
  if (!snapshot) {
    throw new Error(
      snapshots.size === 0
        ? `No snapshot named "${baseline}" — take one with react_profile_snapshot first (no snapshots stored yet).`
        : `No snapshot named "${baseline}". Stored labels: ${snapshotLabels().join(', ')}.`,
    )
  }

  if (snapshot.appOnly !== appOnly) {
    throw new Error(
      'appOnly must match the baseline snapshot; use the same appOnly value or capture a new baseline.',
    )
  }

  const beforeByKey = new Map(snapshot.components.map((entry) => [aggregateKey(entry), entry]))
  const afterByKey = new Map(after.map((entry) => [aggregateKey(entry), entry]))
  const regressed: RenderDelta[] = []
  const improved: RenderDelta[] = []
  const added: { name: string; source?: string; renders: number; selfTime: number }[] = []
  const removed: { name: string; source?: string }[] = []

  for (const [key, afterAggregate] of afterByKey) {
    const beforeAggregate = beforeByKey.get(key)
    if (!beforeAggregate) {
      added.push({
        name: afterAggregate.name,
        ...(afterAggregate.source ? { source: afterAggregate.source } : {}),
        renders: afterAggregate.renders,
        selfTime: round1(afterAggregate.selfTime),
      })
      continue
    }
    const delta = afterAggregate.selfTime - beforeAggregate.selfTime
    if (delta > thresholdMs) {
      regressed.push(
        toDelta(afterAggregate.name, afterAggregate.source, beforeAggregate, afterAggregate),
      )
    } else if (delta < -thresholdMs) {
      improved.push(
        toDelta(afterAggregate.name, afterAggregate.source, beforeAggregate, afterAggregate),
      )
    }
  }
  for (const [key, beforeAggregate] of beforeByKey) {
    if (!afterByKey.has(key)) {
      removed.push({
        name: beforeAggregate.name,
        ...(beforeAggregate.source ? { source: beforeAggregate.source } : {}),
      })
    }
  }

  const byMagnitude = (left: RenderDelta, right: RenderDelta): number =>
    Math.abs(right.deltaMs) - Math.abs(left.deltaMs)
  regressed.sort(byMagnitude)
  improved.sort(byMagnitude)

  const beforeSelf = snapshot.components.reduce((sum, entry) => sum + entry.selfTime, 0)
  const afterSelf = after.reduce((sum, entry) => sum + entry.selfTime, 0)
  const selfDelta = afterSelf - beforeSelf
  return {
    baseline,
    commits: { before: snapshot.commits, after: commits },
    clearsSinceBaseline: clears - snapshot.clears,
    coverage: { baseline: snapshot.coverage, current: coverage },
    selfTimeMs: {
      before: round1(beforeSelf),
      after: round1(afterSelf),
      delta: round1(selfDelta),
      pct: pctChange(beforeSelf, selfDelta),
    },
    regressed,
    improved,
    added,
    removed,
  }
}

export function clearSnapshots(): void {
  snapshots.clear()
}

/** Whether appOnly membership is still open: some kept candidate may be library code that a resolved classification would hide. */
export const membershipUnresolved = (classification: SourceClassificationCoverage): boolean =>
  classification.affects === 'result' && !classification.complete

/** Coverage that cannot call a result complete while appOnly membership is unresolved; input attribution of the rows themselves is unaffected. */
export function withMembershipCoverage<T extends RenderTrackingCoverage>(
  coverage: T,
  classification: SourceClassificationCoverage,
): T {
  if (!membershipUnresolved(classification)) return coverage
  return {
    ...coverage,
    complete: false,
    semantics: 'unknown',
    incompleteBecause: [
      ...(coverage.incompleteBecause ?? []),
      {
        reason: 'source-classification-incomplete',
        fibers: classification.unknown,
        detail: `${classification.unknown} of ${classification.totalCandidates} candidates have unresolved ownership. appOnly keeps them, but any of them may be library code it would hide, so rows and counts can change once ownership resolves.`,
        next: 'Pass appOnly:false for counts that do not depend on ownership, or read again shortly: ownership keeps resolving in the background, though a component React rendered without an owner stack stays unknown.',
      },
    ],
  }
}

/** Eviction makes causal coverage a lower bound; the reason says whether the components the read selects lost events and how to keep them. */
export function withEvictedRenderEvents<T extends RenderTrackingCoverage>(
  coverage: T,
  evicted: EvictedRenderEvents,
  selective: boolean,
): T & { droppedRenderEvents: number } {
  if (evicted.total === 0) return { ...coverage, droppedRenderEvents: 0 }
  return {
    ...coverage,
    incompleteBecause: [
      ...(coverage.incompleteBecause ?? []),
      renderEventsEvictedReason(evicted, selective),
    ],
    complete: false,
    semantics: 'lower-bound',
    droppedRenderEvents: evicted.total,
  }
}

function renderEventsEvictedReason(
  evicted: EvictedRenderEvents,
  selective: boolean,
): IncompleteCoverageReason {
  const history = `The window keeps its newest ${RECENT_RENDER_EVENT_LIMIT} render events and evicted ${evicted.total} older ones`
  if (evicted.selected === 0) {
    return {
      reason: 'render-events-evicted',
      fibers: 0,
      detail: `${history}, none of them renders of the components this read selects.`,
    }
  }
  return {
    reason: 'render-events-evicted',
    fibers: evicted.selected,
    components: evicted.components,
    detail: selective
      ? `${history}; ${evicted.selected} of them were renders of the components this read selects, so their oldest events are missing.`
      : `${history}, so this read is missing the oldest events.`,
    next: evicted.namedByWindow
      ? `The components react_clear_renders named rendered more than the ${NAMED_RENDER_EVENT_RESERVE} events kept for them. Name fewer components, or read after each interaction.`
      : `Run react_clear_renders with component set to the component you read, so its newest ${NAMED_RENDER_EVENT_RESERVE} render events outlast other components', then repeat the step and read again.`,
  }
}

export function withSourceCoverage(
  coverage: RenderTrackingCoverage,
  sourceClassification: SourceClassificationCoverage,
): RenderTrackingCoverage {
  return { ...withMembershipCoverage(coverage, sourceClassification), sourceClassification }
}
