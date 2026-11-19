import type {
  InconclusiveReason,
  RefusalReason,
  Verdict,
  VerifyFix,
  VerifyInconclusive,
  VerifyRefusal,
} from '../../protocol'
import type { VerificationEvidence } from './evidence'

export type Refusal = VerifyRefusal

/** What one claim evaluator decides; the verdict assembler adds the claim's index and text. */
export interface ClaimOutcome {
  verdict: Verdict
  observed: Record<string, unknown>
  deciding: Record<string, unknown>[]
  caveats: string[]
  refusal?: Refusal
  inconclusive?: VerifyInconclusive
}

export function refuse(
  reason: RefusalReason,
  message: string,
  evidence: Record<string, unknown> = {},
  fix: VerifyFix = { action: 'begin-again' },
): Refusal {
  return { reason, message, evidence, fix }
}

export function refused(
  refusal: Refusal,
  observed: Record<string, unknown> = {},
  deciding: Record<string, unknown>[] = [],
  caveats: string[] = [],
): ClaimOutcome {
  return { verdict: 'refused', observed, deciding, caveats, refusal }
}

export function inconclusive(
  reason: InconclusiveReason,
  message: string,
  observed: Record<string, unknown>,
  evidence: Record<string, unknown> = {},
): ClaimOutcome {
  return {
    verdict: 'inconclusive',
    observed,
    deciding: [],
    caveats: [],
    inconclusive: { reason, message, evidence },
  }
}

/** Why the window's render analysis cannot back an exact count; null when it can. */
export function coverageRefusal(evidence: VerificationEvidence): Refusal | null {
  const { coverage } = evidence
  if (!coverage) {
    return refuse(
      'evidence_unavailable',
      'The app did not report render coverage at the freeze, so no count is exact.',
      {},
      { action: 'check-setup' },
    )
  }
  if (coverage.budgetAdvice) {
    const limits = coverage.budgetAdvice.exhaustedLimits
    return refuse(
      'budget_exhausted',
      `${limits.join(', ') || 'The analysis budget'} ran out in ${coverage.budgetExhaustedCommits} commit${coverage.budgetExhaustedCommits === 1 ? '' : 's'}, so render counts are a lower bound.`,
      {
        exhaustedLimits: limits,
        budgetExhaustedCommits: coverage.budgetExhaustedCommits,
        suggestedBudget: coverage.budgetAdvice.suggestedBudget,
      },
      { action: 'begin-again', budget: coverage.budgetAdvice.suggestedBudget },
    )
  }
  const gaps = {
    skippedCommitFibers: coverage.skippedCommitFibers,
    droppedUnmountFibers: coverage.droppedUnmountFibers,
    analysisFailedFibers: coverage.analysisFailedFibers,
    pausedCommits: coverage.pausedCommits,
    refreshCommitsExcluded: coverage.refreshCommitsExcluded,
    budgetExhaustedCommits: coverage.budgetExhaustedCommits,
  }
  const lossy = Object.entries(gaps).filter(([, value]) => value > 0)
  if (!coverage.complete || coverage.semantics !== 'exact' || lossy.length > 0) {
    const message = `Render analysis was incomplete in the window (${lossy.map(([name, value]) => `${name} ${value}`).join(', ') || 'coverage not exact'}), so counts are a lower bound.`
    if (coverage.droppedUnmountFibers > 0) {
      return refuse(
        'coverage_incomplete',
        `${message} The interaction unmounted more components than one window keeps, so beginning again loses them again; start from a page that mounts fewer components, such as a shorter list, or claim a lower bound (min) instead.`,
        gaps,
        { action: 'change-claim' },
      )
    }
    return refuse('coverage_incomplete', message, gaps)
  }
  if (coverage.targeted && !coverage.targeted.complete) {
    return refuse(
      'coverage_incomplete',
      `${coverage.targeted.skippedFibers} fibers of the claim targets were not analyzed.`,
      { targetedSkippedFibers: coverage.targeted.skippedFibers },
    )
  }
  return null
}

/** A failed settle ended before its timeout because a domain could not be observed, so a longer timeout would not help. */
export function unsettledReason(
  settle: Pick<VerificationEvidence['window']['settle'], 'outcome' | 'reason'>,
): string {
  const detail = settle.reason ? ` (${settle.reason})` : ''
  return settle.outcome === 'failed'
    ? `Genie could not observe whether the app settled${detail}`
    : `The app did not settle within the timeout${detail}`
}

export function settleRefusal(evidence: VerificationEvidence): Refusal | null {
  const { settle } = evidence.window
  if (settle.outcome === 'met') return null
  return refuse(
    'not_quiescent',
    `${unsettledReason(settle)}, so later work could still change the answer.`,
    { settle: settle.outcome, waitedMs: settle.waitedMs, timeoutMs: settle.timeoutMs },
    settle.outcome === 'failed'
      ? { action: 'check-setup' }
      : { action: 'begin-again', settle: { timeoutMs: Math.min(60_000, settle.timeoutMs * 2) } },
  )
}
