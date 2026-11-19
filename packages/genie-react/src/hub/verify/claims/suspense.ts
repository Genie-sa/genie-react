import type { VerifyClaim } from '../../../protocol'
import type {
  LogCompleteness,
  SuspenseHideRecord,
  TargetEvidence,
  VerificationEvidence,
} from '../evidence'
import {
  type ClaimOutcome,
  coverageRefusal,
  type Refusal,
  refuse,
  refused,
  settleRefusal,
} from '../outcome'
import { describeTarget, type MatchedTarget, matchTarget, targetRefusal } from '../target'

type SuspenseHiddenClaim = Extract<VerifyClaim, { kind: 'suspense-hidden' }>

const MAX_DECIDING = 3

/** Commits in which a Suspense boundary replaced the target with its fallback; a fallback that never covered the target does not count. */
export function evaluateSuspenseHidden(
  claim: SuspenseHiddenClaim,
  evidence: VerificationEvidence,
  target: TargetEvidence,
): ClaimOutcome {
  const boundaries = evidence.boundaries
  if (!boundaries) {
    return refused(
      refuse(
        'evidence_unavailable',
        'react_error_state could not be read after the freeze.',
        {},
        { action: 'check-setup' },
      ),
    )
  }
  if (!boundaries.hideLog) {
    return refused(
      refuse(
        'capability_unavailable',
        'This app runtime keeps no Suspense hide log, so a fallback that hid the target and resolved during the window would be invisible. Upgrade genie-react.',
        {},
        { action: 'check-setup' },
      ),
    )
  }
  const matched = matchTarget(target)
  const hides = boundaries.hides.filter((hide) => !hide.forced)
  const hiding = hides.filter((hide) => hidesTarget(hide, claim, matched))
  const others = hides.filter((hide) => !hiding.includes(hide))
  const hidden = new Set(hiding.map((hide) => hide.documentCommitId)).size
  const observed = { hidden, hidesInWindow: hides.length }
  const deciding = hiding.slice(0, MAX_DECIDING).map(hideItem)
  const identity = targetRefusal(target, matched, 'identity')
  if (hidden > claim.max && !identity) {
    return { verdict: 'fail', observed, deciding, caveats: [] }
  }
  const refusal =
    identity ??
    hideLogRefusal(boundaries.hideLog, others, claim, evidence) ??
    targetRefusal(target, matched, 'presence') ??
    hiddenOutsideWindowRefusal(claim, matched) ??
    settleRefusal(evidence)
  if (refusal) return refused(refusal, observed, deciding)
  return {
    verdict: 'pass',
    observed,
    deciding: [
      {
        kind: 'suspense-hide-log',
        complete: true,
        afterDocumentCommitId: evidence.window.startDocumentCommitId,
      },
      ...deciding,
    ],
    caveats: [],
  }
}

const isNarrowed = (claim: SuspenseHiddenClaim) =>
  claim.target.source !== undefined || claim.target.key !== undefined

function sameNamed(hide: SuspenseHideRecord, claim: SuspenseHiddenClaim) {
  return hide.hiddenTargets.filter((entry) => entry.componentName === claim.target.component)
}

function hidesTarget(
  hide: SuspenseHideRecord,
  claim: SuspenseHiddenClaim,
  matched: MatchedTarget,
): boolean {
  return sameNamed(hide, claim).some(
    (entry) => !isNarrowed(claim) || matched.mountIds.has(entry.mountId),
  )
}

/** Whether the log is complete, and every hide that did not cover the target was scanned well enough to rule it out. */
function hideLogRefusal(
  log: LogCompleteness,
  others: SuspenseHideRecord[],
  claim: SuspenseHiddenClaim,
  evidence: VerificationEvidence,
): Refusal | null {
  if (!log.complete) {
    const evicted = log.incompleteReasons.includes('hides-evicted')
    return refuse(
      evicted ? 'evidence_truncated' : 'coverage_incomplete',
      evicted
        ? 'Suspense hides in the window were evicted from the bounded hide log.'
        : 'A commit in the window could not be scanned for Suspense fallbacks.',
      { incompleteReasons: log.incompleteReasons },
    )
  }
  if (log.omittedByLimit > 0) {
    return refuse(
      'evidence_truncated',
      `The hide log omitted ${log.omittedByLimit} Suspense hides past its read limit.`,
      { omittedByLimit: log.omittedByLimit },
    )
  }
  const unscanned = others.filter((hide) => !hide.hiddenScanComplete)
  const truncated = others.filter((hide) => hide.hiddenTargetsOmitted > 0)
  const unreadable = [...new Set([...unscanned, ...truncated])]
  if (unreadable.length > 0) {
    return refuse(
      unscanned.length > 0 ? 'coverage_incomplete' : 'evidence_truncated',
      `${unreadable.length} Suspense fallback${unreadable.length === 1 ? '' : 's'} hid more content than Genie reads, so whether ${claim.target.component} was inside is unknown.`,
      { hideIds: unreadable.slice(0, MAX_DECIDING).map((hide) => hide.hideId) },
    )
  }
  const hidSameName = others.some((hide) => sameNamed(hide, claim).length > 0)
  return isNarrowed(claim) && hidSameName ? coverageRefusal(evidence) : null
}

/** A target already hidden at begin, or hidden at the end by nothing in the window, sat behind a fallback the log cannot attribute. */
function hiddenOutsideWindowRefusal(
  claim: SuspenseHiddenClaim,
  matched: MatchedTarget,
): Refusal | null {
  const hiddenAt = (instances: MatchedTarget['beginInstances']) =>
    instances.some((instance) => instance.renderingState === 'mounted-hidden')
  const atBegin = hiddenAt(matched.beginInstances)
  if (!atBegin && !hiddenAt(matched.endInstances)) return null
  return refuse(
    'target_inactive',
    atBegin
      ? `${describeTarget(claim.target)} was already hidden when the window began, so a fallback could cover it without a new hide.`
      : `${describeTarget(claim.target)} is hidden at the end, but no Suspense fallback in the window hid it.`,
    { hiddenAtBegin: atBegin },
    { action: 'begin-again' },
  )
}

function hideItem(hide: SuspenseHideRecord): Record<string, unknown> {
  return {
    kind: 'suspense-hide',
    hideId: hide.hideId,
    documentCommitId: hide.documentCommitId,
    boundary: hide.boundaryName,
    boundaryId: hide.boundaryId,
  }
}
