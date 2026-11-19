import { dehydrate } from '../../protocol'
import {
  type ReduxStoreTapView,
  type ReduxTimelineEntry,
  registerReduxStoreTap,
  unregisterReduxStoreTap,
} from '../causal/redux-store-registry'
import { currentlyRenderingFiber } from '../causal/render-started-queries'
import { isDataDescriptor, safeOwnPropertyDescriptor } from '../causal/safe-object'
import {
  compareState,
  DEFAULT_SCAN_LIMITS,
  type MutationFinding,
  refreshState,
  type StateSnapshot,
} from './state-scan'

/** The parts of a Redux 4/5 or Redux Toolkit store Genie touches; typed structurally so no Redux types reach the public surface. */
export interface ReduxStoreLike {
  dispatch: (...args: never[]) => unknown
  getState: () => unknown
  subscribe: (listener: () => void) => unknown
}

export interface ReduxCollectorOptions {
  /** Store name shown to the agent; defaults to `store` plus a number. */
  name?: string
  /** Compare state objects before and after each action to catch in-place mutation. Defaults to true. */
  detectMutations?: boolean
  /** Records kept in the history, from 1 to 5000. Defaults to 500. Each record holds a depth-bounded copy of its action. */
  historyLimit?: number
  /** Keep RTK Query's own actions, and the anonymous thunks that dispatch only those, as full records. Defaults to false: they are counted by type instead, so a burst of them cannot evict the app's actions. */
  recordLibraryActions?: boolean
}

export interface ReduxLibraryActionCount {
  kind: 'action' | 'thunk' | 'unrecorded-change'
  type: string | null
  count: number
}

export interface ReduxLibraryActionSummary {
  recorded: boolean
  counted: number
  byType: ReduxLibraryActionCount[]
  otherTypesCount: number
}

export interface ReduxMutationReport {
  status: 'none-detected' | 'detected' | 'not-scanned'
  notScannedReason:
    | 'nested-dispatch'
    | 'not-a-plain-action'
    | 'state-not-scannable'
    | 'disabled'
    | 'dispatch-threw'
    | null
  findings: MutationFinding[]
  findingsOmitted: boolean
  objectsCompared: number
  scanTruncated: boolean
}

export interface ReduxDispatchRecord extends ReduxTimelineEntry {
  label: string
  parentActionId: string | null
  timestamp: number
  outcome: 'returned' | 'threw' | 'in-progress' | 'detected'
  error: string | null
  payload: unknown
  changedSlicesTruncated: boolean
  mutation: ReduxMutationReport
  genieMs: number
}

export interface ReduxStoreTap extends ReduxStoreTapView {
  name: string
  records: () => readonly ReduxDispatchRecord[]
  evictedRecords: () => number
  latestSequence: () => number
  libraryActions: () => ReduxLibraryActionSummary
  readState: () => unknown
  detectMutations: boolean
  historyLimit: number
  dispose: () => void
}

export type ReduxInstallResult = { ok: true; tap: ReduxStoreTap } | { ok: false; reason: string }

export const DEFAULT_HISTORY_LIMIT = 500
export const MAX_HISTORY_LIMIT = 5000
const LIBRARY_TYPE_LIMIT = 50
const ANONYMOUS_THUNK = 'anonymous thunk'
const SLICE_LIMIT = 100
const FINDING_LIMIT = 10
const PAYLOAD_LIMITS = { depth: 3, maxEntries: 25, maxStringLength: 200 }

let storeSequence = 0

const reactClock = typeof performance !== 'undefined' && typeof performance.now === 'function'
const now = reactClock ? () => performance.now() : () => Date.now()

const NOT_SCANNED_ACTION: ReduxMutationReport = notScanned('not-a-plain-action')

/** Call once per store (reduxCollector caches it). Wraps the store's public dispatch, and the dispatch each thunk receives, without changing what any dispatch returns or throws. */
export function instrumentReduxStore(
  store: ReduxStoreLike,
  options: ReduxCollectorOptions = {},
): ReduxInstallResult {
  const dispatchDescriptor = safeOwnPropertyDescriptor(store, 'dispatch')
  const original = isDataDescriptor(dispatchDescriptor) ? dispatchDescriptor.value : undefined
  if (typeof original !== 'function') {
    return { ok: false, reason: 'store.dispatch is not an own function property of the store.' }
  }
  if (!dispatchDescriptor?.writable && !dispatchDescriptor?.configurable) {
    return { ok: false, reason: 'store.dispatch is read-only, so Genie cannot record actions.' }
  }
  if (typeof store.getState !== 'function' || typeof store.subscribe !== 'function') {
    return { ok: false, reason: 'The value passed is not a Redux store (no getState/subscribe).' }
  }

  storeSequence += 1
  const storeId = `redux-store:${storeSequence}`
  const subscribe = store.subscribe
  const getState = (): unknown => store.getState()
  const detectMutations = options.detectMutations !== false
  const historyLimit = resolveHistoryLimit(options.historyLimit)
  const recordLibraryActions = options.recordLibraryActions === true
  const records: ReduxDispatchRecord[] = []
  const stateChanges: ReduxDispatchRecord[] = []
  let sequence = 0
  let evicted = 0
  let evictedStateChanges = 0
  let active = true
  let listenerCalls = 0
  let lastKnownState = readState()
  let retained: StateSnapshot | null = null
  const plainStack: { record: ReduxDispatchRecord; listenerCalls: number; nested: number }[] = []
  const thunkStack: {
    record: ReduxDispatchRecord
    appChildren: number
    libraryChildren: number
  }[] = []
  const libraryCounts = new Map<string, ReduxLibraryActionCount>()
  let libraryCounted = 0
  let libraryOtherTypes = 0

  function readState(): unknown {
    try {
      return getState()
    } catch {
      return undefined
    }
  }

  function createRecord(
    fields: Pick<ReduxDispatchRecord, 'kind' | 'type' | 'label' | 'parentActionId'> &
      Partial<ReduxDispatchRecord>,
  ): ReduxDispatchRecord {
    sequence += 1
    const startedAt = now()
    return {
      actionId: `${storeId}/action:${sequence}`,
      sequence,
      startedAt,
      endedAt: null,
      stateSeenAt: null,
      reactWorkActive: currentlyRenderingFiber() !== null,
      rootStateChanged: null,
      changedSlices: [],
      changedSlicesTruncated: false,
      unrecordedNestedDispatches: 0,
      renderEventIds: [],
      timestamp: Date.now(),
      outcome: 'in-progress',
      error: null,
      payload: null,
      mutation: NOT_SCANNED_ACTION,
      genieMs: 0,
      ...fields,
    }
  }

  function keep(record: ReduxDispatchRecord, library: boolean): void {
    if (library && !recordLibraryActions) {
      countLibraryRecord(record)
      return
    }
    records.push(record)
    trimHistory()
  }

  /** Thunks still running are classified when they return, so they do not count against the limit until then. */
  function trimHistory(): void {
    while (records.length - thunkStack.length > historyLimit) {
      records.shift()
      evicted += 1
    }
  }

  function countLibraryRecord(record: ReduxDispatchRecord): void {
    libraryCounted += 1
    const kind = record.kind as ReduxLibraryActionCount['kind']
    const key = `${kind}:${record.type ?? ''}`
    const existing = libraryCounts.get(key)
    if (existing) existing.count += 1
    else if (libraryCounts.size < LIBRARY_TYPE_LIMIT) {
      libraryCounts.set(key, { kind, type: record.type, count: 1 })
    } else libraryOtherTypes += 1
  }

  function noteChild(parentActionId: string | null, library: boolean): void {
    if (parentActionId === null) return
    const parent = thunkStack.findLast((frame) => frame.record.actionId === parentActionId)
    if (!parent) return
    if (library) parent.libraryChildren += 1
    else parent.appChildren += 1
  }

  function onStoreChange(): void {
    if (!active) return
    listenerCalls += 1
    const state = readState()
    if (Object.is(state, lastKnownState)) return
    const innermost = plainStack.at(-1)
    if (innermost) {
      innermost.record.stateSeenAt ??= now()
    } else {
      const record = createRecord({
        kind: 'unrecorded-change',
        type: null,
        label: 'state changed without a recorded dispatch',
        parentActionId: null,
        outcome: 'detected',
      })
      record.endedAt = record.startedAt
      record.stateSeenAt = record.startedAt
      describeChange(record, lastKnownState, state)
      keep(record, touchesOnlyLibrarySlices(record, state))
    }
    lastKnownState = state
  }

  const unsubscribe = subscribe.call(store, onStoreChange)

  function instrument(target: (...args: unknown[]) => unknown, parentActionId: string | null) {
    return function genieReduxDispatch(this: unknown, ...args: unknown[]): unknown {
      if (!active) return target.apply(this, args)
      return typeof args[0] === 'function'
        ? dispatchThunk(target, this, args, parentActionId)
        : dispatchAction(target, this, args, parentActionId)
    }
  }

  function dispatchThunk(
    target: (...args: unknown[]) => unknown,
    thisArg: unknown,
    args: unknown[],
    parentActionId: string | null,
  ): unknown {
    const thunk = args[0] as (...thunkArgs: unknown[]) => unknown
    const record = createRecord({
      kind: 'thunk',
      type: null,
      label: thunkName(thunk),
      parentActionId,
    })
    const frame = { record, appChildren: 0, libraryChildren: 0 }
    thunkStack.push(frame)
    keep(record, false)
    const traced = new Proxy(thunk, {
      apply(callee, receiver, thunkArgs: unknown[]) {
        const [inner, ...rest] = thunkArgs
        const forwarded =
          typeof inner === 'function'
            ? [instrument(inner as (...a: unknown[]) => unknown, record.actionId), ...rest]
            : thunkArgs
        return Reflect.apply(callee, receiver, forwarded)
      },
    })
    try {
      return settle(record, () => target.apply(thisArg, [traced, ...args.slice(1)]))
    } finally {
      thunkStack.pop()
      const library =
        record.label === ANONYMOUS_THUNK && frame.appChildren === 0 && frame.libraryChildren > 0
      noteChild(parentActionId, library)
      if (library && !recordLibraryActions) {
        const index = records.lastIndexOf(record)
        if (index >= 0) records.splice(index, 1)
        countLibraryRecord(record)
      }
      trimHistory()
    }
  }

  function dispatchAction(
    target: (...args: unknown[]) => unknown,
    thisArg: unknown,
    args: unknown[],
    parentActionId: string | null,
  ): unknown {
    const genieStarted = now()
    const action = args[0]
    const type = actionType(action)
    const nested = plainStack.length > 0
    const before = readState()
    const outside = nested ? null : scanOutsideDispatch(before)
    const parent = plainStack.at(-1)
    if (parent) parent.nested += 1
    const record = createRecord({
      kind: 'action',
      type,
      label: type ?? 'non-action value',
      parentActionId: parentActionId ?? parent?.record.actionId ?? null,
      payload: dehydrate(action, PAYLOAD_LIMITS),
    })
    const library = isLibraryActionType(type, before)
    keep(record, library)
    noteChild(record.parentActionId, library)
    const frame = { record, listenerCalls, nested: 0 }
    plainStack.push(frame)
    let threw = false
    try {
      return settle(
        record,
        () => target.apply(thisArg, args),
        () => {
          threw = true
        },
      )
    } finally {
      plainStack.pop()
      const after = readState()
      describeChange(record, before, after)
      record.unrecordedNestedDispatches = Math.max(
        0,
        listenerCalls - frame.listenerCalls - frame.nested - 1,
      )
      record.mutation = nested
        ? notScanned('nested-dispatch')
        : threw
          ? notScanned('dispatch-threw')
          : scanInsideDispatch(outside, after)
      lastKnownState = after
      record.genieMs = now() - genieStarted - ((record.endedAt ?? now()) - record.startedAt)
    }
  }

  function settle(record: ReduxDispatchRecord, run: () => unknown, onThrow?: () => void): unknown {
    try {
      const result = run()
      record.outcome = 'returned'
      return result
    } catch (error) {
      record.outcome = 'threw'
      record.error =
        error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300)
      onThrow?.()
      throw error
    } finally {
      record.endedAt = now()
    }
  }

  /** Compares the snapshot the previous action left: anything changed in place since then changed outside a recorded dispatch. Returns this action's before-snapshot. */
  function scanOutsideDispatch(before: unknown): StateSnapshot | null {
    if (!detectMutations) return null
    if (retained) {
      const comparison = compareState(retained, FINDING_LIMIT + 1)
      if (comparison.findings.length > 0) {
        const record = createRecord({
          kind: 'mutation-outside-dispatch',
          type: null,
          label: 'state changed in place outside any dispatch',
          parentActionId: null,
          outcome: 'detected',
        })
        keep(record, false)
        record.endedAt = record.startedAt
        record.rootStateChanged = false
        record.mutation = mutationReport(comparison, retained)
        retained = null
      }
    }
    return refreshState(retained, before, DEFAULT_SCAN_LIMITS)
  }

  function scanInsideDispatch(snapshot: StateSnapshot | null, after: unknown): ReduxMutationReport {
    if (!detectMutations || !snapshot) {
      retained = null
      return notScanned('disabled')
    }
    if (!snapshot.rootSignature) {
      retained = refreshState(null, after, DEFAULT_SCAN_LIMITS)
      return notScanned('state-not-scannable')
    }
    const comparison = compareState(snapshot, FINDING_LIMIT + 1)
    const report = mutationReport(comparison, snapshot)
    retained = refreshState(
      comparison.findings.length > 0 ? null : snapshot,
      after,
      DEFAULT_SCAN_LIMITS,
    )
    return report
  }

  /** Records the change and keeps state changes in their own history, so a burst of actions that change nothing cannot evict what the render join needs. */
  function describeChange(record: ReduxDispatchRecord, before: unknown, after: unknown): void {
    record.rootStateChanged = !Object.is(before, after)
    const changed = changedSlices(before, after)
    record.changedSlices = changed.slices
    record.changedSlicesTruncated = changed.truncated
    if (!record.rootStateChanged) return
    stateChanges.push(record)
    if (stateChanges.length > historyLimit) {
      stateChanges.shift()
      evictedStateChanges += 1
    }
  }

  const instrumented = instrument(original as (...args: unknown[]) => unknown, null)
  try {
    Object.defineProperty(store, 'dispatch', { ...dispatchDescriptor, value: instrumented })
  } catch {
    if (typeof unsubscribe === 'function') unsubscribe()
    return { ok: false, reason: 'store.dispatch could not be replaced.' }
  }

  const tap: ReduxStoreTap = {
    storeId,
    name: options.name ?? `store ${storeSequence}`,
    store,
    subscribe,
    reactClock,
    installedAt: now(),
    detectMutations,
    historyLimit,
    entries: () => stateChanges,
    evictedEntries: () => evictedStateChanges,
    records: () => records,
    evictedRecords: () => evicted,
    latestSequence: () => sequence,
    libraryActions: () => ({
      recorded: recordLibraryActions,
      counted: libraryCounted,
      byType: [...libraryCounts.values()]
        .map((entry) => ({ ...entry }))
        .sort((left, right) => right.count - left.count),
      otherTypesCount: libraryOtherTypes,
    }),
    readState,
    dispose() {
      active = false
      if (typeof unsubscribe === 'function') unsubscribe()
      const current = safeOwnPropertyDescriptor(store, 'dispatch')
      if (isDataDescriptor(current) && current.value === instrumented) {
        Object.defineProperty(store, 'dispatch', dispatchDescriptor as PropertyDescriptor)
      }
      unregisterReduxStoreTap(tap)
    },
  }
  registerReduxStoreTap(tap)
  return { ok: true, tap }
}

function resolveHistoryLimit(requested: number | undefined): number {
  if (requested === undefined) return DEFAULT_HISTORY_LIMIT
  const limit = Number.isFinite(requested)
    ? Math.min(MAX_HISTORY_LIMIT, Math.max(1, Math.floor(requested)))
    : DEFAULT_HISTORY_LIMIT
  if (limit !== requested) {
    console.warn(
      `[genie] Redux historyLimit ${requested} must be an integer from 1 to ${MAX_HISTORY_LIMIT}; using ${limit}.`,
    )
  }
  return limit
}

function isLibraryActionType(type: string | null, state: unknown): boolean {
  if (type === null) return false
  const slash = type.indexOf('/')
  return slash > 0 && isRtkQuerySlice(state, type.slice(0, slash))
}

function touchesOnlyLibrarySlices(record: ReduxDispatchRecord, state: unknown): boolean {
  return (
    record.changedSlices.length > 0 &&
    !record.changedSlicesTruncated &&
    record.changedSlices.every((slice) => isRtkQuerySlice(state, slice))
  )
}

/** RTK Query keeps its reducerPath in its slice's config and owns every action type under `${reducerPath}/`. */
function isRtkQuerySlice(state: unknown, key: string): boolean {
  if (!isRecord(state)) return false
  const slice = ownValue(state, key)
  if (!isRecord(slice)) return false
  const config = ownValue(slice, 'config')
  return isRecord(config) && ownValue(config, 'reducerPath') === key
}

function mutationReport(
  comparison: ReturnType<typeof compareState>,
  snapshot: StateSnapshot,
): ReduxMutationReport {
  return {
    status: comparison.findings.length > 0 ? 'detected' : 'none-detected',
    notScannedReason: null,
    findings: comparison.findings.slice(0, FINDING_LIMIT),
    findingsOmitted: comparison.findings.length > FINDING_LIMIT,
    objectsCompared: comparison.objectsCompared,
    scanTruncated: snapshot.truncated,
  }
}

function notScanned(
  reason: NonNullable<ReduxMutationReport['notScannedReason']>,
): ReduxMutationReport {
  return {
    status: 'not-scanned',
    notScannedReason: reason,
    findings: [],
    findingsOmitted: false,
    objectsCompared: 0,
    scanTruncated: false,
  }
}

function actionType(action: unknown): string | null {
  if (typeof action !== 'object' || action === null) return null
  const descriptor = safeOwnPropertyDescriptor(action, 'type')
  if (!isDataDescriptor(descriptor)) return null
  const type: unknown = descriptor.value
  if (typeof type === 'string') return type.slice(0, 200)
  return typeof type === 'symbol' ? type.toString() : null
}

function thunkName(thunk: (...args: unknown[]) => unknown): string {
  const descriptor = safeOwnPropertyDescriptor(thunk, 'name')
  const name = isDataDescriptor(descriptor) ? descriptor.value : ''
  return typeof name === 'string' && name ? `thunk ${name.slice(0, 100)}` : ANONYMOUS_THUNK
}

function changedSlices(before: unknown, after: unknown): { slices: string[]; truncated: boolean } {
  if (Object.is(before, after)) return { slices: [], truncated: false }
  if (!isRecord(before) || !isRecord(after)) return { slices: ['$root'], truncated: false }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  const slices = keys.filter((key) => !Object.is(ownValue(before, key), ownValue(after, key)))
  return { slices: slices.slice(0, SLICE_LIMIT), truncated: slices.length > SLICE_LIMIT }
}

function ownValue(target: object, key: string): unknown {
  const descriptor = safeOwnPropertyDescriptor(target, key)
  return isDataDescriptor(descriptor) ? descriptor.value : undefined
}

function isRecord(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}
