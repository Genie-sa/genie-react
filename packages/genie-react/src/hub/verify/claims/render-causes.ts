import { formatVerifyCauseLabel, type VerifyCause, type VerifyClaim } from '../../../protocol'
import type {
  RenderCause,
  RenderEventRecord,
  TargetEvidence,
  VerificationEvidence,
} from '../evidence'
import { type ClaimOutcome, refuse, refused } from '../outcome'
import { matchTarget } from '../target'
import { upperBoundRefusal } from './renders'

type RenderCausesClaim = Extract<VerifyClaim, { kind: 'render-causes' }>

const MAX_DECIDING = 3
const NOTIFICATION_REASONS: Record<string, string> = {
  query: 'query-notification-delivered',
  router: 'router-notification-delivered',
}

/** A Query or Router cause is exact only when it joins the notification React delivered; any other grade is a lead. */
function isExactCause(cause: RenderCause): boolean {
  if (cause.evidence !== 'exact') return false
  const required = NOTIFICATION_REASONS[cause.kind]
  return required === undefined || cause.reason === required
}

function causeAllowed(cause: RenderCause, allow: readonly VerifyCause[]): boolean {
  return allow.some(
    (allowed) =>
      allowed.kind === cause.kind && (allowed.name === undefined || allowed.name === cause.name),
  )
}

function causeLabel(cause: RenderCause): string {
  return formatVerifyCauseLabel(cause.kind, cause.name)
}

function eventItem(event: RenderEventRecord): Record<string, unknown> {
  return {
    kind: 'render-event',
    renderEventId: event.renderEventId,
    documentCommitId: event.documentCommitId,
    mountId: event.mountId,
    causes: event.causes.map((cause) => ({ cause: causeLabel(cause), evidence: cause.evidence })),
  }
}

export function evaluateRenderCauses(
  claim: RenderCausesClaim,
  evidence: VerificationEvidence,
  target: TargetEvidence,
): ClaimOutcome {
  const matched = matchTarget(target)
  const renders = matched.records.reduce((sum, record) => sum + record.renders, 0)
  const events = (target.events?.events ?? []).filter((event) =>
    matched.mountIds.has(event.mountId),
  )
  const violating = events.filter((event) =>
    event.causes.some((cause) => isExactCause(cause) && !causeAllowed(cause, claim.allow)),
  )
  const observed = {
    renders,
    events: events.length,
    violatingEvents: violating.length,
    causes: [...new Set(events.flatMap((event) => event.causes.map(causeLabel)))].sort(),
  }
  const identity = upperBoundRefusal(evidence, target, matched)
  const identityOnly =
    identity &&
    (identity.reason === 'target_ambiguous' || identity.reason === 'evidence_unavailable')
  if (violating.length > 0 && !identityOnly) {
    return {
      verdict: 'fail',
      observed,
      deciding: violating.slice(0, MAX_DECIDING).map(eventItem),
      caveats: [],
    }
  }
  if (identity) return refused(identity, observed)
  if (!target.events) {
    return refused(
      refuse(
        'evidence_unavailable',
        'The render cause events for the target could not be read after the freeze.',
        {},
        { action: 'check-setup' },
      ),
      observed,
    )
  }
  const retention = target.events
  const retentionGap =
    retention.droppedRenderEvents > 0 ||
    retention.omittedByLimit > 0 ||
    retention.foreignObservationEvents > 0
  if (retentionGap || events.length !== renders) {
    return refused(
      refuse(
        'evidence_truncated',
        `The window has ${renders} render${renders === 1 ? '' : 's'} of the target but ${events.length} retained cause event${events.length === 1 ? '' : 's'}, so some causes are missing.`,
        {
          renders,
          events: events.length,
          droppedRenderEvents: retention.droppedRenderEvents,
          omittedByLimit: retention.omittedByLimit,
        },
      ),
      observed,
    )
  }
  if (retention.attributionStale) {
    return refused(
      refuse(
        'coverage_incomplete',
        'React committed while the cause events were read, so they may mix two states.',
        { attribution: 'stale' },
      ),
      observed,
    )
  }
  const unattributed = events.filter((event) => !event.inputCoverageComplete)
  if (unattributed.length > 0) {
    return refused(
      refuse(
        'coverage_incomplete',
        `${unattributed.length} render${unattributed.length === 1 ? ' has' : 's have'} incomplete input attribution, so another cause cannot be ruled out.`,
        { renderEventIds: unattributed.slice(0, MAX_DECIDING).map((event) => event.renderEventId) },
      ),
      observed,
      unattributed.slice(0, MAX_DECIDING).map(eventItem),
    )
  }
  const inferred = events.filter((event) => event.causes.some((cause) => !isExactCause(cause)))
  if (inferred.length > 0) {
    return refused(
      refuse(
        'evidence_inferred',
        `${inferred.length} render${inferred.length === 1 ? ' has' : 's have'} an inferred or unknown cause; verify passes only on exact causes.`,
        { renderEventIds: inferred.slice(0, MAX_DECIDING).map((event) => event.renderEventId) },
        { action: 'change-claim' },
      ),
      observed,
      inferred.slice(0, MAX_DECIDING).map(eventItem),
    )
  }
  return {
    verdict: 'pass',
    observed,
    deciding: events.slice(0, MAX_DECIDING).map(eventItem),
    caveats: [],
  }
}
