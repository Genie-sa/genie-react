import { type CommitWorkBudget, consumeCommitWork } from './commit-budget'
import { createDeepDiffBudget, deepDiff } from './deep-diff'

/** What a changed dependency slot did: its value changed, only its identity changed while the contents stayed equal, or the contents could not be compared (functions, class instances, too deep, behind an accessor). */
export type DependencyChange = 'value' | 'reference-only' | 'undetermined'

/** `previous-unavailable` means React's previous dependencies could not be read, so no slot was compared and none can be called unchanged. */
export type DependencyComparisonStatus = 'compared' | 'no-dependency-array' | 'previous-unavailable'

export interface DependencyComparison {
  status: DependencyComparisonStatus
  changes: { slot: number; change: DependencyChange }[]
  omitted: number
  unscanned: number
}

const DEPENDENCY_SCAN_LIMIT = 200
const CHANGED_DEPENDENCY_LIMIT = 50
const VALUE_COMPARISON_DEPTH = 4
const VALUE_COMPARISON_NODES = 200
const VALUE_COMPARISON_CHANGES = 4

/** Compares the dependency arrays React compared for this schedule, slot by slot with `Object.is`, then grades each changed slot by its contents within a bounded walk. */
export function compareDependencies(
  current: unknown,
  previous: unknown,
  budget?: CommitWorkBudget,
): DependencyComparison {
  if (!Array.isArray(current)) {
    return { status: 'no-dependency-array', changes: [], omitted: 0, unscanned: 0 }
  }
  if (!Array.isArray(previous)) {
    return { status: 'previous-unavailable', changes: [], omitted: 0, unscanned: current.length }
  }
  const length = Math.max(current.length, previous.length)
  const scanned = Math.min(length, DEPENDENCY_SCAN_LIMIT)
  const changes: DependencyComparison['changes'] = []
  let omitted = 0
  for (let slot = 0; slot < scanned; slot += 1) {
    if (!consumeCommitWork(budget, 'effect-dependencies')) {
      return { status: 'compared', changes, omitted, unscanned: length - slot }
    }
    let before: unknown
    let after: unknown
    try {
      before = previous[slot]
      after = current[slot]
      if (Object.is(before, after)) continue
    } catch {
      return { status: 'compared', changes, omitted, unscanned: length - slot }
    }
    if (changes.length >= CHANGED_DEPENDENCY_LIMIT) {
      omitted += 1
      continue
    }
    changes.push({ slot, change: classifyChange(before, after, budget) })
  }
  return { status: 'compared', changes, omitted, unscanned: Math.max(0, length - scanned) }
}

function classifyChange(
  before: unknown,
  after: unknown,
  budget: CommitWorkBudget | undefined,
): DependencyChange {
  if (isPrimitive(before) || isPrimitive(after)) return 'value'
  const result = deepDiff(before, after, {
    maxDepth: VALUE_COMPARISON_DEPTH,
    plainObjectDepth: VALUE_COMPARISON_DEPTH,
    budget: createDeepDiffBudget(VALUE_COMPARISON_NODES, VALUE_COMPARISON_CHANGES, () =>
      consumeCommitWork(budget, 'effect-dependencies'),
    ),
  })
  if (
    result.changes.some(
      (change) =>
        change.kind !== 'reference-only' && change.kind !== 'identity-changed-uninspected',
    )
  ) {
    return 'value'
  }
  if (result.truncated || result.changes.some((change) => change.kind !== 'reference-only')) {
    return 'undetermined'
  }
  return 'reference-only'
}

function isPrimitive(value: unknown): boolean {
  return (typeof value !== 'object' && typeof value !== 'function') || value === null
}
