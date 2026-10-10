import type { Fiber, MemoizedState, Props } from 'bippy'
import { plainOwnKeys } from '../causal/safe-object'
import { type DeepDiffResult, isDataDescriptor, safeOwnPropertyDescriptor } from './deep-diff'
import { classifyHook, isStatefulHook } from './fiber'
import {
  createRenderEvidenceBudget,
  diffWithBudget,
  markPropsNotEnumerated,
  type RenderEvidenceBudget,
  retainInputEvidence,
  scanInputEvidence,
  truncateInputScan,
} from './render-budget'
import { diffContextChanges, HOOK_WALK_LIMIT, stateValue } from './render-causes'
import { isClassComponentFiber } from './work-tags'

// One level covers the inline `{...}` literals that defeat memo without reflecting deep into app objects.
const PROP_PLAIN_OBJECT_DEPTH = 1

export interface PropRenderChange {
  name: string
  kind: 'props'
  /** Exact fact: both values are non-primitive references and identity changed. */
  referenceChanged: boolean
  /** Bounded deep comparison found no value change, only a reference change. */
  referenceOnly: boolean
  /** Legacy alias for referenceChanged. */
  unstable: boolean
  beforePresent: boolean
  afterPresent: boolean
  before: unknown
  after: unknown
  deepDiff: DeepDiffResult
}

interface StateRenderChangeBase {
  name: string
  kind: 'state'
  unstable: false
  before: unknown
  after: unknown
  deepDiff: DeepDiffResult
}

export interface HookStateRenderChange extends StateRenderChangeBase {
  hook: {
    index: number
    stateIndex: number
    kind: 'state' | 'reducer'
  }
}

export interface ClassStateRenderChange extends StateRenderChangeBase {
  name: 'class state'
}

export type StateRenderChange = HookStateRenderChange | ClassStateRenderChange
export type RenderChange = PropRenderChange | StateRenderChange

export function childrenChanged(fiber: Fiber, evidence?: RenderEvidenceBudget): boolean {
  if (evidence && !scanInputEvidence(evidence, 'children')) return false
  const next: Props | null = fiber.memoizedProps
  const prev: Props | null = fiber.alternate?.memoizedProps ?? null
  if (!next || !prev) return false
  const before = safeOwnPropertyDescriptor(prev, 'children')
  const after = safeOwnPropertyDescriptor(next, 'children')
  if (before === undefined || after === undefined) {
    if (evidence) truncateInputScan(evidence)
    return false
  }
  if (
    (before !== null && !isDataDescriptor(before)) ||
    (after !== null && !isDataDescriptor(after))
  ) {
    if (evidence) truncateInputScan(evidence)
    return false
  }
  return !Object.is(before?.value, after?.value)
}

export function diffProps(
  fiber: Fiber,
  evidence = createRenderEvidenceBudget(),
): PropRenderChange[] {
  const next: Props | null = fiber.memoizedProps
  const prev: Props | null = fiber.alternate?.memoizedProps ?? null
  if (!next || !prev || typeof next !== 'object' || typeof prev !== 'object') return []
  if (Object.is(next, prev)) return []

  const prevKeys = plainOwnKeys(prev)
  const nextKeys = plainOwnKeys(next)
  if (!prevKeys || !nextKeys) {
    markPropsNotEnumerated(evidence)
    return []
  }

  const changes: PropRenderChange[] = []
  for (const name of new Set([...prevKeys, ...nextKeys])) {
    if (name === 'children') continue
    if (!scanInputEvidence(evidence, 'props')) break
    const before = readPropSlot(prev, name)
    const after = readPropSlot(next, name)
    if (!before || !after) {
      truncateInputScan(evidence)
      continue
    }
    if (before.present === after.present && Object.is(before.value, after.value)) continue
    if (!retainInputEvidence(evidence)) continue
    changes.push(propChange(name, before, after, evidence))
  }
  return changes
}

interface PropSlot {
  present: boolean
  value: unknown
}

/** Undefined means the slot is an accessor or unreadable, so its value is unknown. */
function readPropSlot(props: object, name: string): PropSlot | undefined {
  const descriptor = safeOwnPropertyDescriptor(props, name)
  if (descriptor === null) return { present: false, value: undefined }
  return isDataDescriptor(descriptor) ? { present: true, value: descriptor.value } : undefined
}

function propChange(
  name: string,
  before: PropSlot,
  after: PropSlot,
  evidence: RenderEvidenceBudget,
): PropRenderChange {
  const deepDiff = diffWithBudget(before.value, after.value, evidence, PROP_PLAIN_OBJECT_DEPTH)
  const referenceChanged =
    before.present && after.present && isReference(before.value) && isReference(after.value)
  const referenceOnly =
    referenceChanged &&
    !deepDiff.truncated &&
    deepDiff.changes.length > 0 &&
    deepDiff.changes.every((change) => change.kind === 'reference-only')
  return {
    name,
    kind: 'props',
    referenceChanged,
    referenceOnly,
    unstable: referenceChanged,
    beforePresent: before.present,
    afterPresent: after.present,
    before: stateValue(before.value, evidence),
    after: stateValue(after.value, evidence),
    deepDiff,
  }
}

function isReference(value: unknown): boolean {
  return typeof value === 'function' || (typeof value === 'object' && value !== null)
}

/** Reports changed useState/useReducer slots in one guarded hook-chain pass. */
export function diffStateChanges(
  fiber: Fiber,
  evidence = createRenderEvidenceBudget(),
): StateRenderChange[] {
  if (isClassComponentFiber(fiber)) {
    const before = fiber.alternate?.memoizedState ?? null
    const after = fiber.memoizedState
    return Object.is(before, after) || !retainInputEvidence(evidence)
      ? []
      : [
          {
            name: 'class state',
            kind: 'state',
            unstable: false,
            before: stateValue(before, evidence),
            after: stateValue(after, evidence),
            deepDiff: diffWithBudget(before, after, evidence),
          },
        ]
  }

  const changes: StateRenderChange[] = []
  let cur: MemoizedState | null = fiber.memoizedState
  let alt: MemoizedState | null = fiber.alternate?.memoizedState ?? null
  let index = 0
  let stateIndex = 0
  while (cur && alt && index < HOOK_WALK_LIMIT) {
    if (!scanInputEvidence(evidence, 'state')) break
    const currentStateful = isStatefulHook(cur)
    const previousStateful = isStatefulHook(alt)
    if (currentStateful || previousStateful) {
      if (!Object.is(cur.memoizedState, alt.memoizedState)) {
        if (!retainInputEvidence(evidence)) {
          cur = cur.next
          alt = alt.next
          index += 1
          stateIndex += 1
          continue
        }
        const classified = classifyHook(currentStateful ? cur : alt)
        const kind = classified === 'reducer' ? 'reducer' : 'state'
        changes.push({
          name: `${kind}[${stateIndex}]`,
          kind: 'state',
          unstable: false,
          hook: { index, stateIndex, kind },
          before: stateValue(alt.memoizedState, evidence),
          after: stateValue(cur.memoizedState, evidence),
          deepDiff: diffWithBudget(alt.memoizedState, cur.memoizedState, evidence),
        })
      }
      stateIndex += 1
    }
    cur = cur.next
    alt = alt.next
    index += 1
  }
  if (cur || alt) truncateInputScan(evidence)
  return changes
}

/** Backward-compatible predicate; detailed reports intentionally narrow to stateful hooks. */
export function stateChanged(fiber: Fiber): boolean {
  if (isClassComponentFiber(fiber)) {
    return !Object.is(fiber.memoizedState, fiber.alternate?.memoizedState ?? null)
  }
  let cur: MemoizedState | null = fiber.memoizedState
  let alt: MemoizedState | null = fiber.alternate?.memoizedState ?? null
  let guard = 0
  while (cur && alt && guard < HOOK_WALK_LIMIT) {
    if (!Object.is(cur.memoizedState, alt.memoizedState)) return true
    cur = cur.next
    alt = alt.next
    guard += 1
  }
  return false
}

export function contextChanged(fiber: Fiber): boolean {
  return diffContextChanges(fiber).length > 0
}
