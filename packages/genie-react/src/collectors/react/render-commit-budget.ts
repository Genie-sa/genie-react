import type { Fiber } from 'bippy'
import {
  type CommitWorkBudget,
  type CommitWorkBudgetOptions,
  createCommitWorkBudget,
  normalizeTimeLimitMs,
} from './commit-budget'
import type { CurrentCommitEvidence } from './render-outcomes'

const DEFAULT_COMMIT_FIBER_ANALYSIS_LIMIT = 250
const DEFAULT_TARGET_OPERATION_RESERVE = 4_000
const DEFAULT_TARGET_TIME_RESERVE_MS = 4
// Input attribution may spend at most this share of the commit's time, so render recording keeps the rest.
const ATTRIBUTION_TIME_SHARE = 0.5

export interface CommitAnalysisBudget {
  processed: number
  skipped: number
  failed: number
  limit: number
  work: CommitWorkBudget
  targetProcessed: number
  targetSkipped: number
  targetWork: CommitWorkBudget
  /** Separate pool for render-input attribution; exhausting it never skips render recording. */
  attributionWork: CommitWorkBudget
  /** Observation targets' attribution pool, sized like the target reserve so wide non-target siblings cannot starve it. */
  targetAttributionWork: CommitWorkBudget
  currentCommitEvidence: CurrentCommitEvidence
}

export function createCommitAnalysisBudget(
  limit = DEFAULT_COMMIT_FIBER_ANALYSIS_LIMIT,
  workOptions?: CommitWorkBudgetOptions,
  targetWorkOptions?: CommitWorkBudgetOptions,
): CommitAnalysisBudget {
  const sharedNow = workOptions?.now ?? targetWorkOptions?.now
  const work = createCommitWorkBudget({ ...workOptions, now: sharedNow })
  const targetTimeReserveMs = normalizeTimeLimitMs(
    targetWorkOptions?.timeLimitMs,
    DEFAULT_TARGET_TIME_RESERVE_MS,
  )
  const createTargetReserve = (): CommitWorkBudget => ({
    ...createCommitWorkBudget({
      operationLimit: targetWorkOptions?.operationLimit ?? DEFAULT_TARGET_OPERATION_RESERVE,
      timeLimitMs: targetTimeReserveMs,
      now: work.now,
    }),
    deadlineAt: work.deadlineAt + targetTimeReserveMs,
  })
  const targetWork = createTargetReserve()
  const workTimeLimitMs = normalizeTimeLimitMs(workOptions?.timeLimitMs)
  const attributionWork = {
    ...createCommitWorkBudget({ operationLimit: workOptions?.operationLimit, now: work.now }),
    deadlineAt: work.deadlineAt - workTimeLimitMs * (1 - ATTRIBUTION_TIME_SHARE),
  }

  return {
    processed: 0,
    skipped: 0,
    failed: 0,
    limit,
    work,
    targetProcessed: 0,
    targetSkipped: 0,
    targetWork,
    attributionWork,
    targetAttributionWork: createTargetReserve(),
    currentCommitEvidence: {
      renderedFibers: new Set<Fiber>(),
      hostMutationFibers: new Set<Fiber>(),
      hostMutationCaptureComplete: false,
    },
  }
}
