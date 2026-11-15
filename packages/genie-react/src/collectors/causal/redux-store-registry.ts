/** Neutral Redux store identity and the action-to-render join the React collector reads; the Redux collector writes the timeline. */

import { type Fiber, getReactWorkTagsForFiber } from 'bippy'
import { isDataDescriptor, safeOwnPropertyDescriptor } from './safe-object'

export type ReduxRecordKind = 'action' | 'thunk' | 'unrecorded-change' | 'mutation-outside-dispatch'

/** One dispatch or detected store change, timed on the clock React stamps fibers with. */
export interface ReduxTimelineEntry {
  actionId: string
  sequence: number
  kind: ReduxRecordKind
  type: string | null
  startedAt: number
  endedAt: number | null
  /** When Genie's own store listener first saw the state this dispatch produced. */
  stateSeenAt: number | null
  /** React was rendering or committing when the dispatch began, as in a render-phase or layout-effect dispatch. */
  reactWorkActive: boolean
  rootStateChanged: boolean | null
  changedSlices: string[]
  unrecordedNestedDispatches: number
  renderEventIds: string[]
}

export interface ReduxStoreTapView {
  storeId: string
  store: object
  /** The store's own `subscribe`, which a component subscribing directly passes to useSyncExternalStore. */
  subscribe: unknown
  /** False when this runtime has no `performance.now`, so timings cannot be ordered against React's. */
  reactClock: boolean
  installedAt: number
  entries: () => readonly ReduxTimelineEntry[]
  evictedEntries: () => number
}

export type ReduxStoreLink = 'subscription' | 'connect' | 'context'

export type ReduxLinkReason =
  | 'dispatched-between-renders'
  | 'store-link-from-context'
  | 'subscription-unconfirmed'
  | 'render-timing-unavailable'
  | 'previous-render-unavailable'
  | 'recording-started-after-previous-render'
  | 'history-evicted'
  | 'ordering-ambiguous'
  | 'unrecorded-state-change'
  | 'unrecorded-nested-dispatch'
  | 'no-recorded-change-between-renders'

export interface ReduxRenderAction {
  actionId: string
  sequence: number
  kind: 'action' | 'unrecorded-change'
  type: string | null
  changedSlices: string[]
}

export interface ReduxRenderLink {
  storeId: string
  link: ReduxStoreLink
  evidence: 'exact' | 'inferred'
  reason: ReduxLinkReason
  actions: ReduxRenderAction[]
  omittedActions: number
}

const RENDER_ACTION_LIMIT = 10
const FALLBACK_ACTION_LIMIT = 3
const CONTEXT_DEPENDENCY_LIMIT = 50
const PROVIDER_SEARCH_LIMIT = 2_000
const RENDER_EVENT_LINK_LIMIT = 50
/** React sets this flag on a fiber whose component function actually ran; a bailed-out clone keeps hooks from an older render. */
const PERFORMED_WORK_FLAG = 1

let taps: WeakRef<ReduxStoreTapView>[] = []

export function registerReduxStoreTap(tap: ReduxStoreTapView): void {
  taps = [...liveTaps(), tap].map((live) => new WeakRef(live))
}

export function unregisterReduxStoreTap(tap: ReduxStoreTapView): void {
  taps = liveTaps()
    .filter((live) => live !== tap)
    .map((live) => new WeakRef(live))
}

export function reduxStoreTaps(): ReduxStoreTapView[] {
  return liveTaps()
}

function liveTaps(): ReduxStoreTapView[] {
  return taps.flatMap((ref) => {
    const tap = ref.deref()
    return tap ? [tap] : []
  })
}

function tapForStore(value: unknown): ReduxStoreTapView | null {
  if (typeof value !== 'object' || value === null) return null
  return liveTaps().find((tap) => tap.store === value) ?? null
}

/** Ties an external-store hook to a collected Redux store and names the dispatches between this fiber's previous render and this one. */
export function reduxRenderLink(input: {
  fiber: Fiber
  subscribe: object | null
  subscriptionFired: boolean | null
  renderEventId: string | null
}): ReduxRenderLink | null {
  if (taps.length === 0) return null
  const match = storeLinkFor(input.fiber, input.subscribe)
  if (!match) return null
  const { tap, link } = match
  const window = renderWindow(input.fiber, tap, match.notifiedSynchronously)
  const result =
    window.kind === 'bounded'
      ? actionsBetweenRenders(tap, window.previous, window.current)
      : {
          entries: fallbackActions(
            tap,
            window.kind === 'unbounded-previous' ? window.current : null,
          ),
          reason: window.reason,
        }
  const reason: ReduxLinkReason =
    link === 'context'
      ? 'store-link-from-context'
      : input.subscriptionFired !== true
        ? 'subscription-unconfirmed'
        : result.reason
  const evidence = reason === 'dispatched-between-renders' ? 'exact' : 'inferred'
  if (evidence === 'exact' && input.renderEventId) {
    for (const entry of result.entries) linkRenderEvent(entry, input.renderEventId)
  }
  return {
    storeId: tap.storeId,
    link,
    evidence,
    reason,
    actions: result.entries.slice(-RENDER_ACTION_LIMIT).map(renderAction),
    omittedActions: Math.max(0, result.entries.length - RENDER_ACTION_LIMIT),
  }
}

function renderAction(entry: ReduxTimelineEntry): ReduxRenderAction {
  return {
    actionId: entry.actionId,
    sequence: entry.sequence,
    kind: entry.kind === 'unrecorded-change' ? 'unrecorded-change' : 'action',
    type: entry.type,
    changedSlices: entry.changedSlices.slice(0, 20),
  }
}

function linkRenderEvent(entry: ReduxTimelineEntry, renderEventId: string): void {
  if (
    !entry.renderEventIds.includes(renderEventId) &&
    entry.renderEventIds.length < RENDER_EVENT_LINK_LIMIT
  ) {
    entry.renderEventIds.push(renderEventId)
  }
}

interface StoreLinkMatch {
  tap: ReduxStoreTapView
  link: ReduxStoreLink
  /** The store itself, or a subscription it notifies directly, calls this subscriber inside dispatch; a nested connect() subscription is called later, from its parent's layout effect. */
  notifiedSynchronously: boolean
}

function storeLinkFor(fiber: Fiber, subscribe: object | null): StoreLinkMatch | null {
  if (subscribe) {
    const direct = liveTaps().find((tap) => tap.subscribe === subscribe)
    if (direct) return { tap: direct, link: 'subscription', notifiedSynchronously: true }
  }
  const propsStore = isConnectWrapper(fiber)
    ? tapForStore(ownData(fiber.memoizedProps, 'store'))
    : null
  if (propsStore) return { tap: propsStore, link: 'connect', notifiedSynchronously: true }
  let dependency: unknown = fiber.dependencies?.firstContext ?? null
  for (let index = 0; dependency && index < CONTEXT_DEPENDENCY_LIMIT; index += 1) {
    const value = ownData(dependency, 'memoizedValue')
    const tap = tapForStore(ownData(value, 'store'))
    if (tap) {
      const subscription = ownData(value, 'subscription')
      const link: ReduxStoreLink =
        subscribe && ownData(subscription, 'addNestedSub') === subscribe
          ? 'subscription'
          : isConnectWrapper(fiber)
            ? 'connect'
            : 'context'
      return { tap, link, notifiedSynchronously: providedByReduxProvider(fiber, value) }
    }
    dependency = ownData(dependency, 'next')
  }
  return null
}

/** The react-redux Provider's subscription listens to the store directly; connect() re-provides the context with a subscription nested under its own. */
function providedByReduxProvider(fiber: Fiber, contextValue: unknown): boolean {
  let ancestor = fiber.return
  for (let depth = 0; ancestor && depth < PROVIDER_SEARCH_LIMIT; depth += 1) {
    if (
      ancestor.tag === getReactWorkTagsForFiber(ancestor).ContextProvider &&
      ownData(ancestor.memoizedProps, 'value') === contextValue
    ) {
      return ancestor.return !== null && !isConnectWrapper(ancestor.return)
    }
    ancestor = ancestor.return
  }
  return false
}

/** react-redux's connect() hoists `WrappedComponent` onto the memo it renders; that wrapper runs no app hooks, so its one store hook is the store's. */
function isConnectWrapper(fiber: Fiber): boolean {
  return [fiber.elementType, fiber.type].some(
    (candidate) => ownData(candidate, 'WrappedComponent') !== undefined,
  )
}

interface RenderTiming {
  startedAt: number
  /** The latest moment this fiber could still have been reading the store. */
  readUntil: number
}

type RenderWindow =
  | { kind: 'bounded'; previous: RenderTiming; current: RenderTiming }
  | { kind: 'unbounded-previous'; current: RenderTiming; reason: ReduxLinkReason }
  | { kind: 'unbounded'; reason: ReduxLinkReason }

function renderWindow(
  fiber: Fiber,
  tap: ReduxStoreTapView,
  notifiedSynchronously: boolean,
): RenderWindow {
  const current = tap.reactClock ? renderTiming(fiber) : null
  if (!current) return { kind: 'unbounded', reason: 'render-timing-unavailable' }
  const previous = previousVisit(fiber, notifiedSynchronously)
  if (!previous || previous.startedAt >= current.startedAt) {
    return { kind: 'unbounded-previous', current, reason: 'previous-render-unavailable' }
  }
  if (tap.installedAt >= previous.startedAt) {
    return {
      kind: 'unbounded-previous',
      current,
      reason: 'recording-started-after-previous-render',
    }
  }
  return { kind: 'bounded', previous, current }
}

/** The render that produced the previous snapshot. When React only cloned the fiber, the clone's visit still bounds the window for a subscriber notified inside dispatch: any earlier change to its selection would have scheduled an update, and the visit would have rendered. */
function previousVisit(fiber: Fiber, notifiedSynchronously: boolean): RenderTiming | null {
  const alternate = fiber.alternate
  if (!alternate) return null
  const flags = ownNumber(alternate, 'flags')
  const performedWork = flags !== null && (flags & PERFORMED_WORK_FLAG) !== 0
  return performedWork || notifiedSynchronously ? renderTiming(alternate) : null
}

/** React's profiler timer stamps each fiber when its work begins; development builds run it whenever DevTools is installed. */
function renderTiming(fiber: Fiber): RenderTiming | null {
  const startedAt = ownNumber(fiber, 'actualStartTime')
  if (startedAt === null || startedAt < 0) return null
  const duration = ownNumber(fiber, 'actualDuration')
  return {
    startedAt,
    readUntil: duration !== null && duration >= 0 ? startedAt + duration : Number.POSITIVE_INFINITY,
  }
}

type Visibility = 'seen' | 'unseen' | 'unknown'

/** A fiber's own render runs without yielding, so a dispatch made outside React work either finished before it began or started after it ended. */
function visibilityAt(entry: ReduxTimelineEntry, render: RenderTiming): Visibility {
  const visibleBy = Math.min(
    entry.endedAt ?? Number.POSITIVE_INFINITY,
    entry.stateSeenAt ?? Number.POSITIVE_INFINITY,
  )
  if (visibleBy < render.startedAt) return 'seen'
  if (entry.startedAt > render.readUntil) return 'unseen'
  if (entry.startedAt > render.startedAt && !entry.reactWorkActive) return 'unseen'
  return 'unknown'
}

function changesState(entry: ReduxTimelineEntry): boolean {
  return (
    entry.kind === 'unrecorded-change' ||
    (entry.kind === 'action' && entry.rootStateChanged === true)
  )
}

function actionsBetweenRenders(
  tap: ReduxStoreTapView,
  previous: RenderTiming,
  current: RenderTiming,
): { entries: ReduxTimelineEntry[]; reason: ReduxLinkReason } {
  const entries = tap.entries()
  const oldest = entries[0]
  if (tap.evictedEntries() > 0 && (!oldest || oldest.startedAt >= previous.startedAt)) {
    return { entries: [], reason: 'history-evicted' }
  }
  const between: ReduxTimelineEntry[] = []
  let ambiguous = false
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index] as ReduxTimelineEntry
    if (!changesState(entry)) continue
    const before = visibilityAt(entry, previous)
    if (before === 'seen') break
    const now = visibilityAt(entry, current)
    if (before === 'unknown' || now === 'unknown') ambiguous = true
    if (now !== 'unseen') between.unshift(entry)
  }
  const reason: ReduxLinkReason = ambiguous
    ? 'ordering-ambiguous'
    : between.some((entry) => entry.kind === 'unrecorded-change')
      ? 'unrecorded-state-change'
      : between.some((entry) => entry.unrecordedNestedDispatches > 0)
        ? 'unrecorded-nested-dispatch'
        : between.length === 0
          ? 'no-recorded-change-between-renders'
          : 'dispatched-between-renders'
  return { entries: between, reason }
}

/** Without a previous render to bound the window, the latest state changes this render could have seen are leads, not proof. */
function fallbackActions(
  tap: ReduxStoreTapView,
  current: RenderTiming | null,
): ReduxTimelineEntry[] {
  return tap
    .entries()
    .filter(
      (entry) => changesState(entry) && (!current || visibilityAt(entry, current) !== 'unseen'),
    )
    .slice(-FALLBACK_ACTION_LIMIT)
}

function ownData(value: unknown, key: string): unknown {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return undefined
  const descriptor = safeOwnPropertyDescriptor(value, key)
  return isDataDescriptor(descriptor) ? descriptor.value : undefined
}

function ownNumber(value: unknown, key: string): number | null {
  const read = ownData(value, key)
  return typeof read === 'number' && Number.isFinite(read) ? read : null
}

export function resetReduxStoreRegistryForTests(): void {
  taps = []
}
