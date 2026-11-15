import {
  type Fiber,
  getDisplayName,
  getReactWorkTagsForFiber,
  isCompositeFiber,
  ReactFiberFlags,
} from 'bippy'
import { isDataDescriptor, plainOwnKeys, safeOwnPropertyDescriptor } from '../causal/safe-object'
import { type CommitWorkBudget, consumeCommitWork } from './commit-budget'
import { compareRenderInputs } from './render-equivalence'
import { isClassComponentFiber, isProviderOf } from './work-tags'

const UPDATE = ReactFiberFlags.Update
const CHILD_DELETION = ReactFiberFlags.ChildDeletion
const CONTENT_RESET = ReactFiberFlags.ContentReset
const VISIBILITY = ReactFiberFlags.Visibility
const SNAPSHOT = ReactFiberFlags.Snapshot
/** setState and forceUpdate callbacks; not exported by bippy. */
const CLASS_CALLBACK = 0b100_0000
const LABEL_LIMIT = 8
const PROVIDER_SEARCH_LIMIT = 10_000
/** Props React never writes to the host after mount. */
const UNWRITTEN_HOST_PROPS = new Set([
  'key',
  'autoFocus',
  'suppressHydrationWarning',
  'suppressContentEditableWarning',
])
const EVENT_HANDLER_PROP = /^on[A-Z]/

/** What one commit changed below a component: host writes, host updates that only replaced callbacks, and scheduled effects. */
export interface OutputTally {
  writes: number
  callbackOnlyUpdates: number
  effects: number
  /** False when a host update could not be classified, a rendered component was not analyzed, or the output budget ran out. */
  complete: boolean
  writeLabels: string[]
  callbackLabels: string[]
}

/** What render analysis learned about one composite in this commit, read when its output is attributed to ancestors. */
export interface CommitRenderFacts {
  /** Every prop, children included, would render the same as before. */
  propsEquivalent: boolean
  /** React scheduled an update on this fiber itself (state, store, context or forceUpdate); null when unreadable. */
  ownUpdate: boolean | null
  /** Contexts this render read with a new value, used to credit the provider that changed them. */
  changedContexts: unknown[]
  effects: number
  effectsComplete: boolean
}

type HostPropChange = 'write' | 'callback' | 'none' | 'unknown'

/** React schedules an update on the fiber itself for state, store, context propagation and forceUpdate, and records it on the buffer that was current before the render; a render driven only by the parent leaves it at zero. */
export function ownUpdateScheduled(fiber: Fiber): boolean | null {
  try {
    const lanes: unknown = fiber.alternate?.lanes
    return typeof lanes === 'number' ? lanes !== 0 : null
  } catch {
    return null
  }
}

function emptyTally(complete = true): OutputTally {
  return {
    writes: 0,
    callbackOnlyUpdates: 0,
    effects: 0,
    complete,
    writeLabels: [],
    callbackLabels: [],
  }
}

function addLabel(labels: string[], label: string): void {
  if (labels.length < LABEL_LIMIT && !labels.includes(label)) labels.push(label)
}

function addWrite(tally: OutputTally, label: string): void {
  tally.writes += 1
  addLabel(tally.writeLabels, label)
}

function mergeTally(into: OutputTally, from: OutputTally, writesOnly = false): void {
  into.writes += from.writes
  into.complete &&= from.complete
  for (const label of from.writeLabels) addLabel(into.writeLabels, label)
  if (writesOnly) return
  into.callbackOnlyUpdates += from.callbackOnlyUpdates
  into.effects += from.effects
  for (const label of from.callbackLabels) addLabel(into.callbackLabels, label)
}

function fiberLabel(fiber: Fiber): string {
  if (typeof fiber.type === 'string') return fiber.type
  try {
    return getDisplayName(fiber.type) ?? 'fiber'
  } catch {
    return 'fiber'
  }
}

function isTextLike(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint'
}

/** Mirror the host renderer's own prop diff: React DOM and React Native skip equal values, never write event handlers or other functions to the host, and compare style by contents. */
export function classifyHostProp(
  key: string,
  before: unknown,
  after: unknown,
  commitWork?: CommitWorkBudget,
): HostPropChange {
  if (Object.is(before, after) || UNWRITTEN_HOST_PROPS.has(key)) return 'none'
  if (key === 'children') {
    if (isTextLike(before) || isTextLike(after)) {
      return isTextLike(before) && isTextLike(after) && String(before) === String(after)
        ? 'none'
        : 'write'
    }
    return 'none'
  }
  const beforeCallable = typeof before === 'function' || before == null
  const afterCallable = typeof after === 'function' || after == null
  if (key === 'ref' || EVENT_HANDLER_PROP.test(key)) {
    return beforeCallable && afterCallable ? 'callback' : 'unknown'
  }
  if (typeof before === 'function' && typeof after === 'function') return 'callback'
  if (key === 'dangerouslySetInnerHTML') {
    return classifyHostProp('__html', innerHtml(before), innerHtml(after), commitWork)
  }
  const equivalence = compareRenderInputs(before, after, commitWork)
  return equivalence === 'equal' ? 'none' : equivalence === 'different' ? 'write' : 'unknown'
}

function innerHtml(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  const descriptor = safeOwnPropertyDescriptor(value, '__html')
  return isDataDescriptor(descriptor) ? descriptor.value : value
}

function classifyHostUpdate(
  fiber: Fiber,
  tally: OutputTally,
  commitWork: CommitWorkBudget | undefined,
): void {
  const before: unknown = fiber.alternate?.memoizedProps
  const after: unknown = fiber.memoizedProps
  const beforeKeys = plainOwnKeys(before)
  const afterKeys = plainOwnKeys(after)
  if (!beforeKeys || !afterKeys) {
    tally.complete = false
    return
  }
  const element = fiberLabel(fiber)
  let written = false
  let unknown = false
  const callbacks: string[] = []
  for (const key of new Set([...beforeKeys, ...afterKeys])) {
    if (!consumeCommitWork(commitWork, 'render-output')) {
      tally.complete = false
      return
    }
    const beforeSlot = safeOwnPropertyDescriptor(before as object, key)
    const afterSlot = safeOwnPropertyDescriptor(after as object, key)
    if (
      (beforeSlot !== null && !isDataDescriptor(beforeSlot)) ||
      (afterSlot !== null && !isDataDescriptor(afterSlot))
    ) {
      unknown = true
      continue
    }
    const change = classifyHostProp(key, beforeSlot?.value, afterSlot?.value, commitWork)
    if (change === 'write') {
      written = true
      addWrite(tally, `${element}.${key}`)
    } else if (change === 'callback') {
      callbacks.push(key)
    } else if (change === 'unknown') {
      unknown = true
    }
  }
  if (unknown) tally.complete = false
  if (written || callbacks.length === 0) return
  tally.callbackOnlyUpdates += 1
  for (const key of callbacks) addLabel(tally.callbackLabels, `${element}.${key}`)
}

/** Replays React's placement rule over a reconciled child list: a new child under an existing parent is inserted, and an existing child whose previous index falls behind the last placed one is moved. */
function* placedChildren(
  parent: Fiber,
): Generator<{ child: Fiber; placement: 'insert' | 'move' | null }> {
  let lastPlacedIndex = 0
  for (let child = parent.child; child; child = child.sibling) {
    const previous = child.alternate
    if (!previous) {
      yield { child, placement: parent.alternate ? 'insert' : null }
      continue
    }
    if (previous.index < lastPlacedIndex) {
      yield { child, placement: 'move' }
      continue
    }
    lastPlacedIndex = previous.index
    yield { child, placement: null }
  }
}

/** One fiber's own contribution, before its children are added. */
function ownOutput(
  fiber: Fiber,
  facts: CommitRenderFacts | undefined,
  commitWork: CommitWorkBudget | undefined,
): OutputTally {
  const tally = emptyTally()
  const tags = getReactWorkTagsForFiber(fiber)
  const flags = fiber.flags
  // React clears Placement before the commit hook runs but keeps ChildDeletion on the parent.
  if (flags & CHILD_DELETION) addWrite(tally, `${fiberLabel(fiber)}:remove-child`)
  const updated = fiber.alternate !== null && (flags & UPDATE) !== 0
  if (fiber.tag === tags.HostText) {
    if (updated) addWrite(tally, '#text')
  } else if (
    fiber.tag === tags.HostComponent ||
    fiber.tag === tags.HostHoistable ||
    fiber.tag === tags.HostSingleton
  ) {
    if (flags & CONTENT_RESET) addWrite(tally, `${fiberLabel(fiber)}.textContent`)
    if (updated) classifyHostUpdate(fiber, tally, commitWork)
  } else if (fiber.tag === tags.OffscreenComponent && flags & VISIBILITY) {
    addWrite(tally, 'suspense:visibility')
  } else if (isCompositeFiber(fiber)) {
    if (!facts) {
      tally.complete = false
    } else {
      tally.effects += facts.effects
      tally.complete &&= facts.effectsComplete
    }
    if (
      fiber.alternate &&
      isClassComponentFiber(fiber) &&
      flags & (UPDATE | SNAPSHOT | CLASS_CALLBACK)
    ) {
      tally.effects += 1
    }
  }
  return tally
}

export interface CommitOutputInput {
  /** Fibers Bippy reported rendered, in traversal order: every ancestor precedes its descendants. */
  rendered: ReadonlySet<Fiber>
  facts: ReadonlyMap<Fiber, CommitRenderFacts>
  commitWork?: CommitWorkBudget
}

/** Attribute this commit's host output to the renders that produced it in one pass: a child that rendered for its own update with equal props keeps its output (a Context change credits the provider), and a child with equal inputs passes up only host writes, since its callbacks and effects were rebuilt from equal inputs. */
export function attributeCommitOutput({
  rendered,
  facts,
  commitWork,
}: CommitOutputInput): Map<Fiber, OutputTally> {
  const tallies = new Map<Fiber, OutputTally>()
  const routed = new Map<Fiber, OutputTally>()
  const order = [...rendered]
  let exhausted = false
  const canonical = (fiber: Fiber | null): Fiber | null => {
    if (!fiber) return null
    if (rendered.has(fiber)) return fiber
    return fiber.alternate && rendered.has(fiber.alternate) ? fiber.alternate : null
  }
  const factsOf = (fiber: Fiber): CommitRenderFacts | undefined =>
    facts.get(fiber) ?? (fiber.alternate ? facts.get(fiber.alternate) : undefined)

  for (let index = order.length - 1; index >= 0; index -= 1) {
    const fiber = order[index] as Fiber
    if (exhausted || !consumeCommitWork(commitWork, 'render-output')) {
      exhausted = true
      tallies.set(fiber, emptyTally(false))
      continue
    }
    try {
      const fiberFacts = factsOf(fiber)
      const tally = ownOutput(fiber, fiberFacts, commitWork)
      const fromConsumers = routed.get(fiber)
      if (fromConsumers) mergeTally(tally, fromConsumers)
      collectChildren(fiber, tally)
      tallies.set(fiber, tally)
      if (keepsOwnOutput(fiberFacts)) {
        for (const context of fiberFacts.changedContexts) routeToProvider(fiber, context, tally)
      }
    } catch {
      tallies.set(fiber, emptyTally(false))
    }
  }
  return tallies

  function collectChildren(parent: Fiber, into: OutputTally): void {
    const stack: Fiber[] = [parent]
    while (stack.length > 0) {
      const reconciled = stack.pop() as Fiber
      for (const { child, placement } of placedChildren(reconciled)) {
        if (!consumeCommitWork(commitWork, 'render-output')) {
          into.complete = false
          exhausted = true
          return
        }
        if (placement) addWrite(into, `${fiberLabel(child)}:${placement}`)
        const reported = canonical(child)
        if (reported) {
          contribute(reported, into)
          continue
        }
        // Bippy omits fragments, portals and offscreen wrappers, whose children React still reconciled.
        if (isCompositeFiber(child) || !didStructuralWork(child)) continue
        mergeTally(into, ownOutput(child, undefined, commitWork))
        stack.push(child)
      }
    }
  }

  function contribute(child: Fiber, into: OutputTally): void {
    const tally = tallies.get(child) ?? emptyTally(false)
    if (!isCompositeFiber(child)) {
      mergeTally(into, tally)
      return
    }
    const childFacts = factsOf(child)
    if (!childFacts?.propsEquivalent) {
      mergeTally(into, tally)
      if (!childFacts) into.complete = false
      return
    }
    if (childFacts.ownUpdate === true) return
    mergeTally(into, tally, true)
    if (childFacts.ownUpdate === null) into.complete = false
  }

  function routeToProvider(consumer: Fiber, context: unknown, tally: OutputTally): void {
    let current = consumer.return
    for (let steps = 0; current && steps < PROVIDER_SEARCH_LIMIT; steps += 1) {
      if (isProviderOf(current, context)) {
        let provider: Fiber | null = null
        for (let target: Fiber | null = current; target && !provider; target = target.return) {
          provider = canonical(target)
        }
        if (!provider) return
        const settled = tallies.get(provider)
        if (settled) {
          mergeTally(settled, tally)
          settled.complete = false
          return
        }
        const bucket = routed.get(provider) ?? emptyTally()
        mergeTally(bucket, tally)
        routed.set(provider, bucket)
        return
      }
      current = current.return
    }
  }
}

/** A component that rendered for its own update with equal props owns its output; its parent did not cause it. */
function keepsOwnOutput(facts: CommitRenderFacts | undefined): facts is CommitRenderFacts {
  return facts?.propsEquivalent === true && facts.ownUpdate === true
}

/** React reconciled this non-component wrapper in this commit, so its flags and children are current. */
function didStructuralWork(fiber: Fiber): boolean {
  const previous = fiber.alternate
  if (!previous) return true
  return (
    fiber.memoizedProps !== previous.memoizedProps ||
    (fiber.flags & (CHILD_DELETION | VISIBILITY)) !== 0
  )
}

export type NecessityReason =
  | 'mount'
  | 'dom-changed'
  | 'inputs-unchanged'
  | 'output-unchanged'
  | 'callbacks-changed'
  | 'effects-scheduled'
  | 'output-incomplete'

export interface NecessityGrade {
  necessity: 'necessary' | 'unnecessary' | 'unknown'
  necessityReason: NecessityReason
}

/** Necessary when the subtree wrote to the host; unnecessary when inputs were provably equal or the commit wrote nothing, replaced no callback and scheduled no effect; otherwise open, because Genie cannot compare closures. */
export function gradeRender(
  phase: 'mount' | 'update',
  inputsEquivalent: boolean,
  output: OutputTally | null,
): NecessityGrade {
  if (phase === 'mount') return { necessity: 'necessary', necessityReason: 'mount' }
  if (output && output.writes > 0) return { necessity: 'necessary', necessityReason: 'dom-changed' }
  if (inputsEquivalent) return { necessity: 'unnecessary', necessityReason: 'inputs-unchanged' }
  if (!output?.complete) return { necessity: 'unknown', necessityReason: 'output-incomplete' }
  if (output.callbackOnlyUpdates > 0) {
    return { necessity: 'unknown', necessityReason: 'callbacks-changed' }
  }
  if (output.effects > 0) return { necessity: 'unknown', necessityReason: 'effects-scheduled' }
  return { necessity: 'unnecessary', necessityReason: 'output-unchanged' }
}
