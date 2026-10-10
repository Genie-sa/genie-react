import { type CommitWorkBudget, consumeCommitWork } from './commit-budget'
import {
  createDeepDiffBudget,
  type DeepDiffBudget,
  type DeepDiffResult,
  deepDiff,
} from './deep-diff'

const INPUT_EVIDENCE_LIMIT = 50
const DEEP_DIFF_VISIT_LIMIT = 500
const DEEP_DIFF_CHANGE_LIMIT = 50
// Bounds one fiber's attribution so a single wide component cannot spend the commit's whole attribution pool.
const FIBER_ATTRIBUTION_OPERATION_LIMIT = 1_000

export interface RenderEvidenceBudget {
  remainingInputs: number
  omittedInputs: number
  scanTruncated: boolean
  propsNotEnumerated: boolean
  remainingOperations: number
  /** Per-commit attribution pool, separate from the measurement budget so exhausting it only truncates input evidence. */
  attributionWork: CommitWorkBudget | undefined
  deepDiff: DeepDiffBudget
  /** Measurement budget, used only for instance identity lookups. */
  commitWork: CommitWorkBudget | undefined
}

export interface RenderInputCoverage {
  complete: boolean
  omittedInputs: number
  scanTruncated: boolean
  propsNotEnumerated: boolean
}

export function createRenderEvidenceBudget(
  attributionWork?: CommitWorkBudget,
  commitWork?: CommitWorkBudget,
): RenderEvidenceBudget {
  const budget: RenderEvidenceBudget = {
    remainingInputs: INPUT_EVIDENCE_LIMIT,
    omittedInputs: 0,
    scanTruncated: false,
    propsNotEnumerated: false,
    remainingOperations: FIBER_ATTRIBUTION_OPERATION_LIMIT,
    attributionWork,
    deepDiff: createDeepDiffBudget(DEEP_DIFF_VISIT_LIMIT, DEEP_DIFF_CHANGE_LIMIT, () =>
      consumeAttribution(budget, 'deep-diff'),
    ),
    commitWork,
  }
  return budget
}

function consumeAttribution(budget: RenderEvidenceBudget, subsystem: string): boolean {
  if (budget.remainingOperations <= 0 || !consumeCommitWork(budget.attributionWork, subsystem)) {
    return false
  }
  budget.remainingOperations -= 1
  return true
}

export function scanInputEvidence(budget: RenderEvidenceBudget, subsystem: string): boolean {
  if (consumeAttribution(budget, subsystem)) return true
  truncateInputScan(budget)
  return false
}

export function retainInputEvidence(budget: RenderEvidenceBudget): boolean {
  if (budget.remainingInputs > 0) {
    budget.remainingInputs -= 1
    return true
  }
  budget.omittedInputs += 1
  return false
}

export function truncateInputScan(budget: RenderEvidenceBudget): void {
  budget.scanTruncated = true
}

export function markPropsNotEnumerated(budget: RenderEvidenceBudget): void {
  budget.propsNotEnumerated = true
}

export function diffWithBudget(
  before: unknown,
  after: unknown,
  budget: RenderEvidenceBudget,
  plainObjectDepth = 0,
): DeepDiffResult {
  return deepDiff(before, after, { budget: budget.deepDiff, plainObjectDepth })
}

export function inputCoverage(budget: RenderEvidenceBudget): RenderInputCoverage {
  return {
    complete: budget.omittedInputs === 0 && !budget.scanTruncated && !budget.propsNotEnumerated,
    omittedInputs: budget.omittedInputs,
    scanTruncated: budget.scanTruncated,
    propsNotEnumerated: budget.propsNotEnumerated,
  }
}
