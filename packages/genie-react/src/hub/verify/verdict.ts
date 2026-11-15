import {
  claimTarget,
  formatVerifyClaim,
  type RefusalReason,
  type Verdict,
  type VerifyClaim,
  type VerifyClaimResult,
  type VerifyFix,
  type VerifyGuard,
  verifyTargetKey,
} from '../../protocol'
import { evaluateBoundaries } from './claims/boundaries'
import { evaluateEffectRuns, evaluateEffectSettles } from './claims/effects'
import { evaluateRenderCauses } from './claims/render-causes'
import { evaluateRenders } from './claims/renders'
import type { TargetEvidence, VerificationEvidence } from './evidence'
import { type ClaimOutcome, refuse, refused } from './outcome'

/** A failed guard here invalidates the evidence itself, so it refuses every claim; nothing can pass or fail on it. */
const EVERY_CLAIM_REASONS: ReadonlySet<RefusalReason> = new Set([
  'session_changed',
  'window_interrupted',
  'unsupported_environment',
  'code_changed',
  'document_hidden',
  'override_active',
  'evidence_unavailable',
  'window_lost',
])

const GUARD_FIXES: Partial<Record<RefusalReason, VerifyFix['action']>> = {
  unsupported_environment: 'check-setup',
  evidence_unavailable: 'check-setup',
  override_active: 'reset-overrides',
  no_activity: 'drive-observed-tab',
}

export const UI_CAVEAT = 'ui-outcome-not-observed'

/** Claims that hold when nothing renders or runs; a window without React commits cannot prove them. */
export function passesOnAbsence(claim: VerifyClaim): boolean {
  if (claim.kind === 'renders') return claim.max !== undefined
  return claim.kind !== 'boundaries-clean'
}

export function evaluateClaim(claim: VerifyClaim, evidence: VerificationEvidence): ClaimOutcome {
  if (claim.kind === 'boundaries-clean') return evaluateBoundaries(claim, evidence)
  const target = claimTarget(claim)
  const targetEvidence: TargetEvidence | undefined = target
    ? evidence.targets.get(verifyTargetKey(target))
    : undefined
  if (!targetEvidence) {
    return refused(
      refuse(
        'evidence_unavailable',
        'No evidence was read for this claim target.',
        {},
        { action: 'check-setup' },
      ),
    )
  }
  switch (claim.kind) {
    case 'renders':
      return evaluateRenders(claim, evidence, targetEvidence)
    case 'render-causes':
      return evaluateRenderCauses(claim, evidence, targetEvidence)
    case 'effect-runs':
      return evaluateEffectRuns(claim, evidence, targetEvidence)
    case 'effect-settles':
      return evaluateEffectSettles(claim, evidence, targetEvidence)
  }
}

export function guardRefusal(guard: VerifyGuard, url: string | undefined) {
  const reason = guard.reason ?? 'evidence_unavailable'
  const action = GUARD_FIXES[reason] ?? 'begin-again'
  return refuse(reason, guard.message ?? reason, guard.raw, {
    action,
    ...(action === 'drive-observed-tab' && url ? { url } : {}),
  })
}

export interface Decision {
  verdict: Verdict
  claims: VerifyClaimResult[]
  windowRefusals: VerifyGuard[]
}

/** Applies the window guards, then each claim's decision table, and combines them: a failure decides the run, then a refusal, then an inconclusive. */
export function decide(
  claims: readonly VerifyClaim[],
  evidence: VerificationEvidence,
  guards: readonly VerifyGuard[],
  url: string | undefined,
): Decision {
  const windowRefusals = guards.filter((guard) => guard.status === 'refused')
  const blocking = windowRefusals.find(
    (guard) => guard.reason && EVERY_CLAIM_REASONS.has(guard.reason),
  )
  const noActivity = windowRefusals.find((guard) => guard.reason === 'no_activity')
  const results = claims.map((claim, position): VerifyClaimResult => {
    const outcome = blocking
      ? refused(guardRefusal(blocking, url))
      : withActivityGuard(claim, evaluateClaim(claim, evidence), noActivity, url)
    return {
      index: position + 1,
      text: formatVerifyClaim(claim),
      claim,
      verdict: outcome.verdict,
      observed: outcome.observed,
      deciding: outcome.deciding,
      decidingOmitted: 0,
      caveats: outcome.caveats,
      ...(outcome.refusal ? { refusal: outcome.refusal } : {}),
      ...(outcome.inconclusive ? { inconclusive: outcome.inconclusive } : {}),
    }
  })
  return { verdict: combine(results, windowRefusals), claims: results, windowRefusals }
}

function withActivityGuard(
  claim: VerifyClaim,
  outcome: ClaimOutcome,
  noActivity: VerifyGuard | undefined,
  url: string | undefined,
): ClaimOutcome {
  if (!noActivity || !passesOnAbsence(claim) || outcome.verdict === 'fail') return outcome
  return refused(guardRefusal(noActivity, url), outcome.observed)
}

export function combine(
  claims: readonly Pick<VerifyClaimResult, 'verdict'>[],
  windowRefusals: readonly VerifyGuard[],
): Verdict {
  if (claims.some((claim) => claim.verdict === 'fail')) return 'fail'
  if (windowRefusals.length > 0 || claims.some((claim) => claim.verdict === 'refused'))
    return 'refused'
  if (claims.some((claim) => claim.verdict === 'inconclusive')) return 'inconclusive'
  return 'pass'
}
