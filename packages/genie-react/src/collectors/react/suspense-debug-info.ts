import {
  type Fiber,
  getRDTHook,
  getReactWorkTagsForFiber,
  getRenderer,
  type ReactRenderer,
} from 'bippy'
import { isArrayValue, isDataDescriptor, safeOwnPropertyDescriptor } from '../causal/safe-object'
import type {
  SuspenseBlockerBasis,
  SuspenseBlockerFull,
  SuspenseBlockerKind,
  SuspenseCapability,
} from './suspense-contract'

const REACT_LAZY_TYPE = Symbol.for('react.lazy')
const REACT_SUSPENSE_TYPE = Symbol.for('react.suspense')
const REACT_ELEMENT_TYPES = new Set([
  Symbol.for('react.transitional.element'),
  Symbol.for('react.element'),
])
const DEBUG_ENTRY_SCAN_LIMIT = 50
const THENABLE_SCAN_LIMIT = 20
const RETRY_QUEUE_SCAN_LIMIT = 50
const ELEMENT_SCAN_LIMIT = 100
const ELEMENT_SCAN_DEPTH = 4
const DESCRIPTION_LIMIT = 160
const NAME_LIMIT = 120

export type BlockerStatus = SuspenseBlockerFull['status']
type RecordedBy = SuspenseBlockerFull['recordedBy']

/** A component React recorded around a blocker: a client fiber, or a server component known only by name and environment. */
export interface AwaiterRef {
  fiber: Fiber | null
  name: string
  env: string | null
}

/** One blocker as read from React, before source resolution and output shaping. */
export interface RawBlocker {
  identity: object
  streamKey: object | null
  recordedBy: RecordedBy
  phase: 'pending' | 'awaited-by-content'
  status: BlockerStatus
  liveStatus: () => BlockerStatus
  kind: SuspenseBlockerKind
  kindEvidence: 'exact' | 'inferred' | 'unknown'
  basis: SuspenseBlockerBasis
  name: string | null
  description: string | null
  startMs: number | null
  endMs: number | null
  env: string | null
  awaitedBy: AwaiterRef | null
  owner: AwaiterRef | null
  awaitStack: StackSource
  ioStack: StackSource
}

/** A client Error captured by React (source-mappable) or a server ReactStackTrace array. */
export type StackSource = Error | unknown[] | null

/** Reads only own data properties: thenables and debug records may come from app code, so getters never run. */
export function own(value: unknown, key: PropertyKey): unknown {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return undefined
  const descriptor = safeOwnPropertyDescriptor(value, key)
  return isDataDescriptor(descriptor) ? descriptor.value : undefined
}

function ownString(value: unknown, key: PropertyKey, limit = NAME_LIMIT): string | null {
  const read = own(value, key)
  return typeof read === 'string' && read.length > 0 ? read.slice(0, limit) : null
}

function ownTime(value: unknown, key: PropertyKey): number | null {
  const read = own(value, key)
  return typeof read === 'number' && Number.isFinite(read) && read >= 0 ? read : null
}

function isObject(value: unknown): value is object {
  return (typeof value === 'object' || typeof value === 'function') && value !== null
}

function isThenable(value: unknown): value is object {
  if (!isObject(value)) return false
  try {
    return typeof (value as { then?: unknown }).then === 'function'
  } catch {
    return false
  }
}

/** React writes `status` onto every thenable it tracks; a promise React never tracked has no readable settlement. */
export function thenableStatus(thenable: unknown): BlockerStatus {
  const status = own(thenable, 'status')
  return status === 'pending' || status === 'fulfilled' || status === 'rejected'
    ? status
    : 'unknown'
}

// ── Capability gate ────────────────────────────────────────────────────────────

interface ParsedVersion {
  major: number
  minor: number
}

export function parseReactVersion(version: string | null): ParsedVersion | null {
  const match = version ? /^(\d+)\.(\d+)\.\d+/.exec(version) : null
  if (!match) return null
  const major = Number(match[1])
  return major > 0 ? { major, minor: Number(match[2]) } : null
}

function rendererVersion(renderer: ReactRenderer | null): string | null {
  if (!renderer) return null
  const reconciler = own(renderer, 'reconcilerVersion')
  if (typeof reconciler === 'string' && parseReactVersion(reconciler)) return reconciler
  const version = own(renderer, 'version')
  return typeof version === 'string' ? version : null
}

function rendererBundle(renderer: ReactRenderer | null): SuspenseCapability['bundle'] {
  const bundleType = own(renderer, 'bundleType')
  if (bundleType === 0) return 'production'
  return typeof bundleType === 'number' && bundleType > 0 ? 'development' : 'unknown'
}

function rendererForRoot(root: Fiber | null): ReactRenderer | null {
  try {
    if (root) {
      const renderer = getRenderer(root)
      if (renderer) return renderer
    }
    return getRDTHook().renderers.values().next().value ?? null
  } catch {
    return null
  }
}

/** React 19 development builds construct every fiber with an own `_debugInfo` field; React 18 and production builds never do. */
function hasDebugInfoField(root: Fiber): boolean {
  try {
    return Object.hasOwn(root, '_debugInfo')
  } catch {
    return false
  }
}

export interface RendererEvidence {
  reactVersion: string | null
  bundle: SuspenseCapability['bundle']
  hasRenderer: boolean
  /** null when no fiber was available to inspect. */
  hasDebugInfoField: boolean | null
}

/** Verified against React's development builds: before 19 there is no `_debugInfo` and no `use()`; 19.0 and 19.1 record server data and the thenables a component passed to `use()`, but no client names or timings; 19.2 and later stamp each `use()` thenable and React.lazy with an I/O record (name, start, end, and for lazy the `lazy()` stack); production builds have no debug fields. */
export function capabilityFor(evidence: RendererEvidence): SuspenseCapability {
  const base = { reactVersion: evidence.reactVersion, bundle: evidence.bundle }
  if (!evidence.hasRenderer && evidence.hasDebugInfoField === null) {
    return { ...base, asyncDebugInfo: 'unavailable', reason: 'no-react-renderer' }
  }
  if (evidence.bundle === 'production') {
    return { ...base, asyncDebugInfo: 'unavailable', reason: 'production-build' }
  }
  const parsed = parseReactVersion(evidence.reactVersion)
  if (parsed && parsed.major < 19) {
    return { ...base, asyncDebugInfo: 'unavailable', reason: 'react-before-19' }
  }
  if (evidence.hasDebugInfoField === false) {
    return { ...base, asyncDebugInfo: 'unavailable', reason: 'debug-fields-missing' }
  }
  if (!parsed) {
    return { ...base, asyncDebugInfo: 'partial', reason: 'unrecognized-react-version' }
  }
  if (parsed.major === 19 && parsed.minor < 2) {
    return { ...base, asyncDebugInfo: 'partial', reason: 'react-19.0-19.1' }
  }
  return { ...base, asyncDebugInfo: 'available', reason: null }
}

/** Decide what async debug information this root's renderer can provide, from its version, build type and the fiber shape it actually produced. */
export function assessSuspenseCapability(root: Fiber | null): SuspenseCapability {
  const renderer = rendererForRoot(root)
  return capabilityFor({
    reactVersion: rendererVersion(renderer),
    bundle: rendererBundle(renderer),
    hasRenderer: renderer !== null,
    hasDebugInfoField: root ? hasDebugInfoField(root) : null,
  })
}

const CAPABILITY_RANK: Record<SuspenseCapability['asyncDebugInfo'], number> = {
  unavailable: 0,
  partial: 1,
  available: 2,
}

export function weakestCapability(capabilities: SuspenseCapability[]): SuspenseCapability | null {
  let weakest: SuspenseCapability | null = null
  for (const capability of capabilities) {
    if (
      !weakest ||
      CAPABILITY_RANK[capability.asyncDebugInfo] < CAPABILITY_RANK[weakest.asyncDebugInfo]
    ) {
      weakest = capability
    }
  }
  return weakest
}

// ── React debug entries ────────────────────────────────────────────────────────

interface AsyncEntry {
  asyncInfo: object
  ioInfo: object
}

function debugEntries(debugInfo: unknown): unknown[] {
  if (!isArrayValue(debugInfo)) return []
  return debugInfo.slice(0, DEBUG_ENTRY_SCAN_LIMIT)
}

/** ReactAsyncInfo entries: React stores what was awaited under `awaited`, next to component entries in the same array. */
export function asyncEntriesOf(debugInfo: unknown): AsyncEntry[] {
  return debugEntries(debugInfo).flatMap((entry) => {
    const ioInfo = own(entry, 'awaited')
    return isObject(entry) && isObject(ioInfo) ? [{ asyncInfo: entry, ioInfo }] : []
  })
}

/** ReactComponentInfo entries: server components that rendered this element, in the order React recorded them. */
export function componentEntriesOf(debugInfo: unknown): AwaiterRef[] {
  return debugEntries(debugInfo).flatMap((entry) => {
    if (own(entry, 'awaited') !== undefined) return []
    const name = ownString(entry, 'name')
    return name ? [{ fiber: null, name, env: ownString(entry, 'env') }] : []
  })
}

function serverAwaiter(info: unknown): AwaiterRef | null {
  const name = ownString(info, 'name')
  return name ? { fiber: null, name, env: ownString(info, 'env') } : null
}

function stackOf(record: unknown): StackSource {
  const debugStack = own(record, 'debugStack')
  if (debugStack instanceof Error) return debugStack
  const stack = own(record, 'stack')
  return isArrayValue(stack) ? stack : null
}

// ── Classification ─────────────────────────────────────────────────────────────

interface Classification {
  kind: SuspenseBlockerKind
  kindEvidence: RawBlocker['kindEvidence']
  basis: SuspenseBlockerBasis
}

/** Classify only from what React recorded: an RSC stream name, a server environment, the lazy or use() mechanism. Anything else stays unknown until a stack frame says more. */
export function classifyAsyncEntry(
  entry: AsyncEntry,
  context: { recordedBy: RecordedBy; awaited: object | null },
): Classification {
  const name = ownString(entry.ioInfo, 'name')
  if (name?.toLowerCase() === 'rsc stream') {
    return { kind: 'server-stream', kindEvidence: 'exact', basis: 'rsc-stream-name' }
  }
  if (ownString(entry.ioInfo, 'env') ?? ownString(entry.asyncInfo, 'env')) {
    return { kind: 'server-io', kindEvidence: 'exact', basis: 'server-environment' }
  }
  if (context.recordedBy === 'lazy-type' || context.recordedBy === 'lazy-element') {
    const basis = context.recordedBy === 'lazy-element' ? 'lazy-element-payload' : 'lazy-type'
    return { kind: 'lazy', kindEvidence: 'exact', basis }
  }
  if (context.awaited && own(entry.ioInfo, 'value') === context.awaited) {
    return { kind: 'use', kindEvidence: 'exact', basis: 'react-use-tracking' }
  }
  if (context.recordedBy === 'use-hook') {
    return { kind: 'use', kindEvidence: 'exact', basis: 'use-thenable-state' }
  }
  return { kind: 'unknown', kindEvidence: 'unknown', basis: 'debug-info-unclassified' }
}

const DATA_LIBRARY_PACKAGES = [
  '@tanstack/react-query',
  '@tanstack/query-core',
  '@tanstack/solid-query',
  '@tanstack/vue-query',
  'swr',
  '@apollo/client',
  'react-relay',
  'relay-runtime',
  'urql',
  '@urql/core',
  '@trpc/client',
  '@trpc/react-query',
  '@reduxjs/toolkit',
]

// A Vite pre-bundled chunk is named after the package with `/` as `_`, then `.js` or `_subpath`.
const VITE_DEP_CHUNKS = DATA_LIBRARY_PACKAGES.map(
  (name) => `/node_modules/.vite/deps/${name.replace('/', '_')}`,
)

/** Installed data-fetching packages, as a node_modules path or Vite's pre-bundled chunk. */
export function dataLibraryOfFile(file: string | null): boolean {
  if (!file) return false
  const path = file.replaceAll('\\', '/').split('?')[0] ?? ''
  return (
    DATA_LIBRARY_PACKAGES.some((name) => path.includes(`/node_modules/${name}/`)) ||
    VITE_DEP_CHUNKS.some((chunk) => {
      const next = path.charAt(path.indexOf(chunk) + chunk.length)
      return path.includes(chunk) && (next === '.' || next === '_')
    })
  )
}

// ── Values ─────────────────────────────────────────────────────────────────────

function truncate(text: string): string {
  return text.length > DESCRIPTION_LIMIT ? `${text.slice(0, DESCRIPTION_LIMIT - 1)}…` : text
}

/** A short identifier for a settled value (URL, href, id, message) in the spirit of DevTools' description; never invokes app getters. */
export function describeSettledValue(value: unknown): string | null {
  try {
    if (typeof value === 'string') return value.length >= 5 ? truncate(value) : null
    if (typeof value === 'number' || typeof value === 'bigint') return String(value)
    if (typeof value === 'function') return ownString(value, 'name')
    if (!isObject(value)) return null
    if (value instanceof Error) {
      const message = own(value, 'message')
      return typeof message === 'string' && message ? truncate(message) : null
    }
    if (typeof Response === 'function' && value instanceof Response) return truncate(value.url)
    if (typeof Request === 'function' && value instanceof Request) return truncate(value.url)
    for (const key of ['url', 'href', 'src', 'currentSrc', 'id', 'name']) {
      const read = own(value, key)
      if (typeof read === 'string' && read) return truncate(read)
      if (typeof read === 'number') return String(read)
    }
  } catch {
    return null
  }
  return null
}

function settledValue(thenable: unknown): unknown {
  const status = thenableStatus(thenable)
  if (status === 'fulfilled') return own(thenable, 'value')
  if (status === 'rejected') return own(thenable, 'reason')
  return undefined
}

// ── Blocker construction ───────────────────────────────────────────────────────

interface EntryContext {
  recordedBy: RecordedBy
  phase: RawBlocker['phase']
  awaited: object | null
  fallbackStatus: () => BlockerStatus
  awaitedBy: AwaiterRef | null
}

function blockerFromAsyncEntry(entry: AsyncEntry, context: EntryContext): RawBlocker {
  const ioValue = own(entry.ioInfo, 'value')
  const settlementSource = isThenable(ioValue) ? ioValue : context.awaited
  const readStatus = (): BlockerStatus => {
    const ioStatus = isThenable(ioValue) ? thenableStatus(ioValue) : 'unknown'
    return ioStatus === 'unknown' ? context.fallbackStatus() : ioStatus
  }
  const status = readStatus()
  const startMs = ownTime(entry.ioInfo, 'start')
  const recordedEnd = ownTime(entry.ioInfo, 'end')
  const name = ownString(entry.ioInfo, 'name')
  const classification = classifyAsyncEntry(entry, context)
  return {
    identity: entry.ioInfo,
    streamKey: classification.kind === 'server-stream' && isObject(ioValue) ? ioValue : null,
    recordedBy: context.recordedBy,
    phase: context.phase,
    status,
    liveStatus: readStatus,
    ...classification,
    name,
    description: describeSettledValue(settledValue(settlementSource)),
    startMs,
    endMs: status === 'pending' ? null : recordedEnd,
    env: ownString(entry.ioInfo, 'env') ?? ownString(entry.asyncInfo, 'env'),
    awaitedBy: serverAwaiter(own(entry.asyncInfo, 'owner')) ?? context.awaitedBy,
    owner: serverAwaiter(own(entry.ioInfo, 'owner')),
    awaitStack: stackOf(entry.asyncInfo),
    ioStack: stackOf(entry.ioInfo),
  }
}

function blockersFromThenable(
  thenable: object,
  context: Omit<EntryContext, 'awaited' | 'fallbackStatus'>,
): RawBlocker[] {
  const readStatus = (): BlockerStatus => thenableStatus(thenable)
  const status = readStatus()
  const entries = asyncEntriesOf(own(thenable, '_debugInfo'))
  if (entries.length > 0) {
    return entries.map((entry) =>
      blockerFromAsyncEntry(entry, { ...context, awaited: thenable, fallbackStatus: readStatus }),
    )
  }
  const producer = componentEntriesOf(own(thenable, '_debugInfo'))[0] ?? null
  const classification: Classification =
    context.recordedBy === 'use-hook'
      ? { kind: 'use', kindEvidence: 'exact', basis: 'use-thenable-state' }
      : status === 'unknown'
        ? { kind: 'unknown', kindEvidence: 'unknown', basis: 'thrown-promise-without-debug-info' }
        : {
            kind: 'unknown',
            kindEvidence: 'unknown',
            basis: 'tracked-thenable-without-debug-info',
          }
  return [
    {
      identity: thenable,
      streamKey: null,
      recordedBy: context.recordedBy,
      phase: context.phase,
      status,
      liveStatus: readStatus,
      ...classification,
      name: ownString(thenable, 'displayName'),
      description: describeSettledValue(settledValue(thenable)),
      startMs: null,
      endMs: null,
      env: producer?.env ?? null,
      awaitedBy: context.awaitedBy,
      owner: producer,
      awaitStack: null,
      ioStack: null,
    },
  ]
}

// ── Pending blockers: React's retry queue on the latest uncommitted attempt ──

function lazyPayloadStatus(payload: unknown): BlockerStatus {
  switch (own(payload, '_status')) {
    case 0:
      return 'pending'
    case 1:
      return 'fulfilled'
    case 2:
      return 'rejected'
    default:
      return 'unknown'
  }
}

function lazyTypeOfElement(element: unknown): object | null {
  const type = own(element, 'type')
  return isObject(type) && own(type, '$$typeof') === REACT_LAZY_TYPE ? type : null
}

/** Lazy types among the boundary's own child elements, stopping at nested Suspense elements, which catch their own children: a pending React.lazy throws its loader promise, which is the lazy payload's `_result`. */
function lazyTypesUnder(children: unknown): Array<{ type: object; depth: number }> {
  const found: Array<{ type: object; depth: number }> = []
  const queue: Array<{ node: unknown; depth: number }> = [{ node: children, depth: 0 }]
  let visited = 0
  while (queue.length > 0 && visited < ELEMENT_SCAN_LIMIT) {
    const next = queue.shift()
    if (!next || next.depth > ELEMENT_SCAN_DEPTH) continue
    visited += 1
    const { node, depth } = next
    if (isArrayValue(node)) {
      for (const child of node.slice(0, ELEMENT_SCAN_LIMIT)) queue.push({ node: child, depth })
      continue
    }
    if (!REACT_ELEMENT_TYPES.has(own(node, '$$typeof') as symbol)) continue
    const lazyType = lazyTypeOfElement(node)
    if (lazyType) found.push({ type: lazyType, depth })
    if (own(node, 'type') === REACT_SUSPENSE_TYPE) continue
    queue.push({ node: own(own(node, 'props'), 'children'), depth: depth + 1 })
  }
  return found
}

function blockerFromLazyType(
  lazyType: object,
  context: Omit<EntryContext, 'awaited' | 'fallbackStatus'> & {
    kindEvidence: RawBlocker['kindEvidence']
  },
): RawBlocker[] {
  const payload = own(lazyType, '_payload')
  const readStatus = (): BlockerStatus => lazyPayloadStatus(payload)
  const payloadStatus = readStatus()
  const loader = own(payload, '_result')
  // React 19.2 settles the lazy I/O record with the module and 19.3 with its default export; the loaded component's name describes both.
  const loaded = payloadStatus === 'fulfilled' ? describeSettledValue(own(loader, 'default')) : null
  const entries = asyncEntriesOf(own(lazyType, '_debugInfo'))
  if (entries.length > 0) {
    return entries.map((entry) => {
      const blocker = blockerFromAsyncEntry(entry, {
        ...context,
        awaited: null,
        fallbackStatus: readStatus,
      })
      return {
        ...blocker,
        kindEvidence: context.kindEvidence,
        description: loaded ?? blocker.description,
      }
    })
  }
  return [
    {
      identity: isObject(loader) && payloadStatus === 'pending' ? loader : lazyType,
      streamKey: null,
      recordedBy: context.recordedBy,
      phase: context.phase,
      status: payloadStatus,
      liveStatus: readStatus,
      kind: 'lazy',
      kindEvidence: context.kindEvidence,
      basis: context.recordedBy === 'lazy-element' ? 'lazy-element-payload' : 'lazy-type',
      name: 'lazy',
      description: loaded,
      startMs: null,
      endMs: null,
      env: null,
      awaitedBy: context.awaitedBy,
      owner: null,
      awaitStack: null,
      ioStack: null,
    },
  ]
}

/** Hidden Activity content and a Suspense boundary's hidden primary children: committed, but not on screen. */
export function isHiddenOffscreen(fiber: Fiber): boolean {
  return (
    fiber.tag === getReactWorkTagsForFiber(fiber).OffscreenComponent &&
    own(fiber, 'memoizedState') != null
  )
}

/** Wakeables React queued on the boundary's latest render attempt; the committed fiber's own queue is cleared during commit, so only the uncommitted alternate can hold one. */
export function retryQueueOf(boundary: Fiber): object[] {
  const alternate = boundary.alternate
  if (!alternate) return []
  const queue = own(alternate, 'updateQueue')
  if (!(queue instanceof Set)) return []
  return [...queue].slice(0, RETRY_QUEUE_SCAN_LIMIT).filter(isObject)
}

/** What the boundary's latest render attempt is waiting on: the live retry queue plus promises captured from it earlier that the committed fallback still waits on. Without either, a committed fallback still names a pending React.lazy among its own child elements: exact for a direct child, which Suspense always renders, inferred deeper, where a parent may not render it. */
export function pendingBlockersOf(
  boundary: Fiber,
  showsFallback: boolean,
  captured: object[] = [],
): RawBlocker[] {
  const live = retryQueueOf(boundary)
  const wakeables = [...live, ...captured.filter((wakeable) => !live.includes(wakeable))]
  const props = own(boundary.alternate, 'memoizedProps') ?? own(boundary, 'memoizedProps')
  const lazyTypes = lazyTypesUnder(own(props, 'children'))
  const loaderOf = (type: object): unknown => own(own(type, '_payload'), '_result')
  const context = { recordedBy: 'retry-queue' as const, phase: 'pending' as const, awaitedBy: null }
  const queued = wakeables.flatMap((wakeable) => {
    const lazy = lazyTypes.find(({ type }) => loaderOf(type) === wakeable)
    if (lazy && asyncEntriesOf(own(wakeable, '_debugInfo')).length === 0) {
      return blockerFromLazyType(lazy.type, {
        ...context,
        recordedBy: 'lazy-element',
        kindEvidence: 'exact',
      }).map((blocker) => ({ ...blocker, identity: wakeable }))
    }
    return blockersFromThenable(wakeable, context)
  })
  if (!showsFallback) return queued
  const queuedSet = new Set<unknown>(wakeables)
  const unqueuedLazies = lazyTypes.filter(
    ({ type }) =>
      lazyPayloadStatus(own(type, '_payload')) === 'pending' && !queuedSet.has(loaderOf(type)),
  )
  return [
    ...queued,
    ...unqueuedLazies.flatMap(({ type, depth }) => {
      const loader = loaderOf(type)
      return blockerFromLazyType(type, {
        ...context,
        recordedBy: 'lazy-element',
        kindEvidence: depth === 0 ? 'exact' : 'inferred',
      }).map((blocker) => (isObject(loader) ? { ...blocker, identity: loader } : blocker))
    }),
  ]
}

// ── Awaited by content: debug information on committed fibers ─────────────────

function thenablesUsedBy(fiber: Fiber): object[] {
  const state = own(own(fiber, 'dependencies'), '_debugThenableState')
  const thenables = isArrayValue(state) ? state : own(state, 'thenables')
  if (!isArrayValue(thenables)) return []
  return [...new Set(thenables.slice(0, THENABLE_SCAN_LIMIT))].filter(isObject)
}

function stylesheetBlocker(fiber: Fiber, awaitedBy: AwaiterRef | null): RawBlocker | null {
  if (fiber.tag !== getReactWorkTagsForFiber(fiber).HostHoistable) return null
  const resource = own(fiber, 'memoizedState')
  if (own(resource, 'type') !== 'stylesheet') return null
  const media = own(own(fiber, 'memoizedProps'), 'media')
  if (typeof media === 'string' && typeof matchMedia === 'function' && !matchMedia(media).matches) {
    return null
  }
  const instance = own(resource, 'instance')
  if (!isObject(instance)) return null
  let href: string | null = null
  let loaded = false
  try {
    const element = instance as { href?: unknown; sheet?: unknown }
    href = typeof element.href === 'string' ? element.href : null
    loaded = element.sheet != null
  } catch {
    return null
  }
  const timing = href ? resourceTiming(href) : null
  return {
    identity: resource as object,
    streamKey: null,
    recordedBy: 'host-resource',
    phase: 'awaited-by-content',
    status: loaded ? 'fulfilled' : 'unknown',
    liveStatus: () => (loaded ? 'fulfilled' : 'unknown'),
    kind: 'asset',
    kindEvidence: 'exact',
    basis: 'host-stylesheet-resource',
    name: 'stylesheet',
    description: href ? truncate(href) : null,
    startMs: timing?.startMs ?? null,
    endMs: timing?.endMs ?? null,
    env: null,
    awaitedBy,
    owner: null,
    awaitStack: null,
    ioStack: null,
  }
}

function resourceTiming(url: string): { startMs: number; endMs: number } | null {
  try {
    if (typeof performance?.getEntriesByName !== 'function') return null
    const entries = performance.getEntriesByName(url, 'resource')
    const last = entries[entries.length - 1]
    return last ? { startMs: last.startTime, endMs: last.startTime + last.duration } : null
  } catch {
    return null
  }
}

/** Every async entry React recorded on one committed fiber, the same sources DevTools reads for "suspended by". */
export function contentBlockersOf(fiber: Fiber, awaitedBy: AwaiterRef | null): RawBlocker[] {
  const blockers: RawBlocker[] = []
  const phase = 'awaited-by-content' as const
  for (const thenable of thenablesUsedBy(fiber)) {
    blockers.push(...blockersFromThenable(thenable, { recordedBy: 'use-hook', phase, awaitedBy }))
  }
  const elementType = own(fiber, 'elementType')
  if (isObject(elementType) && own(elementType, '$$typeof') === REACT_LAZY_TYPE) {
    blockers.push(
      ...blockerFromLazyType(elementType, {
        recordedBy: 'lazy-type',
        phase,
        awaitedBy,
        kindEvidence: 'exact',
      }),
    )
  }
  for (const entry of asyncEntriesOf(own(fiber, '_debugInfo'))) {
    blockers.push(
      blockerFromAsyncEntry(entry, {
        recordedBy: 'child-debug-info',
        phase,
        awaited: null,
        fallbackStatus: () => 'unknown',
        awaitedBy,
      }),
    )
  }
  const stylesheet = stylesheetBlocker(fiber, awaitedBy)
  if (stylesheet) blockers.push(stylesheet)
  return blockers
}

/** One entry per awaited I/O; an RSC stream keeps only its furthest entry, as React DevTools does. */
export function dedupeBlockers(blockers: RawBlocker[]): RawBlocker[] {
  const byIdentity = new Map<object, RawBlocker>()
  const streams = new Map<object, RawBlocker>()
  for (const blocker of blockers) {
    if (blocker.streamKey) {
      const existing = streams.get(blocker.streamKey)
      if (!existing || (blocker.endMs ?? 0) > (existing.endMs ?? 0)) {
        streams.set(blocker.streamKey, blocker)
      }
      continue
    }
    const existing = byIdentity.get(blocker.identity)
    if (!existing || (existing.phase !== 'pending' && blocker.phase === 'pending')) {
      byIdentity.set(blocker.identity, blocker)
    }
  }
  return [...byIdentity.values(), ...streams.values()]
}
