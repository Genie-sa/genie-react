const DEFAULT_OPERATION_LIMIT = 20_000
export const DEFAULT_TIME_LIMIT_MS = 8
// Reading the clock on every operation cost more than most operations it guarded.
const CLOCK_CHECK_INTERVAL = 16

export interface CommitWorkBudget {
  remainingOperations: number
  deadlineAt: number
  operationsUntilClockCheck: number
  exhaustedSubsystems: Set<string>
  exhaustedLimit: 'operationLimit' | 'timeLimitMs' | null
  readonly now: () => number
}

export interface CommitWorkBudgetOptions {
  operationLimit?: number
  timeLimitMs?: number
  now?: () => number
}

export function normalizeTimeLimitMs(
  value: number | undefined,
  fallback = DEFAULT_TIME_LIMIT_MS,
): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.max(0.1, value)
}

function monotonicNow(): number {
  return globalThis.performance?.now?.() ?? Date.now()
}

/** One shared guard for every synchronous analysis step performed by a React commit. */
export function createCommitWorkBudget(options: CommitWorkBudgetOptions = {}): CommitWorkBudget {
  const now = options.now ?? monotonicNow
  const operationLimit = boundedPositiveInteger(options.operationLimit, DEFAULT_OPERATION_LIMIT)
  const timeLimitMs = normalizeTimeLimitMs(options.timeLimitMs)
  return {
    remainingOperations: operationLimit,
    deadlineAt: now() + timeLimitMs,
    operationsUntilClockCheck: 0,
    exhaustedSubsystems: new Set(),
    exhaustedLimit: null,
    now,
  }
}

/** Consume bounded work before touching app-owned Fiber data. False means skip and disclose. */
export function consumeCommitWork(
  budget: CommitWorkBudget | undefined,
  subsystem: string,
  operations = 1,
): boolean {
  if (!budget) return true
  const cost = Math.max(1, Math.ceil(operations))
  budget.operationsUntilClockCheck -= cost
  if (budget.operationsUntilClockCheck < 0) {
    budget.operationsUntilClockCheck = CLOCK_CHECK_INTERVAL - 1
    if (budget.now() >= budget.deadlineAt) {
      budget.exhaustedSubsystems.add(subsystem)
      budget.exhaustedLimit ??= 'timeLimitMs'
      budget.remainingOperations = 0
      return false
    }
  }
  if (budget.remainingOperations < cost) {
    budget.exhaustedSubsystems.add(subsystem)
    budget.exhaustedLimit ??= 'operationLimit'
    budget.remainingOperations = 0
    return false
  }
  budget.remainingOperations -= cost
  return true
}

export function commitWorkExhaustions(budget: CommitWorkBudget): string[] {
  return [...budget.exhaustedSubsystems].sort()
}

function boundedPositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.max(1, Math.floor(value))
}
