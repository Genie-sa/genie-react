import type { VerifyClaim } from '../../../protocol'
import type { InstanceRecord, TargetEvidence, VerificationEvidence } from '../evidence'
import {
  type ClaimOutcome,
  coverageRefusal,
  type Refusal,
  refuse,
  refused,
  settleRefusal,
} from '../outcome'
import { describeTarget, type MatchedTarget, matchTarget, targetRefusal } from '../target'

type RendersClaim = Extract<VerifyClaim, { kind: 'renders' }>

const MAX_DECIDING = 3

/** Every check an upper-bound claim needs before an absence can count, in the order an agent should fix them. */
export function upperBoundRefusal(
  evidence: VerificationEvidence,
  target: TargetEvidence,
  matched: MatchedTarget,
): Refusal | null {
  const refusal = targetEvidenceRefusal(evidence, target, matched)
  if (refusal) return refusal
  const late = tailRenders(evidence, matched.records)
  if (late.length > 0) {
    return refuse(
      'not_quiescent',
      `${describeTarget(target.resolution.target)} rendered after the app settled, during the ${evidence.window.tailMs} ms tail; work beyond the window could render it again.`,
      {
        settledDocumentCommitId: evidence.window.settledDocumentCommitId,
        latestRenderDocumentCommitId: Math.max(
          ...late.map((record) => record.latestDocumentCommitId),
        ),
      },
      {
        action: 'begin-again',
        settle: { quietMs: Math.min(5_000, evidence.window.settle.quietMs * 2) },
      },
    )
  }
  return settleRefusal(evidence)
}

/** Whether the target and its render evidence are what the claim names and complete enough to count an absence. */
export function targetEvidenceRefusal(
  evidence: VerificationEvidence,
  target: TargetEvidence,
  matched: MatchedTarget,
): Refusal | null {
  const identity = targetRefusal(target, matched, 'identity')
  if (identity) return identity
  const coverage = coverageRefusal(evidence)
  if (coverage) return coverage
  if (!target.renders) {
    return refuse(
      'evidence_unavailable',
      'The render report for the target could not be read after the freeze.',
      {},
      { action: 'check-setup' },
    )
  }
  if (target.renders.omittedByLimit > 0) {
    return refuse(
      'evidence_truncated',
      `The render report omitted ${target.renders.omittedByLimit} matching records past its limit.`,
      { omittedByLimit: target.renders.omittedByLimit },
    )
  }
  if (target.renders.attributionStale) {
    return refuse(
      'coverage_incomplete',
      'React committed while the render report was read, so it may mix two states.',
      { attribution: 'stale' },
    )
  }
  return targetRefusal(target, matched, 'presence')
}

function tailRenders(evidence: VerificationEvidence, records: InstanceRecord[]): InstanceRecord[] {
  return records.filter(
    (record) =>
      record.renders > 0 && record.latestDocumentCommitId > evidence.window.settledDocumentCommitId,
  )
}

/** Exact only when the window's render analysis was complete and the report was consistent; otherwise a lower bound. */
function countSemantics(
  evidence: VerificationEvidence,
  target: TargetEvidence,
): 'exact' | 'lower-bound' {
  return coverageRefusal(evidence) === null &&
    target.renders !== null &&
    target.renders.omittedByLimit === 0 &&
    !target.renders.attributionStale
    ? 'exact'
    : 'lower-bound'
}

/** Mounts in the window that replaced an instance which unmounted in it, plus mounts at a position that had mounted before; a changed key does either, never an update. */
function remountedInstances(matched: MatchedTarget): InstanceRecord[] {
  const mounted = matched.records.filter((record) => record.mounts > 0)
  const stillMounted = new Set(
    matched.endInstances
      .filter((instance) => instance.renderingState !== 'unmounted')
      .map((instance) => instance.mountId),
  )
  const unmounted = new Set([
    ...matched.records.filter((record) => record.unmounted).map((record) => record.mountId),
    ...matched.beginInstances
      .filter((instance) => !stillMounted.has(instance.mountId))
      .map((instance) => instance.mountId),
  ])
  const regenerated = mounted.filter((record) => record.mountGeneration > 1)
  const replacing = mounted.slice(0, Math.min(mounted.length, unmounted.size))
  return replacing.length >= regenerated.length ? replacing : regenerated
}

export function evaluateRenders(
  claim: RendersClaim,
  evidence: VerificationEvidence,
  target: TargetEvidence,
): ClaimOutcome {
  const matched = matchTarget(target)
  const { records } = matched
  const total = (pick: (record: InstanceRecord) => number) =>
    records.reduce((sum, record) => sum + pick(record), 0)
  const renders = total((record) => record.renders)
  const updates = total((record) => record.updates)
  const counted = claim.counting === 'updates' ? updates : renders
  const remounts = remountedInstances(matched)
  const guardsRemounts = claim.counting === 'updates' && !claim.allowRemount
  const semantics = countSemantics(evidence, target)
  const observed = {
    renders,
    mounts: total((record) => record.mounts),
    updates,
    remounts: remounts.length,
    semantics,
    instances: matched.mountIds.size,
    activeInstances: activeInstances(matched).length,
  }
  const busiest = [...records]
    .filter((record) => record.renders > 0)
    .sort((left, right) => right.renders - left.renders)
    .slice(0, MAX_DECIDING)
    .map(instanceItem)
  const identity = targetRefusal(target, matched, 'identity')

  if (claim.max !== undefined) {
    if (counted > claim.max && !identity) {
      return { verdict: 'fail', observed, deciding: busiest, caveats: [] }
    }
    if (guardsRemounts && remounts.length > 0 && !identity) {
      return {
        verdict: 'fail',
        observed,
        deciding: remounts.slice(0, MAX_DECIDING).map(instanceItem),
        caveats: ['remounts-counted-under-counting-updates'],
      }
    }
    const refusal = upperBoundRefusal(evidence, target, matched)
    if (refusal) return refused(refusal, observed, busiest)
    const unknownGenerations = guardsRemounts
      ? records.filter(
          (record) => record.mounts > 0 && record.mountGenerationEvidence === 'unknown',
        )
      : []
    if (unknownGenerations.length > 0) {
      return refused(
        refuse(
          'evidence_inferred',
          `${unknownGenerations.length} instance${unknownGenerations.length === 1 ? '' : 's'} mounted in the window with an unknown mount generation, so a remount cannot be ruled out.`,
          { mountIds: unknownGenerations.slice(0, MAX_DECIDING).map((record) => record.mountId) },
          { action: 'change-claim' },
        ),
        observed,
      )
    }
    const coverage = evidence.coverage
    return {
      verdict: 'pass',
      observed,
      deciding: [
        {
          kind: 'coverage',
          complete: coverage?.complete ?? false,
          targetedComplete: coverage?.targeted?.complete ?? null,
          semantics,
        },
        ...activeInstances(matched).slice(0, MAX_DECIDING - 1),
      ],
      caveats: [],
    }
  }

  const min = claim.min ?? 0
  if (identity) return refused(identity, observed)
  if (counted >= min) {
    return {
      verdict: 'pass',
      observed,
      deciding: busiest,
      caveats: semantics === 'exact' ? [] : ['count-is-a-lower-bound'],
    }
  }
  const refusal =
    coverageRefusal(evidence) ??
    (target.renders === null
      ? refuse(
          'evidence_unavailable',
          'The render report for the target could not be read after the freeze.',
          {},
          { action: 'check-setup' },
        )
      : null) ??
    (semantics === 'exact'
      ? null
      : refuse('coverage_incomplete', 'The render report was incomplete.')) ??
    targetRefusal(target, matched, 'presence') ??
    settleRefusal(evidence)
  if (refusal) return refused(refusal, observed, busiest)
  return { verdict: 'fail', observed, deciding: busiest, caveats: [] }
}

function instanceItem(record: InstanceRecord): Record<string, unknown> {
  return {
    kind: 'instance',
    mountId: record.mountId,
    ...(record.key === null ? {} : { key: record.key }),
    renders: record.renders,
    mounts: record.mounts,
    updates: record.updates,
    mountGeneration: record.mountGeneration,
    latestDocumentCommitId: record.latestDocumentCommitId,
    ...(record.sourceLocation === null ? {} : { source: record.sourceLocation }),
  }
}

function activeInstances(matched: MatchedTarget): Record<string, unknown>[] {
  return [...matched.endInstances, ...matched.beginInstances]
    .filter((instance) => instance.renderingState === 'mounted-rendering')
    .filter(
      (instance, index, all) =>
        all.findIndex((other) => other.mountId === instance.mountId) === index,
    )
    .map((instance) => ({
      kind: 'instance',
      mountId: instance.mountId,
      renderingState: instance.renderingState,
      ...(instance.sourceLocation === null ? {} : { source: instance.sourceLocation }),
    }))
}
