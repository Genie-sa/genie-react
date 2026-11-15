import { _fiberRoots, type Fiber, type FiberRoot, type RenderPhase } from 'bippy'
import {
  type EffectConsequenceSignal,
  runInEffectContext,
  setEffectConsequenceListener,
} from '../causal/effect-consequence'
import { isKnownProxy } from '../causal/proxy-tagging'
import { isDataDescriptor, safeOwnPropertyDescriptor } from '../causal/safe-object'
import { safeStructuredClone } from '../structured-clone'
import { type CommitWorkBudget, consumeCommitWork } from './commit-budget'
import { nameOf } from './fiber'
import { type InstanceDescriptor, instanceForMountedFiber } from './instance-identity'
import {
  getActiveObservation,
  getDocumentCommitId,
  nextCausalEventId,
  type ObservationWindow,
} from './observation'
import { getExcludedRefreshCommitTotal } from './refresh-commit-count'
import { classifyFibersWithinBudget, ownershipCoverage } from './source'

export type ScheduledEffectKind = 'effect' | 'layout' | 'insertion'

/** Why React ran a passive effect: its commit, StrictMode's development replay, or a hidden subtree becoming visible again. */
export type EffectRunTrigger = 'commit' | 'strict-mode-replay' | 'reconnect'

interface ObservedRun {
  status: 'observed'
  evidence: 'exact'
  startedAt: number
  completedAt: number
  durationMs: number
  outcome: 'completed' | 'threw'
  error?: string
}

type EffectConsequence =
  | {
      kind: 'notification'
      domain: 'query-notification' | 'router-notification'
      notificationId: string
      timestamp: number
      evidence: 'exact'
    }
  | {
      kind: 'react-update'
      stage: 'execution' | 'cleanup'
      status: 'scheduled'
      timestamp: number
      evidence: 'exact'
    }
  | {
      kind: 'react-update'
      stage: 'execution' | 'cleanup'
      status: 'undetermined'
      timestamp: number
      evidence: 'unknown'
      reason: 'work-already-pending'
    }
  | {
      kind: 'resulting-commit'
      documentCommitId: number
      timestamp: number
      evidence: 'inferred'
      reason: 'commit-retired-update-lanes' | 'committed-during-run'
    }

export interface EffectScheduleEvent {
  effectEventId: string
  effectId: string
  observationId: string | null
  commitId: number
  documentCommitId: number
  componentId: number
  componentName: string
  mountId: string
  effectIndex: number
  kind: ScheduledEffectKind
  phase: 'mount' | 'update'
  event: 'scheduled' | 'reconnected'
  evidence: 'exact'
  changedDependencySlots: number[]
  changedDependencySlotsOmitted: number
  dependencySlotsUnscanned: number
  execution:
    | (ObservedRun & { trigger: EffectRunTrigger })
    | {
        status: 'unobserved'
        reason: 'not-yet-observed' | 'unsupported-effect-kind' | 'instrumentation-unavailable'
      }
  cleanupExecution:
    | (ObservedRun & { trigger?: 'strict-mode-replay' })
    | {
        status: 'unobserved'
        reason:
          | 'not-yet-observed'
          | 'no-cleanup-returned'
          | 'unsupported-effect-kind'
          | 'instrumentation-unavailable'
      }
  consequences: {
    status: 'instrumented'
    observedDomains: ['query-notification', 'router-notification', 'react-update', 'react-commit']
    unobservedDomains: [
      'asynchronous-react-update',
      'external-store-write',
      'network',
      'event-listener',
      'navigation',
    ]
    events: EffectConsequence[]
  }
  timeline: Array<{
    stage: 'schedule' | 'execution' | 'cleanup' | 'consequence' | 'resulting-commit'
    timestamp: number
    evidence: 'exact' | 'inferred'
    referenceId?: string
    outcome?: 'completed' | 'threw'
    trigger?: EffectRunTrigger
  }>
}

/** What a passive effect's instrumented create needs to attribute each run, including runs React starts without a new schedule. */
export interface PassiveEffectBinding {
  effectEventId: string | null
  fiber: Fiber
  effectIndex: number
  onCleanupReturned: () => void
  ran: boolean
}

interface PendingLanes {
  root: FiberRoot
  lanes: number
}

const EFFECT_EVENT_LIMIT = 1_000
const DEPENDENCY_SCAN_LIMIT = 200
const CHANGED_DEPENDENCY_LIMIT = 50
const ERROR_MESSAGE_LIMIT = 500
// React's StrictEffectsMode fiber mode bit, unchanged from 18.0 through 19.x.
const STRICT_EFFECTS_MODE = 0b1_0000
const events: EffectScheduleEvent[] = []
const eventsById = new Map<string, EffectScheduleEvent>()
const eventFibers = new WeakMap<EffectScheduleEvent, Fiber>()
const latestByEffectId = new Map<string, EffectScheduleEvent>()
let droppedEvents = 0
let refreshCommitBaseline = 0
let latestProfileCommitId = 0
const pendingResultingCommit = new Map<string, PendingLanes[]>()

export function clearEffectEvents(): void {
  events.length = 0
  eventsById.clear()
  latestByEffectId.clear()
  droppedEvents = 0
  pendingResultingCommit.clear()
  refreshCommitBaseline = getExcludedRefreshCommitTotal()
}

export function recordEffectSchedule(input: {
  fiber: Fiber
  profileCommitId: number
  phase: RenderPhase
  effectIndex: number
  kind: ScheduledEffectKind
  dependencies: unknown[] | null
  previousDependencies: unknown[] | null
  budget?: CommitWorkBudget
}): void {
  const prepared = prepareEffectSchedule(input)
  if (prepared) publishEffectSchedule(prepared)
}

export interface PreparedEffectSchedule {
  fiber: Fiber
  budget: CommitWorkBudget | undefined
  effectEventId: string
  observationId: string | null
  commitId: number
  documentCommitId: number
  componentName: string
  effectIndex: number
  kind: ScheduledEffectKind
  phase: 'mount' | 'update'
  dependencyChanges: { slots: number[]; omitted: number; unscanned: number }
}

/** Read dependency evidence without exposing a global event until its render publishes. */
export function prepareEffectSchedule(input: {
  fiber: Fiber
  profileCommitId: number
  phase: RenderPhase
  effectIndex: number
  kind: ScheduledEffectKind
  dependencies: unknown[] | null
  previousDependencies: unknown[] | null
  budget?: CommitWorkBudget
}): PreparedEffectSchedule | null {
  if (input.phase === 'unmount') return null
  latestProfileCommitId = input.profileCommitId
  const dependencyChanges =
    input.phase === 'update'
      ? changedDependencySlots(input.dependencies, input.previousDependencies, input.budget)
      : { slots: [], omitted: 0, unscanned: 0 }
  return {
    fiber: input.fiber,
    budget: input.budget,
    effectEventId: nextCausalEventId('effect'),
    observationId: getActiveObservation()?.id ?? null,
    commitId: input.profileCommitId,
    documentCommitId: getDocumentCommitId(),
    componentName: nameOf(input.fiber),
    effectIndex: input.effectIndex,
    kind: input.kind,
    phase: input.phase,
    dependencyChanges,
  }
}

/** Publish a fully prepared event; this path performs no app-owned reads. */
export function publishEffectSchedule(
  prepared: PreparedEffectSchedule,
  publishedInstance?: InstanceDescriptor,
): void {
  publishEvent(prepared, 'scheduled', publishedInstance)
}

function publishEvent(
  prepared: PreparedEffectSchedule,
  occurrence: EffectScheduleEvent['event'],
  publishedInstance?: InstanceDescriptor,
): EffectScheduleEvent {
  const instance = publishedInstance ?? instanceForMountedFiber(prepared.fiber, prepared.budget)
  const unsupportedKind = prepared.kind !== 'effect'
  const event: EffectScheduleEvent = {
    effectEventId: prepared.effectEventId,
    effectId: `effect:${instance.mountId}:${prepared.effectIndex}`,
    observationId: prepared.observationId,
    commitId: prepared.commitId,
    documentCommitId: prepared.documentCommitId,
    componentId: instance.fiberId,
    componentName: prepared.componentName,
    mountId: instance.mountId,
    effectIndex: prepared.effectIndex,
    kind: prepared.kind,
    phase: prepared.phase,
    event: occurrence,
    evidence: 'exact',
    changedDependencySlots: prepared.dependencyChanges.slots,
    changedDependencySlotsOmitted: prepared.dependencyChanges.omitted,
    dependencySlotsUnscanned: prepared.dependencyChanges.unscanned,
    execution: {
      status: 'unobserved',
      reason: unsupportedKind ? 'unsupported-effect-kind' : 'not-yet-observed',
    },
    cleanupExecution: {
      status: 'unobserved',
      reason: unsupportedKind ? 'unsupported-effect-kind' : 'not-yet-observed',
    },
    consequences: {
      status: 'instrumented',
      observedDomains: [
        'query-notification',
        'router-notification',
        'react-update',
        'react-commit',
      ],
      unobservedDomains: [
        'asynchronous-react-update',
        'external-store-write',
        'network',
        'event-listener',
        'navigation',
      ],
      events: [],
    },
    timeline: [
      {
        stage: 'schedule',
        timestamp: Date.now(),
        evidence: 'exact',
        referenceId: prepared.effectEventId,
      },
    ],
  }
  eventFibers.set(event, prepared.fiber)
  events.push(event)
  eventsById.set(event.effectEventId, event)
  latestByEffectId.set(event.effectId, event)
  if (events.length > EFFECT_EVENT_LIMIT) {
    const evicted = events.shift()
    if (evicted) {
      eventsById.delete(evicted.effectEventId)
      pendingResultingCommit.delete(evicted.effectEventId)
      if (latestByEffectId.get(evicted.effectId) === evicted)
        latestByEffectId.delete(evicted.effectId)
    }
    droppedEvents += 1
  }
  return event
}

/** Runs an instrumented passive create and returns what React must store as its cleanup. Bookkeeping never throws into React or replaces the app's own error. */
export function runObservedPassiveEffect(
  binding: PassiveEffectBinding,
  create: () => unknown,
): unknown {
  const run = guarded(() => beginPassiveRun(binding))
  if (!run) return create()
  let cleanup: unknown
  try {
    cleanup = runInEffectContext(run.event.effectEventId, create)
  } catch (error) {
    guarded(() => {
      completeRun(run, 'threw', error)
      run.event.cleanupExecution = { status: 'unobserved', reason: 'no-cleanup-returned' }
    })
    throw error
  }
  guarded(() => completeRun(run, 'completed'))
  if (typeof cleanup !== 'function') {
    guarded(() => {
      run.event.cleanupExecution = { status: 'unobserved', reason: 'no-cleanup-returned' }
    })
    return cleanup
  }
  guarded(binding.onCleanupReturned)
  const effectEventId = run.event.effectEventId
  const destroy = cleanup as (...args: unknown[]) => unknown
  return function (this: unknown, ...args: unknown[]): unknown {
    return runObservedEffectCleanup(effectEventId, () => destroy.apply(this, args))
  }
}

export function runObservedEffectCleanup<T>(effectEventId: string, cleanup: () => T): T {
  const run = guarded(() => beginCleanupRun(effectEventId))
  if (!run) return cleanup()
  let result: T
  try {
    result = runInEffectContext(effectEventId, cleanup)
  } catch (error) {
    guarded(() => completeRun(run, 'threw', error))
    throw error
  }
  guarded(() => completeRun(run, 'completed'))
  return result
}

interface ActiveRun {
  event: EffectScheduleEvent
  stage: 'execution' | 'cleanup'
  trigger: EffectRunTrigger | null
  startedAt: number
  documentCommitId: number
  lanes: LaneSnapshot[]
  timelineEntry: EffectScheduleEvent['timeline'][number]
}

function beginPassiveRun(binding: PassiveEffectBinding): ActiveRun | null {
  const target = passiveRunTarget(binding)
  if (!target) return null
  target.event.cleanupExecution = { status: 'unobserved', reason: 'not-yet-observed' }
  return beginRun(target.event, 'execution', target.trigger)
}

/** Picks the event a run belongs to. A hidden subtree can re-render before it is shown, so React reconnects a newer effect object than the one it scheduled; the run settles that pending schedule instead of inventing a second event. */
function passiveRunTarget(
  binding: PassiveEffectBinding,
): { event: EffectScheduleEvent; trigger: EffectRunTrigger } | null {
  const bound = binding.effectEventId === null ? undefined : eventFor(binding.effectEventId)
  if (!binding.ran) {
    binding.ran = true
    if (binding.effectEventId !== null)
      return bound ? { event: bound, trigger: firstRunTrigger(bound) } : null
  } else if (bound && isStrictReplay(bound)) {
    return { event: bound, trigger: 'strict-mode-replay' }
  }
  const instance = instanceForMountedFiber(binding.fiber)
  const pending = latestByEffectId.get(`effect:${instance.mountId}:${binding.effectIndex}`)
  const target =
    pending?.execution.status === 'unobserved' && pending.execution.reason === 'not-yet-observed'
      ? pending
      : publishReconnectedEvent(binding, instance)
  binding.effectEventId = target.effectEventId
  return { event: target, trigger: 'reconnect' }
}

function publishReconnectedEvent(
  binding: PassiveEffectBinding,
  instance: InstanceDescriptor,
): EffectScheduleEvent {
  return publishEvent(
    {
      fiber: binding.fiber,
      budget: undefined,
      effectEventId: nextCausalEventId('effect'),
      observationId: getActiveObservation()?.id ?? null,
      commitId: latestProfileCommitId,
      documentCommitId: getDocumentCommitId(),
      componentName: nameOf(binding.fiber),
      effectIndex: binding.effectIndex,
      kind: 'effect',
      phase: 'update',
      dependencyChanges: { slots: [], omitted: 0, unscanned: 0 },
    },
    'reconnected',
    instance,
  )
}

function beginCleanupRun(effectEventId: string): ActiveRun | null {
  const event = eventFor(effectEventId)
  if (!event) return null
  return beginRun(event, 'cleanup', isStrictReplay(event) ? 'strict-mode-replay' : null)
}

/** React flushes a commit's passive effects before the next commit, so a first run after a later commit was deferred while its subtree was hidden. */
function firstRunTrigger(event: EffectScheduleEvent): EffectRunTrigger {
  return event.documentCommitId === getDocumentCommitId() ? 'commit' : 'reconnect'
}

/** StrictMode replays a fresh mount inside the same passive flush, before any later commit. */
function isStrictReplay(event: EffectScheduleEvent): boolean {
  const fiber = eventFibers.get(event)
  return (
    event.documentCommitId === getDocumentCommitId() &&
    fiber !== undefined &&
    ((fiber.mode ?? 0) & STRICT_EFFECTS_MODE) !== 0
  )
}

function beginRun(
  event: EffectScheduleEvent,
  stage: ActiveRun['stage'],
  trigger: EffectRunTrigger | null,
): ActiveRun {
  const timelineEntry: EffectScheduleEvent['timeline'][number] = {
    stage,
    timestamp: Date.now(),
    evidence: 'exact',
    ...(trigger === null ? {} : { trigger }),
  }
  event.timeline.push(timelineEntry)
  return {
    event,
    stage,
    trigger,
    startedAt: now(),
    documentCommitId: getDocumentCommitId(),
    lanes: snapshotRootLanes(),
    timelineEntry,
  }
}

function completeRun(run: ActiveRun, outcome: 'completed' | 'threw', error?: unknown): void {
  const completedAt = now()
  const observed: ObservedRun = {
    status: 'observed',
    evidence: 'exact',
    startedAt: round3(run.startedAt),
    completedAt: round3(completedAt),
    durationMs: round3(completedAt - run.startedAt),
    outcome,
    ...(outcome === 'threw' ? { error: errorMessage(error) } : {}),
  }
  if (run.stage === 'execution') {
    run.event.execution = { ...observed, trigger: run.trigger ?? 'commit' }
  } else {
    run.event.cleanupExecution =
      run.trigger === 'strict-mode-replay' ? { ...observed, trigger: run.trigger } : observed
  }
  run.timelineEntry.outcome = outcome
  noteReactUpdate(run)
}

interface LaneSnapshot {
  root: FiberRoot
  pending: number
  suspended: number
}

interface RootLanes {
  pendingLanes?: unknown
  suspendedLanes?: unknown
}

function laneBits(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

function snapshotRootLanes(): LaneSnapshot[] {
  return [..._fiberRoots].map((root) => {
    const lanes = root as FiberRoot & RootLanes
    return {
      root,
      pending: laneBits(lanes.pendingLanes),
      suspended: laneBits(lanes.suspendedLanes),
    }
  })
}

/** React marks a root's lanes synchronously when an update is scheduled; lanes that were already pending cannot reveal another update on them. */
function noteReactUpdate(run: ActiveRun): void {
  const timestamp = Date.now()
  if (getDocumentCommitId() > run.documentCommitId) {
    pushReactUpdate(run, timestamp)
    pushResultingCommit(run.event, run.documentCommitId + 1, timestamp, 'committed-during-run')
    return
  }
  const scheduled: PendingLanes[] = []
  let hiddenByPendingWork = false
  for (const before of run.lanes) {
    const lanes = before.root as FiberRoot & RootLanes
    const pending = laneBits(lanes.pendingLanes)
    const added = pending & ~before.pending
    const unsuspended =
      before.suspended !== 0 && laneBits(lanes.suspendedLanes) === 0 ? before.suspended : 0
    const updated = added | (unsuspended & pending)
    if (updated !== 0) scheduled.push({ root: before.root, lanes: updated })
    else if ((before.pending & ~before.suspended) !== 0) hiddenByPendingWork = true
  }
  if (scheduled.length > 0) {
    pushReactUpdate(run, timestamp)
    const waiting = pendingResultingCommit.get(run.event.effectEventId) ?? []
    pendingResultingCommit.set(run.event.effectEventId, [...waiting, ...scheduled])
  } else if (hiddenByPendingWork) {
    run.event.consequences.events.push({
      kind: 'react-update',
      stage: run.stage,
      status: 'undetermined',
      timestamp,
      evidence: 'unknown',
      reason: 'work-already-pending',
    })
  }
}

function pushReactUpdate(run: ActiveRun, timestamp: number): void {
  run.event.consequences.events.push({
    kind: 'react-update',
    stage: run.stage,
    status: 'scheduled',
    timestamp,
    evidence: 'exact',
  })
}

function pushResultingCommit(
  event: EffectScheduleEvent,
  documentCommitId: number,
  timestamp: number,
  reason: 'commit-retired-update-lanes' | 'committed-during-run',
): void {
  event.consequences.events.push({
    kind: 'resulting-commit',
    documentCommitId,
    timestamp,
    evidence: 'inferred',
    reason,
  })
  event.timeline.push({ stage: 'resulting-commit', timestamp, evidence: 'inferred' })
}

export function markEffectInstrumentationUnavailable(effectEventId: string | null): void {
  const event = effectEventId === null ? undefined : eventFor(effectEventId)
  if (!event || event.execution.status === 'observed') return
  event.execution = {
    status: 'unobserved',
    reason: 'instrumentation-unavailable',
  }
  event.cleanupExecution = {
    status: 'unobserved',
    reason: 'instrumentation-unavailable',
  }
}

/** Link each run that scheduled React work to the first commit after which its lanes are no longer pending on that root. */
export function recordResultingEffectCommit(documentCommitId: number): void {
  if (pendingResultingCommit.size === 0) return
  const timestamp = Date.now()
  for (const [effectEventId, waiting] of pendingResultingCommit) {
    const event = eventFor(effectEventId)
    if (!event) {
      pendingResultingCommit.delete(effectEventId)
      continue
    }
    const remaining = waiting.filter(
      ({ root, lanes }) => (laneBits((root as FiberRoot & RootLanes).pendingLanes) & lanes) !== 0,
    )
    if (remaining.length < waiting.length) {
      pushResultingCommit(event, documentCommitId, timestamp, 'commit-retired-update-lanes')
    }
    if (remaining.length === 0) pendingResultingCommit.delete(effectEventId)
    else pendingResultingCommit.set(effectEventId, remaining)
  }
}

function recordConsequence(signal: EffectConsequenceSignal): void {
  const event = eventFor(signal.effectEventId)
  if (!event) return
  event.consequences.events.push({
    kind: 'notification',
    domain: signal.domain,
    notificationId: signal.notificationId,
    timestamp: signal.timestamp,
    evidence: 'exact',
  })
  event.timeline.push({
    stage: 'consequence',
    timestamp: signal.timestamp,
    evidence: 'exact',
    referenceId: signal.notificationId,
  })
}

setEffectConsequenceListener(recordConsequence)

function eventFor(effectEventId: string): EffectScheduleEvent | undefined {
  return eventsById.get(effectEventId)
}

function guarded<T>(operation: () => T): T | undefined {
  try {
    return operation()
  } catch {
    return undefined
  }
}

function now(): number {
  return globalThis.performance?.now?.() ?? Date.now()
}

function round3(value: number): number {
  return Math.round(value * 1_000) / 1_000
}

/** Reads only an own data `message`, so a thrown Proxy, getter, or toString never runs on Genie's behalf. */
function errorMessage(error: unknown): string {
  if (typeof error === 'function') return 'a function was thrown'
  if (typeof error !== 'object' || error === null)
    return String(error).slice(0, ERROR_MESSAGE_LIMIT)
  const descriptor = isKnownProxy(error) ? undefined : safeOwnPropertyDescriptor(error, 'message')
  const message = isDataDescriptor(descriptor) ? descriptor.value : undefined
  return typeof message === 'string'
    ? message.slice(0, ERROR_MESSAGE_LIMIT)
    : 'a thrown object without a readable message'
}

export function getEffectScheduleEvents(query: {
  component?: string
  afterDocumentCommitId?: number
  limit: number
}): {
  observation: ObservationWindow | null
  events: EffectScheduleEvent[]
  omittedByLimit: number
  evictedEvents: number
  droppedEvents: number
  refreshCommitsExcluded: number
} {
  const needle = query.component?.toLowerCase()
  const matching = events
    .filter(
      (event) =>
        query.afterDocumentCommitId === undefined ||
        event.documentCommitId > query.afterDocumentCommitId,
    )
    .filter((event) => !needle || event.componentName.toLowerCase().includes(needle))
  const selected = matching.slice(-query.limit).reverse()
  return {
    observation: getActiveObservation(),
    events: selected,
    omittedByLimit: Math.max(0, matching.length - query.limit),
    evictedEvents: droppedEvents,
    droppedEvents,
    refreshCommitsExcluded: getExcludedRefreshCommitTotal() - refreshCommitBaseline,
  }
}

export function changedDependencySlots(
  current: unknown[] | null,
  previous: unknown[] | null,
  budget?: CommitWorkBudget,
): { slots: number[]; omitted: number; unscanned: number } {
  if (!Array.isArray(current) || !Array.isArray(previous)) {
    return { slots: [], omitted: 0, unscanned: 0 }
  }
  const length = Math.max(current.length, previous.length)
  const scanned = Math.min(length, DEPENDENCY_SCAN_LIMIT)
  const slots: number[] = []
  let omitted = 0
  for (let index = 0; index < scanned; index += 1) {
    if (!consumeCommitWork(budget, 'effect-dependencies')) {
      return { slots, omitted, unscanned: length - index }
    }
    let changed = false
    try {
      changed = !Object.is(current[index], previous[index])
    } catch {
      return { slots, omitted, unscanned: length - index }
    }
    if (!changed) continue
    if (slots.length < CHANGED_DEPENDENCY_LIMIT) slots.push(index)
    else omitted += 1
  }
  return { slots, omitted, unscanned: Math.max(0, length - scanned) }
}

export async function getEffectScheduleEventsWithOwnership(query: {
  component?: string
  afterDocumentCommitId?: number
  limit: number
  appOnly?: boolean
}) {
  const report = getEffectScheduleEvents({ ...query, limit: EFFECT_EVENT_LIMIT })
  const fibers = report.events.map((event) => eventFibers.get(event))
  const captured = safeStructuredClone(report)
  const present = fibers.filter((fiber): fiber is Fiber => fiber !== undefined)
  const { classes } = await classifyFibersWithinBudget(present)
  let index = 0
  const enriched = captured.events.map((event, eventIndex) => {
    const source = fibers[eventIndex] ? classes[index++] : undefined
    return {
      ...event,
      sourceOwnership: source?.ownership ?? ('unknown' as const),
      source: source?.source ?? null,
    }
  })
  const selected = enriched.filter((event) => !query.appOnly || event.sourceOwnership === 'app')
  return {
    ...captured,
    events: selected.slice(0, query.limit),
    omittedByLimit: Math.max(0, selected.length - query.limit),
    ownershipCoverage: ownershipCoverage(enriched.map((event) => event.sourceOwnership)),
  }
}
