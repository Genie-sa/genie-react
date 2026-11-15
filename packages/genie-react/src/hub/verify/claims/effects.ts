import type { VerifyClaim } from '../../../protocol'
import type { EffectEventRecord, TargetEvidence, VerificationEvidence } from '../evidence'
import {
  type ClaimOutcome,
  inconclusive,
  type Refusal,
  refuse,
  refused,
  settleRefusal,
} from '../outcome'
import { describe, type MatchedTarget, matchTarget } from '../target'
import { targetEvidenceRefusal, upperBoundRefusal } from './renders'

type EffectRunsClaim = Extract<VerifyClaim, { kind: 'effect-runs' }>
type EffectSettlesClaim = Extract<VerifyClaim, { kind: 'effect-settles' }>

const MAX_DECIDING = 3

interface EffectGroup {
  effectIndex: number
  events: EffectEventRecord[]
  /** Runs the app's code asked for: one per observed execution. */
  runs: number
  /** Runs including StrictMode's development replay of a fresh mount, which reruns the same execution. */
  rawRuns: number
}

function eventItem(event: EffectEventRecord): Record<string, unknown> {
  return {
    kind: 'effect-execution',
    effectEventId: event.effectEventId,
    effectIndex: event.effectIndex,
    documentCommitId: event.documentCommitId,
    mountId: event.mountId,
    execution:
      event.execution.status === 'observed'
        ? { status: 'observed', trigger: event.execution.trigger }
        : event.execution,
  }
}

function groupEffects(events: EffectEventRecord[], effectIndex: number | undefined): EffectGroup[] {
  const indexes =
    effectIndex === undefined
      ? [...new Set(events.map((event) => event.effectIndex))].sort((left, right) => left - right)
      : [effectIndex]
  return indexes.map((index) => {
    const group = events.filter((event) => event.effectIndex === index)
    const observed = group.filter((event) => event.execution.status === 'observed')
    const replays = observed.filter(
      (event) =>
        event.execution.status === 'observed' && event.execution.trigger === 'strict-mode-replay',
    )
    return {
      effectIndex: index,
      events: group,
      runs: observed.length,
      rawRuns: observed.length + replays.length,
    }
  })
}

interface EffectSelection {
  events: EffectEventRecord[]
  /** Events whose instance could not be tied to the narrowed target, so they can neither count nor be excluded. */
  untied: number
}

function selectEffects(target: TargetEvidence, matched: MatchedTarget): EffectSelection {
  const events = target.effects?.events ?? []
  const narrowed =
    target.resolution.target.key !== undefined || target.resolution.target.source !== undefined
  if (!narrowed) return { events, untied: 0 }
  const known = new Set(
    [
      ...(target.renders?.records ?? []),
      ...target.resolution.begin.instances,
      ...(target.end?.instances ?? []),
    ].map((entry) => entry.mountId),
  )
  return {
    events: events.filter((event) => matched.mountIds.has(event.mountId)),
    untied: events.filter((event) => !known.has(event.mountId)).length,
  }
}

/** Refusals specific to effect evidence: missing history, uninstrumented runs, and effects the component does not declare. */
function effectEvidenceRefusal(
  claim: EffectRunsClaim | EffectSettlesClaim,
  evidence: VerificationEvidence,
  target: TargetEvidence,
  selection: EffectSelection,
): Refusal | null {
  const effects = target.effects
  if (!effects) {
    return refuse(
      'evidence_unavailable',
      'The effect timeline for the target could not be read after the freeze.',
      {},
      { action: 'check-setup' },
    )
  }
  if (selection.untied > 0) {
    return refuse(
      'target_ambiguous',
      `${selection.untied} effect execution${selection.untied === 1 ? '' : 's'} ran in an instance that cannot be tied to the narrowed target.`,
      { untiedEvents: selection.untied },
      { action: 'list-target-sources', component: claim.target.component },
    )
  }
  if ((evidence.coverage?.truncatedEffectLists ?? 0) > 0) {
    return refuse(
      'coverage_incomplete',
      `${evidence.coverage?.truncatedEffectLists} effect lists were truncated during analysis.`,
      { truncatedEffectLists: evidence.coverage?.truncatedEffectLists },
    )
  }
  if (
    effects.evictedEvents > 0 ||
    effects.omittedByLimit > 0 ||
    effects.refreshCommitsExcluded > 0
  ) {
    return refuse(
      'evidence_truncated',
      'Effect events were evicted, omitted by the read limit, or hidden by a Fast Refresh commit, so a count built from them can be low.',
      {
        evictedEvents: effects.evictedEvents,
        omittedByLimit: effects.omittedByLimit,
        refreshCommitsExcluded: effects.refreshCommitsExcluded,
      },
    )
  }
  const declared = effects.declaredEffectIndexes
  const wanted = claim.target.effectIndex
  if (
    declared !== null &&
    (wanted === undefined ? declared.length === 0 : !declared.includes(wanted))
  ) {
    return refuse(
      'target_not_found',
      wanted === undefined
        ? `${describe(claim.target)} declares no effects, so a claim about its effects holds trivially.`
        : `${describe(claim.target)} has no effect at position ${wanted}; it declares ${declared.length === 0 ? 'none' : declared.join(', ')}.`,
      { declaredEffectIndexes: declared },
      { action: 'find-target', component: claim.target.component },
    )
  }
  const uninstrumented = selection.events.filter(
    (event) =>
      event.execution.status === 'unobserved' && event.execution.reason !== 'not-yet-observed',
  )
  if (uninstrumented.length > 0) {
    return refuse(
      'evidence_unavailable',
      `${uninstrumented.length} scheduled run${uninstrumented.length === 1 ? ' was' : 's were'} not instrumented (layout or insertion effects, or no instrumentation), so execution counts are unknown.`,
      {
        reasons: [
          ...new Set(
            uninstrumented.map((event) =>
              event.execution.status === 'unobserved' ? event.execution.reason : 'observed',
            ),
          ),
        ],
      },
      { action: 'change-claim' },
    )
  }
  const pending = selection.events.filter(
    (event) =>
      event.execution.status === 'unobserved' && event.execution.reason === 'not-yet-observed',
  )
  if (pending.length > 0) {
    return refuse(
      'not_quiescent',
      `${pending.length} scheduled run${pending.length === 1 ? ' had' : 's had'} not executed when the window froze.`,
      { effectEventIds: pending.slice(0, MAX_DECIDING).map((event) => event.effectEventId) },
    )
  }
  return null
}

export function evaluateEffectRuns(
  claim: EffectRunsClaim,
  evidence: VerificationEvidence,
  target: TargetEvidence,
): ClaimOutcome {
  const matched = matchTarget(target)
  const selection = selectEffects(target, matched)
  const groups = groupEffects(selection.events, claim.target.effectIndex)
  const observed = {
    effects: groups.map((group) => ({
      effectIndex: group.effectIndex,
      runs: group.runs,
      rawRuns: group.rawRuns,
    })),
  }
  const failing = groups.filter((group) => group.runs > claim.max)
  const identity = targetEvidenceRefusal(evidence, target, matched)
  if (failing.length > 0 && identity?.reason !== 'target_ambiguous' && selection.untied === 0) {
    return {
      verdict: 'fail',
      observed,
      deciding: failing
        .flatMap((group) => group.events.filter((event) => event.execution.status === 'observed'))
        .slice(0, MAX_DECIDING)
        .map(eventItem),
      caveats: [],
    }
  }
  const refusal =
    upperBoundRefusal(evidence, target, matched) ??
    effectEvidenceRefusal(claim, evidence, target, selection)
  if (refusal) return refused(refusal, observed)
  const replayed = groups.filter((group) => group.rawRuns > claim.max)
  if (replayed.length > 0) {
    return inconclusive(
      'strict_mode_replay',
      `The raw count exceeds ${claim.max} only by StrictMode's development replay of a fresh mount, which a production build does not run.`,
      observed,
      { effectIndexes: replayed.map((group) => group.effectIndex) },
    )
  }
  return {
    verdict: 'pass',
    observed,
    deciding: groups
      .flatMap((group) => group.events)
      .slice(0, MAX_DECIDING)
      .map(eventItem),
    caveats: [],
  }
}

export function evaluateEffectSettles(
  claim: EffectSettlesClaim,
  evidence: VerificationEvidence,
  target: TargetEvidence,
): ClaimOutcome {
  const matched = matchTarget(target)
  const selection = selectEffects(target, matched)
  const settled = evidence.window.settledDocumentCommitId
  const inTail = selection.events.filter(
    (event) => event.execution.status === 'observed' && event.documentCommitId > settled,
  )
  const groups = groupEffects(inTail, claim.target.effectIndex)
  const horizonMs = evidence.window.tailMs
  const observed = {
    horizonMs,
    tailRuns: groups.map((group) => ({ effectIndex: group.effectIndex, runs: group.runs })),
  }
  const looping = groups.filter((group) => group.runs >= 2)
  const identity = targetEvidenceRefusal(evidence, target, matched)
  if (looping.length > 0 && identity?.reason !== 'target_ambiguous' && selection.untied === 0) {
    return {
      verdict: 'fail',
      observed,
      deciding: looping
        .flatMap((group) => group.events)
        .slice(0, MAX_DECIDING)
        .map(eventItem),
      caveats: [],
    }
  }
  const refusal = identity ?? effectEvidenceRefusal(claim, evidence, target, selection)
  if (refusal) return refused(refusal, observed)
  const once = groups.filter((group) => group.runs === 1)
  if (once.length > 0) {
    return refused(
      refuse(
        'not_quiescent',
        `The effect ran once after the app settled; one run cannot tell a final run from a slow loop.`,
        { effectIndexes: once.map((group) => group.effectIndex) },
        {
          action: 'begin-again',
          settle: { quietMs: Math.min(5_000, evidence.window.settle.quietMs * 2) },
        },
      ),
      observed,
      once
        .flatMap((group) => group.events)
        .slice(0, MAX_DECIDING)
        .map(eventItem),
    )
  }
  const settle = settleRefusal(evidence)
  if (settle) return refused(settle, observed)
  return { verdict: 'pass', observed, deciding: [], caveats: ['horizon'] }
}
