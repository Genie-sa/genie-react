import { isKnownProxy } from '../causal/proxy-tagging'
import {
  isArrayValue,
  isDataDescriptor,
  isPlainObject,
  plainOwnKeys,
  safeOwnPropertyDescriptor,
} from '../causal/safe-object'
import { type CommitWorkBudget, consumeCommitWork } from './commit-budget'

/** `different` means a value differs; `undetermined` means identities differ where contents cannot be compared, such as two closures. */
export type Equivalence = 'equal' | 'different' | 'undetermined'

const REACT_ELEMENT_TYPES = new Set<unknown>([
  Symbol.for('react.element'),
  Symbol.for('react.transitional.element'),
])
const MAX_DEPTH = 8
const DEFAULT_VISIT_LIMIT = 1_000

interface WalkState {
  remainingVisits: number
  commitWork: CommitWorkBudget | undefined
}

/** Compare two render inputs by what they would render: primitives by value, arrays and plain objects by contents, React elements by type, key, ref and props. Getters are never invoked. */
export function compareRenderInputs(
  before: unknown,
  after: unknown,
  commitWork?: CommitWorkBudget,
  visitLimit = DEFAULT_VISIT_LIMIT,
): Equivalence {
  return walk(before, after, 0, { remainingVisits: visitLimit, commitWork })
}

function walk(before: unknown, after: unknown, depth: number, state: WalkState): Equivalence {
  if (Object.is(before, after)) return 'equal'
  if (!visit(state)) return 'undetermined'
  const beforeIsObject = typeof before === 'object' && before !== null
  const afterIsObject = typeof after === 'object' && after !== null
  if (typeof before === 'function' && typeof after === 'function') return 'undetermined'
  if (!beforeIsObject || !afterIsObject) return 'different'
  if (isKnownProxy(before) || isKnownProxy(after) || depth >= MAX_DEPTH) return 'undetermined'

  const beforeElement = isReactElement(before)
  const afterElement = isReactElement(after)
  if (beforeElement !== afterElement) return 'different'
  if (beforeElement) return compareElements(before, after, depth, state)

  const beforeArray = isArrayValue(before)
  if (beforeArray !== isArrayValue(after)) return 'different'
  if (beforeArray) return compareArrays(before as unknown[], after as unknown[], depth, state)
  if (isPlainObject(before) && isPlainObject(after)) {
    return comparePlainObjects(before, after, depth, state)
  }
  return 'undetermined'
}

function visit(state: WalkState): boolean {
  if (state.remainingVisits <= 0) return false
  state.remainingVisits -= 1
  return consumeCommitWork(state.commitWork, 'input-equivalence')
}

function isReactElement(value: object): boolean {
  const descriptor = safeOwnPropertyDescriptor(value, '$$typeof')
  return isDataDescriptor(descriptor) && REACT_ELEMENT_TYPES.has(descriptor.value)
}

/** React 19 keeps ref in props and turns element.ref into a warning getter, so only a data slot is compared here. */
function compareElements(
  before: object,
  after: object,
  depth: number,
  state: WalkState,
): Equivalence {
  let result: Equivalence = 'equal'
  for (const key of ['type', 'key', 'ref', 'props'] as const) {
    const beforeSlot = safeOwnPropertyDescriptor(before, key)
    const afterSlot = safeOwnPropertyDescriptor(after, key)
    if (beforeSlot === null && afterSlot === null) continue
    if (!isDataDescriptor(beforeSlot) || !isDataDescriptor(afterSlot)) {
      if (key === 'ref') continue
      return 'undetermined'
    }
    const slot =
      key === 'type'
        ? Object.is(beforeSlot.value, afterSlot.value)
          ? 'equal'
          : 'different'
        : walk(beforeSlot.value, afterSlot.value, depth + 1, state)
    result = combine(result, slot)
    if (result === 'different') return result
  }
  return result
}

function compareArrays(
  before: unknown[],
  after: unknown[],
  depth: number,
  state: WalkState,
): Equivalence {
  const beforeLength = safeOwnPropertyDescriptor(before, 'length')
  const afterLength = safeOwnPropertyDescriptor(after, 'length')
  if (!isDataDescriptor(beforeLength) || !isDataDescriptor(afterLength)) return 'undetermined'
  if (beforeLength.value !== afterLength.value) return 'different'
  let result: Equivalence = 'equal'
  const length = Number(beforeLength.value)
  for (let index = 0; index < length; index += 1) {
    result = combine(result, compareSlots(before, after, String(index), depth, state))
    if (result === 'different') return result
  }
  return result
}

function comparePlainObjects(
  before: object,
  after: object,
  depth: number,
  state: WalkState,
): Equivalence {
  const beforeKeys = plainOwnKeys(before)
  const afterKeys = plainOwnKeys(after)
  if (!beforeKeys || !afterKeys) return 'undetermined'
  if (beforeKeys.length !== afterKeys.length) return 'different'
  let result: Equivalence = 'equal'
  for (const key of beforeKeys) {
    result = combine(result, compareSlots(before, after, key, depth, state))
    if (result === 'different') return result
  }
  return result
}

function compareSlots(
  before: object,
  after: object,
  key: string,
  depth: number,
  state: WalkState,
): Equivalence {
  const beforeSlot = safeOwnPropertyDescriptor(before, key)
  const afterSlot = safeOwnPropertyDescriptor(after, key)
  if (beforeSlot === null || afterSlot === null) {
    return beforeSlot === afterSlot ? 'equal' : 'different'
  }
  if (!isDataDescriptor(beforeSlot) || !isDataDescriptor(afterSlot)) return 'undetermined'
  return walk(beforeSlot.value, afterSlot.value, depth + 1, state)
}

function combine(left: Equivalence, right: Equivalence): Equivalence {
  if (left === 'different' || right === 'different') return 'different'
  if (left === 'undetermined' || right === 'undetermined') return 'undetermined'
  return 'equal'
}
