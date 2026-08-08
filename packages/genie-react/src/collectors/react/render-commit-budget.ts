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

export interface CommitAnalysisBudget {
  processed: number
  skipped: number
  failed: number
  limit: number
  work: CommitWorkBudget
  targetProcessed: number
  targetSkipped: number
  targetWork: CommitWorkBudget
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
  const targetWork = {
    ...createCommitWorkBudget({
      operationLimit: targetWorkOptions?.operationLimit ?? DEFAULT_TARGET_OPERATION_RESERVE,
      timeLimitMs: targetTimeReserveMs,
      now: work.now,
    }),
    deadlineAt: work.deadlineAt + targetTimeReserveMs,
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
    currentCommitEvidence: {
      renderedFibers: new Set<Fiber>(),
      hostMutationFibers: new Set<Fiber>(),
      hostMutationCaptureComplete: false,
    },
  }
}
