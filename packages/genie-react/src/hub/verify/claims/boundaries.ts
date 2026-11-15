import type { VerifyClaim } from '../../../protocol'
import type { VerificationEvidence } from '../evidence'
import { type ClaimOutcome, refuse, refused, settleRefusal } from '../outcome'

type BoundariesClaim = Extract<VerifyClaim, { kind: 'boundaries-clean' }>

const MAX_DECIDING = 3
const UNOBSERVED_ERRORS = 'uncaught-errors-outside-boundaries-unobserved'

export function evaluateBoundaries(
  claim: BoundariesClaim,
  evidence: VerificationEvidence,
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
      {},
      [],
      [UNOBSERVED_ERRORS],
    )
  }
  const caught = boundaries.catches.filter((entry) => !entry.forced)
  const activeAtEnd = boundaries.atEnd.filter((entry) => !entry.forced && entry.status === 'active')
  const uncertainAtEnd = boundaries.atEnd.filter(
    (entry) => !entry.forced && entry.status === 'unknown',
  )
  const windowScope = claim.scope === 'window'
  const observed = {
    ...(windowScope ? { caughtDuringWindow: caught.length } : {}),
    caughtAtEnd: activeAtEnd.length,
  }
  const failures = [
    ...(windowScope
      ? caught.map((entry) => ({
          kind: 'boundary-catch',
          catchId: entry.catchId,
          documentCommitId: entry.documentCommitId,
          boundary: entry.boundaryName,
          boundaryKind: entry.boundaryKind,
          message: entry.message,
          throwingComponent: entry.throwingComponent,
        }))
      : []),
    ...activeAtEnd.map((entry) => ({
      kind: 'boundary-at-end',
      boundary: entry.boundaryName,
      boundaryKind: entry.boundaryKind,
      message: entry.message,
    })),
  ]
  if (failures.length > 0) {
    return {
      verdict: 'fail',
      observed,
      deciding: failures.slice(0, MAX_DECIDING),
      caveats: [UNOBSERVED_ERRORS],
    }
  }
  if (windowScope && !boundaries.catchLog) {
    return refused(
      refuse(
        'capability_unavailable',
        'This app runtime keeps no boundary catch log, so a boundary that caught and reset during the window would be invisible. Upgrade genie-react, or claim boundaries clean-at-end.',
        {},
        { action: 'check-setup' },
      ),
      observed,
      [],
      [UNOBSERVED_ERRORS],
    )
  }
  if (windowScope && boundaries.catchLog && !boundaries.catchLog.complete) {
    const evicted = boundaries.catchLog.incompleteReasons.includes('catches-evicted')
    return refused(
      refuse(
        evicted ? 'evidence_truncated' : 'coverage_incomplete',
        evicted
          ? 'Catches in the window were evicted from the bounded catch log.'
          : 'A commit in the window could not be scanned for caught errors.',
        { incompleteReasons: boundaries.catchLog.incompleteReasons },
      ),
      observed,
      [],
      [UNOBSERVED_ERRORS],
    )
  }
  if (boundaries.scanTruncated || (boundaries.catchLog?.omittedByLimit ?? 0) > 0) {
    return refused(
      refuse('evidence_truncated', 'The error state listed more boundaries than its read limit.', {
        scanTruncated: boundaries.scanTruncated,
      }),
      observed,
      [],
      [UNOBSERVED_ERRORS],
    )
  }
  if (uncertainAtEnd.length > 0) {
    return refused(
      refuse(
        'evidence_inferred',
        `${uncertainAtEnd.length} boundar${uncertainAtEnd.length === 1 ? 'y' : 'ies'} caught before the window and re-rendered since; whether ${uncertainAtEnd.length === 1 ? 'it' : 'they'} recovered is unknown.`,
        { boundaries: uncertainAtEnd.map((entry) => entry.boundaryName).slice(0, MAX_DECIDING) },
        { action: 'begin-again' },
      ),
      observed,
      [],
      [UNOBSERVED_ERRORS],
    )
  }
  const settle = settleRefusal(evidence)
  if (settle) return refused(settle, observed, [], [UNOBSERVED_ERRORS])
  return {
    verdict: 'pass',
    observed,
    deciding: [
      {
        kind: 'boundary-log',
        scope: claim.scope,
        complete: windowScope ? (boundaries.catchLog?.complete ?? false) : null,
        afterDocumentCommitId: evidence.window.startDocumentCommitId,
      },
    ],
    caveats: [UNOBSERVED_ERRORS],
  }
}
