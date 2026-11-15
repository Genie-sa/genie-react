import { type Fiber, getDisplayName } from 'bippy'
import { parseStack } from 'bippy/source'
import { isDataDescriptor, isPlainObject, safeOwnPropertyDescriptor } from '../causal/safe-object'
import { rendererBundleOf } from './measurement-environment'
import { getDocumentCommitId } from './observation'
import type { RenderCause } from './render-causes'
import { type ResolvedStackFrame, resolveStackFrame, servedStackFrame } from './source'
import { isClassComponentFiber } from './work-tags'

export type ClassUpdateMethod = 'setState' | 'forceUpdate'

/** Where the call ran: inside a lifecycle Genie wrapped (exact), inside React work it did not wrap or a DOM event dispatch (inferred), or neither (unknown). */
export type ClassUpdatePhase = 'lifecycle' | 'react-work' | 'event' | 'callback'

export interface ClassUpdate {
  method: ClassUpdateMethod
  phase: ClassUpdatePhase
  evidence: 'exact' | 'inferred' | 'unknown'
  /** The lifecycle method that was running when the call was made. */
  lifecycle?: string
  /** The class whose lifecycle was running; another component when it updated this one through a ref. */
  component?: string
  eventType?: string
  /** Top-level keys of an object passed to setState; null for an updater function or forceUpdate. */
  fields: string[] | null
  caller: ResolvedStackFrame | null
}

/** The render cause fields for the calls a render applied; empty when none was recorded. */
export interface ClassUpdateFields {
  classUpdates?: ClassUpdate[]
  classUpdatesOmitted?: number
}

interface RecordedCall {
  update: ClassUpdate
  rawCaller: StackFrame | undefined
  /** The last commit Genie analyzed before the call. */
  commitAtCall: number
  /** Made while React committed: in a commit-phase lifecycle, a layout effect or a ref callback. */
  duringCommit: boolean
  stateAtCall: unknown
  payload: unknown
}

interface PendingCalls {
  calls: RecordedCall[]
  dropped: number
}

interface ActivePhase {
  lifecycle: string
  instance: unknown
}

/** Every lifecycle but render, whose wrapper would show in the owner stack React records for each element it creates. */
const WRAPPED_LIFECYCLES = [
  'componentDidMount',
  'componentDidUpdate',
  'componentWillUnmount',
  'componentDidCatch',
  'shouldComponentUpdate',
  'getSnapshotBeforeUpdate',
  'UNSAFE_componentWillMount',
  'UNSAFE_componentWillReceiveProps',
  'UNSAFE_componentWillUpdate',
  'componentWillMount',
  'componentWillReceiveProps',
  'componentWillUpdate',
] as const
const COMMIT_LIFECYCLES: ReadonlySet<string> = new Set([
  'componentDidMount',
  'componentDidUpdate',
  'componentWillUnmount',
  'componentDidCatch',
  'getSnapshotBeforeUpdate',
])
const UPDATE_METHODS: readonly ClassUpdateMethod[] = ['setState', 'forceUpdate']
const CALLS_PER_INSTANCE = 32
const FIELD_LIMIT = 20
const QUEUE_WALK_LIMIT = 200
const FORCE_UPDATE_TAG = 2
const COMMITTED_LANE = 0
const EVENT_PHASE_NONE = 0
/** callerFrames, recordCall and the wrapper itself, where Error.captureStackTrace cannot drop them. */
const OWN_FRAMES = 3
const CALLER_CACHE_LIMIT = 500
const CALLER_RESOLVE_BUDGET_MS = 250

type StackFrame = ReturnType<typeof parseStack>[number]
/** React's own functions that run app callbacks while it renders or commits: renders, effects, ref callbacks and class lifecycles. */
const REACT_WORK_FRAME =
  /^(?:commitHook\w*|commitLayoutEffectOnFiber|commitClassLayoutLifecycles|commitPassive\w*OnFiber|commitAttachRef|safelyAttachRef|renderWithHooks|finishClassComponent|updateClassInstance|mountClassInstance|flushPassiveEffects\w*|commitRoot\w*|flushLayoutEffects|recursivelyTraverse\w*Effects\w*)$/
/** Passive effects run after the commit Genie analyzes, so their calls belong to the next render like any other. */
const PASSIVE_EFFECT_FRAME =
  /^(?:commitHookPassive\w*|commitPassive\w*OnFiber|flushPassiveEffects\w*|recursivelyTraversePassive\w*)$/

const OWN_FILE = ownModuleFile()

let instrumentedPrototypes = new WeakSet<object>()
const wrappedMethods = new WeakMap<object, Set<string>>()
const restorers: (() => void)[] = []
const pendingByInstance = new WeakMap<object, PendingCalls>()
const activePhases: ActivePhase[] = []
let isRecording: () => boolean = () => false

/** Wraps the class's lifecycles and the setState and forceUpdate it inherits, once per prototype, in development renderers only; the wrappers forward every call unchanged and record only while `recording` holds. */
export function instrumentClassFiber(fiber: Fiber, recording: () => boolean): void {
  if (!isClassComponentFiber(fiber)) return
  isRecording = recording
  const instance: unknown = fiber.stateNode
  if (typeof instance !== 'object' || instance === null) return
  const prototype = Object.getPrototypeOf(instance) as object | null
  if (prototype === null || instrumentedPrototypes.has(prototype)) return
  instrumentedPrototypes.add(prototype)
  if (rendererBundleOf([fiber]) !== 'development') return
  for (const name of WRAPPED_LIFECYCLES) wrapDefiningMethod(prototype, name, lifecycleWrapper(name))
  for (const method of UPDATE_METHODS) wrapDefiningMethod(prototype, method, updateWrapper(method))
}

/** Puts back every method Genie wrapped; a wrapper someone captured keeps forwarding and records nothing. */
export function restoreClassInstrumentation(): void {
  isRecording = () => false
  instrumentedPrototypes = new WeakSet()
  for (const restore of restorers.splice(0).reverse()) restore()
}

/** The calls on this instance that the committed render applied, in call order. A call joins only when it was made against the state this render started from, before this commit began committing, and React no longer holds its update. A call made while this commit committed, such as in componentDidUpdate, or against the new state waits for the next render; anything else, including an update React rebased from another state, is dropped rather than guessed. */
export function takeClassUpdates(fiber: Fiber): ClassUpdateFields {
  const instance: unknown = fiber.stateNode
  if (typeof instance !== 'object' || instance === null) return {}
  const pending = pendingByInstance.get(instance)
  if (!pending) return {}
  const previousCommit = getDocumentCommitId() - 1
  const previousState = fiber.alternate?.memoizedState ?? null
  const nextState = fiber.memoizedState
  const stillQueued = queuedUpdates(fiber)
  const applied: ClassUpdate[] = []
  const waiting: RecordedCall[] = []
  for (const call of pending.calls) {
    const thisCommit = call.duringCommit && call.commitAtCall === previousCommit
    if (thisCommit || isStillQueued(call, stillQueued)) waiting.push(call)
    else if (call.stateAtCall === previousState) {
      applied.push(call.update)
      resolveCallerLater(call)
    } else if (call.stateAtCall === nextState) waiting.push(call)
  }
  const omitted = pending.dropped
  if (waiting.length > 0) pendingByInstance.set(instance, { calls: waiting, dropped: 0 })
  else pendingByInstance.delete(instance)
  return {
    ...(applied.length > 0 ? { classUpdates: applied } : {}),
    ...(omitted > 0 ? { classUpdatesOmitted: omitted } : {}),
  }
}

function wrapDefiningMethod(
  prototype: object,
  name: string,
  wrap: (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown,
): void {
  const owner = definingPrototype(prototype, name)
  if (owner === null || wrappedMethods.get(owner)?.has(name)) return
  const descriptor = safeOwnPropertyDescriptor(owner, name)
  if (!isDataDescriptor(descriptor) || typeof descriptor.value !== 'function') return
  if (descriptor.writable !== true || descriptor.configurable !== true) return
  const original = descriptor.value as (...args: unknown[]) => unknown
  const wrapper = wrap(original)
  copyFunctionIdentity(original, wrapper)
  try {
    Object.defineProperty(owner, name, { ...descriptor, value: wrapper })
  } catch {
    return
  }
  const names = wrappedMethods.get(owner) ?? new Set<string>()
  names.add(name)
  wrappedMethods.set(owner, names)
  restorers.push(() => {
    names.delete(name)
    const current = safeOwnPropertyDescriptor(owner, name)
    if (isDataDescriptor(current) && current.value === wrapper) {
      Object.defineProperty(owner, name, descriptor)
    }
  })
}

function definingPrototype(start: object, name: string): object | null {
  for (let current: object | null = start; current !== null; ) {
    const descriptor = safeOwnPropertyDescriptor(current, name)
    if (descriptor === undefined) return null
    if (descriptor !== null) return current
    if (current === Object.prototype) return null
    current = Object.getPrototypeOf(current) as object | null
  }
  return null
}

/** Keeps name, length and flags such as react-lifecycles-compat's __suppressDeprecationWarning, which React reads off the method. */
function copyFunctionIdentity(original: object, wrapper: object): void {
  for (const key of Reflect.ownKeys(original)) {
    if (key === 'prototype' || key === 'arguments' || key === 'caller') continue
    const descriptor = safeOwnPropertyDescriptor(original, key)
    if (!descriptor) continue
    try {
      Object.defineProperty(wrapper, key, descriptor)
    } catch {}
  }
}

function lifecycleWrapper(lifecycle: string) {
  return (original: (...args: unknown[]) => unknown) =>
    function genieLifecycle(this: unknown, ...args: unknown[]): unknown {
      if (!isRecording()) return original.apply(this, args)
      activePhases.push({ lifecycle, instance: this })
      try {
        return original.apply(this, args)
      } finally {
        activePhases.pop()
      }
    }
}

function updateWrapper(method: ClassUpdateMethod) {
  return (original: (...args: unknown[]) => unknown) =>
    function genieClassUpdate(this: unknown, ...args: unknown[]): unknown {
      const recorded =
        typeof this === 'object' && this !== null && isRecording()
          ? recordCall(this, method, method === 'setState' ? args[0] : null, genieClassUpdate)
          : null
      try {
        return original.apply(this, args)
      } catch (error) {
        if (recorded) forgetCall(recorded)
        throw error
      }
    }
}

/** Recorded before React sees the call, because a legacy root renders and commits inside setState. */
function recordCall(
  instance: object,
  method: ClassUpdateMethod,
  payload: unknown,
  wrapper: (...args: unknown[]) => unknown,
): { instance: object; call: RecordedCall } | null {
  try {
    const frames = callerFrames(wrapper)
    const [caller] = frames
    const { duringCommit, ...phase } = phaseOf(frames)
    const call: RecordedCall = {
      update: {
        method,
        ...phase,
        fields: payloadFields(payload),
        caller: caller ? servedStackFrame(caller) : null,
      },
      rawCaller: caller,
      commitAtCall: getDocumentCommitId(),
      duringCommit,
      stateAtCall: Reflect.get(instance, 'state'),
      payload,
    }
    const pending = pendingByInstance.get(instance) ?? { calls: [], dropped: 0 }
    if (pending.calls.length >= CALLS_PER_INSTANCE) {
      pending.calls.shift()
      pending.dropped += 1
    }
    pending.calls.push(call)
    pendingByInstance.set(instance, pending)
    return { instance, call }
  } catch {
    return null
  }
}

function forgetCall({ instance, call }: { instance: object; call: RecordedCall }): void {
  const pending = pendingByInstance.get(instance)
  if (!pending) return
  pending.calls = pending.calls.filter((entry) => entry !== call)
}

function phaseOf(frames: StackFrame[]): Pick<
  ClassUpdate,
  'phase' | 'evidence' | 'lifecycle' | 'component' | 'eventType'
> & {
  duringCommit: boolean
} {
  const active = activePhases.at(-1)
  if (active) {
    return {
      phase: 'lifecycle',
      evidence: 'exact',
      lifecycle: active.lifecycle,
      component: componentNameOf(active.instance),
      duringCommit: COMMIT_LIFECYCLES.has(active.lifecycle),
    }
  }
  const names = frames.map((frame) => bareFunctionName(frame.functionName))
  if (names.some((name) => REACT_WORK_FRAME.test(name))) {
    return {
      phase: 'react-work',
      evidence: 'inferred',
      duringCommit: !names.some((name) => PASSIVE_EFFECT_FRAME.test(name)),
    }
  }
  const eventType = dispatchingEventType()
  if (eventType !== null) {
    return { phase: 'event', evidence: 'inferred', eventType, duringCommit: false }
  }
  return { phase: 'callback', evidence: 'unknown', duringCommit: false }
}

/** Whether a parsed stack frame runs Genie's own code, such as a lifecycle wrapper, which V8 names after the method it wraps; it is never the app's, and its file can be on the hub's origin. */
export function isGenieFrame(frame: { fileName?: string }): boolean {
  return OWN_FILE !== undefined && frame.fileName === OWN_FILE
}

function ownModuleFile(): string | undefined {
  try {
    return parseStack(new Error().stack ?? '')[0]?.fileName
  } catch {
    return undefined
  }
}

function bareFunctionName(name: string | undefined): string {
  if (name === undefined) return ''
  return name.slice(name.lastIndexOf('.') + 1)
}

/** The type of the DOM event being dispatched right now; `window.event` can keep an event whose dispatch ended, which no longer has a phase. */
function dispatchingEventType(): string | null {
  try {
    const event: unknown = Reflect.get(globalThis, 'event')
    if (typeof event !== 'object' || event === null) return null
    if (Reflect.get(event, 'eventPhase') === EVENT_PHASE_NONE) return null
    const type: unknown = Reflect.get(event, 'type')
    return typeof type === 'string' ? type : null
  } catch {
    return null
  }
}

function callerFrames(wrapper: (...args: unknown[]) => unknown): StackFrame[] {
  const holder: { stack?: string } = {}
  const capture = (Error as { captureStackTrace?: (target: object, above: unknown) => void })
    .captureStackTrace
  if (typeof capture === 'function') {
    capture(holder, wrapper)
    return parseStack(holder.stack ?? '')
  }
  return parseStack(new Error().stack ?? '').slice(OWN_FRAMES)
}

function payloadFields(payload: unknown): string[] | null {
  if (!isPlainObject(payload)) return null
  return Object.keys(payload).slice(0, FIELD_LIMIT)
}

function componentNameOf(instance: unknown): string {
  if (typeof instance !== 'object' || instance === null) return 'Unknown'
  const type: unknown = Reflect.get(instance, 'constructor')
  return (typeof type === 'function' && getDisplayName(type)) || 'Unknown'
}

interface QueuedUpdate {
  lane?: unknown
  tag?: unknown
  payload?: unknown
  next?: QueuedUpdate | null
}

/** Updates React still holds for this class after the commit: skipped by a lower-priority render, or scheduled after it began. A committed update stays in the base queue with no lane, only so a skipped one can be rebased on it, and is left out. */
function queuedUpdates(fiber: Fiber): QueuedUpdate[] {
  const queue = fiber.updateQueue as {
    firstBaseUpdate?: QueuedUpdate | null
    shared?: { pending?: QueuedUpdate | null } | null
  } | null
  const walked: QueuedUpdate[] = []
  try {
    for (
      let update = queue?.firstBaseUpdate ?? null;
      update && walked.length < QUEUE_WALK_LIMIT;
      update = update.next ?? null
    ) {
      walked.push(update)
    }
    const last = queue?.shared?.pending ?? null
    for (
      let update = last?.next ?? null;
      update && walked.length < QUEUE_WALK_LIMIT;
      update = update === last ? null : (update.next ?? null)
    ) {
      walked.push(update)
    }
  } catch {}
  return walked.filter((update) => update.lane !== COMMITTED_LANE)
}

function isStillQueued(call: RecordedCall, queued: QueuedUpdate[]): boolean {
  if (call.update.method === 'forceUpdate') {
    return queued.some((update) => update.tag === FORCE_UPDATE_TAG)
  }
  return queued.some((update) => update.payload === call.payload)
}

function isSameOrigin(file: string | undefined): boolean {
  if (!file) return false
  const pageOrigin: unknown = Reflect.get(globalThis, 'location')?.origin
  try {
    const url = new URL(file, typeof pageOrigin === 'string' ? pageOrigin : undefined)
    return !/^https?:$/.test(url.protocol) || url.origin === pageOrigin
  } catch {
    return true
  }
}

interface CallerResolution {
  pending: Promise<void>
  resolved: ResolvedStackFrame | null
}

const callerResolutions = new Map<string, CallerResolution>()

const callerKey = (frame: ResolvedStackFrame): string =>
  `${frame.file}:${frame.line}:${frame.column}:${frame.functionName}`

/** Starts the source-map lookup for an applied call's caller once per call site, off the commit path. A caller served from another origin, such as Genie's own client on a standalone hub, keeps its served position: fetching its map would put a CORS error in the app's console. */
function resolveCallerLater(call: RecordedCall): void {
  const { caller } = call.update
  if (!caller || !call.rawCaller || !isSameOrigin(call.rawCaller.fileName)) return
  const key = callerKey(caller)
  if (callerResolutions.has(key)) return
  if (callerResolutions.size >= CALLER_CACHE_LIMIT) callerResolutions.clear()
  const resolution: CallerResolution = { pending: Promise.resolve(), resolved: null }
  resolution.pending = resolveStackFrame(call.rawCaller).then(
    (frame) => {
      if (frame.mapping === 'mapped') resolution.resolved = frame
    },
    () => undefined,
  )
  callerResolutions.set(key, resolution)
}

/** Waits, at most CALLER_RESOLVE_BUDGET_MS, for the caller lookups these causes need, so a report shows original positions; a slower lookup leaves the served position. */
export async function resolveClassUpdateCallers(
  causeLists: Iterable<readonly RenderCause[]>,
): Promise<void> {
  const pending = new Set<Promise<void>>()
  for (const causes of causeLists) {
    for (const cause of causes) {
      const updates = cause.kind === 'state' || cause.kind === 'unknown' ? cause.classUpdates : []
      for (const { caller } of updates ?? []) {
        const resolution = caller ? callerResolutions.get(callerKey(caller)) : undefined
        if (resolution) pending.add(resolution.pending)
      }
    }
  }
  if (pending.size === 0) return
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      Promise.all(pending),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, CALLER_RESOLVE_BUDGET_MS)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/** The cause with each caller replaced by its source-mapped position where a lookup has finished. */
export function withResolvedCallers<Cause extends { classUpdates?: ClassUpdate[] }>(
  cause: Cause,
): Cause {
  if (!cause.classUpdates) return cause
  return {
    ...cause,
    classUpdates: cause.classUpdates.map((update) => {
      const resolved = update.caller
        ? callerResolutions.get(callerKey(update.caller))?.resolved
        : null
      return resolved ? { ...update, caller: resolved } : update
    }),
  }
}
