import { _fiberRoots, type Fiber, getFiberId, getReactWorkTagsForFiber, traverseFiber } from 'bippy'
import { isKnownProxy } from '../causal/proxy-tagging'
import {
  isArrayValue,
  isDataDescriptor,
  plainOwnKeys,
  safeOwnPropertyDescriptor,
} from '../causal/safe-object'
import { type RenderedOutput, renderedOutputOf } from './boundary-output'
import { isGenieFrame } from './class-updates'
import { nameOf } from './fiber'
import { getActiveObservation, getDocumentCommitId } from './observation'
import { forcedErrorBoundaries, forcedSuspenseBoundaries } from './overrides'
import {
  classifyFiber,
  isHiddenByAppOnly,
  ownershipCoverage,
  type ResolvedSource,
  type ResolvedStackFrame,
  resolveStackFrames,
  type SourceOwnership,
} from './source'
import {
  getSuspenseHideLog,
  recordSuspenseHide,
  resetSuspenseHideLogForTests,
  type SuspenseHideLog,
  suspenseBoundaryName,
} from './suspense-hide-log'
import { committedSuspenseState, forEachVisibleSuspenseBoundary } from './suspense-state'
import { isSuspenseFiber } from './work-tags'

// React's DidCapture flag is set on a boundary only during the catch commit, then cleared, so catches are recorded at commit time and re-verified against the live tree on every read.
const DID_CAPTURE = 0b1000_0000
const ERROR_LOG_LIMIT = 50
const CATCH_LOG_LIMIT = 200
const NO_STATE: unique symbol = Symbol('genie-react:no-pre-catch-state')
const NO_REPORTED_ERROR: unique symbol = Symbol('genie-react:no-reported-error')

interface CaughtEntry {
  boundaryId: number
  fiber: Fiber
  isRoot: boolean
  /** State the boundary committed with when it caught; identical state later means it is still in that error state. */
  caughtState: unknown
  /** State before the catch, when the boundary had committed before; NO_STATE for a boundary that caught while mounting. */
  preCatchState: unknown
  /** Fields getDerivedStateFromError changed, fixed at the catch; null until first read, undefined when they cannot be known. */
  errorFields: string[] | undefined | null
  log: ErrorLog | null
}

interface SuspendedEntry {
  id: number
  fiber: Fiber
}

interface ErrorLog {
  message: string | null
  stack: string | null
  throwingComponent: string | null
  boundaryName: string | null
}

export interface BoundaryCatch {
  catchId: string
  /** The commit in which React committed the boundary's (or root's) error state. */
  documentCommitId: number
  observationId: string | null
  boundaryId: number
  boundaryName: string
  boundaryKind: 'error-boundary' | 'root'
  forced: boolean
  message: string | null
  throwingComponent: string | null
}

export interface BoundaryCatchLog {
  afterDocumentCommitId: number
  documentCommitId: number
  catches: BoundaryCatch[]
  omittedByLimit: number
  complete: boolean
  incompleteReasons: ('catches-evicted' | 'commit-not-scanned')[]
}

const caught = new Map<number, CaughtEntry>()
const suspended = new Map<number, SuspendedEntry>()
const errorLog: ErrorLog[] = []
/** Append-only history of catches, so a boundary that caught and then reset or unmounted is still visible for its window. */
const catchLog: BoundaryCatch[] = []
const lastCatchCommitByBoundary = new Map<number, number>()
let catchSequence = 0
let latestEvictedCatchCommit = -1
let latestUnscannedCommit = -1
let captureInstalled = false
let originalConsoleError: typeof console.error | null = null
let captureConsoleError: typeof console.error | null = null

/** A new observation drops unclaimed logs only: a boundary in its error state or a showing fallback is current UI state, not window evidence. Unanalyzed commits so far precede the window, even those at its starting commit ID. */
export function clearErrorState(): void {
  errorLog.length = 0
  latestUnscannedCommit = Math.min(latestUnscannedCommit, getDocumentCommitId())
}

export function resetErrorStateForTests(): void {
  caught.clear()
  suspended.clear()
  errorLog.length = 0
  catchLog.length = 0
  lastCatchCommitByBoundary.clear()
  catchSequence = 0
  latestEvictedCatchCommit = -1
  latestUnscannedCommit = -1
  resetSuspenseHideLogForTests()
}

const isHostRootFiber = (fiber: Fiber): boolean =>
  fiber.tag === getReactWorkTagsForFiber(fiber).HostRoot

/** Per-fiber commit hook: records boundaries (or a root) that caught this commit, and Suspense boundaries showing a fallback for renderers Genie cannot scan live. */
export function recordErrorState(fiber: Fiber): void {
  if (isSuspenseFiber(fiber)) {
    const id = getFiberId(fiber)
    if (committedSuspenseState(fiber) === 'fallback') suspended.set(id, { id, fiber })
    else suspended.delete(id)
    return
  }
  recordBoundaryCatch(fiber)
}

export const hasCapturedError = (fiber: Fiber): boolean => ((fiber.flags ?? 0) & DID_CAPTURE) !== 0

/** Records the screen state a rendered fiber committed: a boundary catch, or a Suspense boundary hiding its content; `isTarget` picks the hidden instances worth naming. */
export function recordBoundaryCommit(fiber: Fiber, isTarget: (fiber: Fiber) => boolean): void {
  recordBoundaryCatch(fiber)
  if (!isSuspenseFiber(fiber)) return
  try {
    recordSuspenseHide(fiber, isTarget)
  } catch {
    noteUnscannedCommit()
  }
}

/** Records a boundary or root that caught in the current commit; cheap and unbudgeted, so analysis limits never hide a catch, and repeat calls for one commit are ignored. */
export function recordBoundaryCatch(fiber: Fiber): void {
  if (!hasCapturedError(fiber)) return
  try {
    const id = getFiberId(fiber)
    const documentCommitId = getDocumentCommitId()
    if (lastCatchCommitByBoundary.get(id) === documentCommitId) return
    lastCatchCommitByBoundary.set(id, documentCommitId)
    if (lastCatchCommitByBoundary.size > CATCH_LOG_LIMIT) {
      const oldest = lastCatchCommitByBoundary.keys().next().value
      if (oldest !== undefined) lastCatchCommitByBoundary.delete(oldest)
    }
    const isRoot = isHostRootFiber(fiber)
    const log = takeErrorLog(isRoot ? null : nameOf(fiber))
    caught.set(id, {
      boundaryId: id,
      fiber,
      isRoot,
      caughtState: fiber.memoizedState,
      preCatchState: fiber.alternate ? fiber.alternate.memoizedState : NO_STATE,
      errorFields: null,
      log,
    })
    const forced = forcedErrorBoundaries().some(
      (candidate) => candidate === fiber || candidate === fiber.alternate,
    )
    catchSequence += 1
    catchLog.push({
      catchId: `catch:${documentCommitId}:${catchSequence}`,
      documentCommitId,
      observationId: getActiveObservation()?.id ?? null,
      boundaryId: id,
      boundaryName: isRoot ? 'root' : nameOf(fiber),
      boundaryKind: isRoot ? 'root' : 'error-boundary',
      forced,
      message: log?.message ?? null,
      throwingComponent: log?.throwingComponent ?? null,
    })
    if (catchLog.length > CATCH_LOG_LIMIT) {
      const evicted = catchLog.shift()
      if (evicted) latestEvictedCatchCommit = evicted.documentCommitId
    }
  } catch {
    noteUnscannedCommit()
  }
}

/** A commit whose rendered fibers could not be walked may have hidden a catch. */
export function noteUnscannedCommit(): void {
  latestUnscannedCommit = Math.max(latestUnscannedCommit, getDocumentCommitId())
}

/** A commit from a renderer Genie does not analyze takes no document commit ID, so it counts against a window that started at the current ID, until the next observation places it before its start. */
export function noteUnanalyzedRendererCommit(): void {
  latestUnscannedCommit = Math.max(latestUnscannedCommit, getDocumentCommitId() + 1)
}

/** Catches committed after `afterDocumentCommitId`; complete only when none was evicted and every commit since was scanned. */
function getBoundaryCatchLog(afterDocumentCommitId: number, limit: number): BoundaryCatchLog {
  const matching = catchLog.filter((entry) => entry.documentCommitId > afterDocumentCommitId)
  const incompleteReasons: BoundaryCatchLog['incompleteReasons'] = []
  if (latestEvictedCatchCommit > afterDocumentCommitId) incompleteReasons.push('catches-evicted')
  if (latestUnscannedCommit > afterDocumentCommitId) incompleteReasons.push('commit-not-scanned')
  return {
    afterDocumentCommitId,
    documentCommitId: getDocumentCommitId(),
    catches: matching.slice(0, limit).map((entry) => ({ ...entry })),
    omittedByLimit: Math.max(0, matching.length - limit),
    complete: incompleteReasons.length === 0,
    incompleteReasons,
  }
}

/** React logs a caught error before the commit that records it; claiming the newest matching log (and dropping older ones for that boundary) keeps a repeat catch from reporting a stale message. */
function takeErrorLog(boundaryName: string | null): ErrorLog | null {
  for (let index = errorLog.length - 1; index >= 0; index -= 1) {
    const entry = errorLog[index]
    if (entry?.boundaryName !== boundaryName) continue
    for (let older = index; older >= 0; older -= 1) {
      if (errorLog[older]?.boundaryName === boundaryName) errorLog.splice(older, 1)
    }
    return entry
  }
  return null
}

/** Patches console.error to capture React's dev boundary-error logs (message + throwing component name) alongside DidCapture; installed from hook.ts before React loads, and always calls the original. */
export function installErrorCapture(): void {
  if (captureInstalled || typeof console === 'undefined') return
  captureInstalled = true
  originalConsoleError = console.error
  captureConsoleError = (...args: unknown[]): void => {
    try {
      const parsed = parseBoundaryError(args)
      if (parsed) {
        errorLog.push(withReportedError(parsed))
        if (errorLog.length > ERROR_LOG_LIMIT) errorLog.shift()
      }
    } catch {
      // never let capture break the app's logging
    }
    originalConsoleError?.apply(console, args)
  }
  console.error = captureConsoleError
  globalThis.addEventListener?.('error', noteReportedError)
}

let reportedError: unknown = NO_REPORTED_ERROR

// React 18 dev rethrows a caught error through a guarded event (so the browser reports it) and then logs only text naming the components.
function noteReportedError(event: Event): void {
  reportedError = (event as ErrorEvent).error
}

function withReportedError(parsed: ErrorLog): ErrorLog {
  const reported = reportedError
  reportedError = NO_REPORTED_ERROR
  if (parsed.message !== null || reported === NO_REPORTED_ERROR) return parsed
  return { ...parsed, message: ownString(reported, 'message'), stack: ownString(reported, 'stack') }
}

function ownString(value: unknown, key: string): string | null {
  const field = ownDataValue(value, key)?.value
  return typeof field === 'string' ? field : null
}

/** Restore console.error during module/HMR teardown without clobbering a later patch. */
export function uninstallErrorCapture(): void {
  if (captureConsoleError && console.error === captureConsoleError && originalConsoleError) {
    console.error = originalConsoleError
  }
  globalThis.removeEventListener?.('error', noteReportedError)
  captureInstalled = false
  captureConsoleError = null
  originalConsoleError = null
  reportedError = NO_REPORTED_ERROR
}

export function parseBoundaryError(args: unknown[]): ErrorLog | null {
  const text = args.filter((arg): arg is string => typeof arg === 'string').join('\n')
  const occurred = /occurred in the <([^>\s]+)[^>]*> component/.exec(text)
  // React 18: "…the error boundary you provided, Name" — React 19: "It was handled by the <Name> error boundary."
  const boundary =
    /error boundary you provided,?\s+(\w+)/.exec(text) ??
    /handled by the <([^>\s]+)[^>]*> error boundary/.exec(text)
  if (!occurred && !boundary) return null
  const error = args.find((arg): arg is Error => arg instanceof Error)
  // React 19.2 stops passing the Error instance for derived-state-only boundaries; fall back to the "Error: msg" line in the logged text.
  const textMessage = /(?:^|\n)(?:Uncaught\s+)?(?:[A-Z][\w$]*)?Error:\s+([^\n]+)/.exec(text)?.[1]
  return {
    message: error?.message ?? textMessage ?? null,
    stack: error?.stack ?? null,
    throwingComponent: occurred?.[1] ?? null,
    boundaryName: boundary?.[1] ?? null,
  }
}

export type CaughtErrorStatusReason =
  | 'state-unchanged-since-catch'
  | 'error-fields-unchanged'
  | 'root-has-no-children'
  | 'forced'
  | 'state-changed-since-catch'

export interface CaughtError {
  sourceOwnership: SourceOwnership
  boundaryId: number
  boundaryName: string
  /** `root` means no boundary caught the error and React unmounted the whole root. */
  boundaryKind: 'error-boundary' | 'root'
  boundarySource: ResolvedSource | null
  throwingComponent: string | null
  message: string | null
  /** The thrower's file:line is in this stack; we don't resolve it separately (its fiber is gone). */
  stack: string | null
  stackFrames: ResolvedStackFrame[]
  isLibraryBoundary: boolean
  /** True when the boundary is held in its error state by react_force_error_boundary rather than a real thrown error. */
  forced: boolean
  /** `active` = still in its error state now; `unknown` = it re-rendered with different state since the catch and may have recovered. */
  status: 'active' | 'unknown'
  statusReason: CaughtErrorStatusReason
  /** What the boundary renders now in place of its children. */
  rendered: RenderedOutput
}

export interface SuspendedBoundary {
  sourceOwnership: SourceOwnership
  boundaryId: number
  boundaryName: string
  source: ResolvedSource | null
  isFallbackShowing: boolean
  /** True when the fallback is held open by react_toggle_suspense_fallback rather than a real pending resource. */
  forced: boolean
}

const FORCED_ERROR_MESSAGE = 'forced via react_force_error_boundary (no real error thrown)'

export interface ErrorState {
  ownershipCoverage: ReturnType<typeof ownershipCoverage>
  scanTruncated: boolean
  caughtErrors: CaughtError[]
  suspended: SuspendedBoundary[]
  blankTreeHint: string | null
  catchLog?: BoundaryCatchLog
  hideLog?: SuspenseHideLog
}

type BoundaryStatus =
  | { status: 'active' | 'unknown'; reason: CaughtErrorStatusReason }
  | { status: 'recovered' }

interface LiveTree {
  current: Map<CaughtEntry, Fiber>
  fallbacks: Fiber[]
  fallbackScanTruncated: boolean
}

const FALLBACK_SCAN_FIBER_LIMIT = 50_000

/** Resolves each recorded boundary to its current fiber, and finds the Suspense fallbacks on screen now by the rule react_suspense and react_pending_work use. */
function scanLiveTree(entries: CaughtEntry[]): LiveTree {
  const wanted = new Map<Fiber, CaughtEntry>()
  for (const entry of entries) {
    wanted.set(entry.fiber, entry)
    if (entry.fiber.alternate) wanted.set(entry.fiber.alternate, entry)
  }
  const current = new Map<CaughtEntry, Fiber>()
  const roots = [..._fiberRoots].map((root) => root.current)
  if (wanted.size > 0) {
    for (const root of roots) {
      traverseFiber(root, (node) => {
        const entry = wanted.get(node)
        if (entry) current.set(entry, node)
        return false
      })
    }
  }
  const fallbacks: Fiber[] = []
  const { scanTruncated } = forEachVisibleSuspenseBoundary(
    roots,
    FALLBACK_SCAN_FIBER_LIMIT,
    (boundary, state) => {
      if (state === 'fallback') fallbacks.push(boundary)
    },
  )
  return { current, fallbacks, fallbackScanTruncated: scanTruncated }
}

function ownDataValue(value: unknown, key: string): { value: unknown } | undefined {
  if (typeof value !== 'object' || value === null || isKnownProxy(value)) return undefined
  const descriptor = safeOwnPropertyDescriptor(value, key)
  if (descriptor === null) return { value: undefined }
  return isDataDescriptor(descriptor) ? { value: descriptor.value } : undefined
}

function rendersChildrenElement(boundary: Fiber): boolean {
  const children = ownDataValue(boundary.memoizedProps, 'children')?.value
  const first = isArrayValue(children) ? children[0] : children
  const props = ownDataValue(first, 'props')
  return (
    props !== undefined && boundary.child !== null && boundary.child.memoizedProps === props.value
  )
}

/** The fields getDerivedStateFromError changed; restoring their pre-catch values means the boundary was reset. */
function errorFields(entry: CaughtEntry): string[] | undefined {
  if (entry.preCatchState === NO_STATE) return undefined
  const before = plainOwnKeys(entry.preCatchState)
  const after = plainOwnKeys(entry.caughtState)
  if (!before || !after) return undefined
  const fields = [...new Set([...before, ...after])].filter((key) => {
    const previous = ownDataValue(entry.preCatchState, key)
    const next = ownDataValue(entry.caughtState, key)
    return !previous || !next || !Object.is(previous.value, next.value)
  })
  return fields.length > 0 ? fields : undefined
}

function fieldsMatch(state: unknown, reference: unknown, fields: string[]): boolean {
  return fields.every((key) => {
    const actual = ownDataValue(state, key)
    const expected = ownDataValue(reference, key)
    return actual !== undefined && expected !== undefined && Object.is(actual.value, expected.value)
  })
}

function boundaryStatus(entry: CaughtEntry, current: Fiber): BoundaryStatus {
  if (entry.isRoot) {
    const element = ownDataValue(current.memoizedState, 'element')
    return element?.value == null
      ? { status: 'active', reason: 'root-has-no-children' }
      : { status: 'recovered' }
  }
  const state = current.memoizedState
  if (state === entry.caughtState)
    return { status: 'active', reason: 'state-unchanged-since-catch' }
  if (rendersChildrenElement(current)) return { status: 'recovered' }
  if (entry.errorFields === null) entry.errorFields = errorFields(entry)
  const fields = entry.errorFields
  if (fields && fieldsMatch(state, entry.preCatchState, fields)) return { status: 'recovered' }
  if (fields && fieldsMatch(state, entry.caughtState, fields)) {
    entry.caughtState = state
    return { status: 'active', reason: 'error-fields-unchanged' }
  }
  return { status: 'unknown', reason: 'state-changed-since-catch' }
}

export async function getErrorState(query: {
  appOnly?: boolean
  includeSource?: boolean
  limit?: number
  afterDocumentCommitId?: number
}): Promise<ErrorState> {
  const includeSource = query.includeSource ?? true
  const limit = query.limit ?? 20
  const classify = (fiber: Fiber) =>
    includeSource || query.appOnly
      ? classifyFiber(fiber)
      : Promise.resolve({ source: null, isLibrary: false, ownership: 'unknown' } as const)

  const forcedErrorIds = new Set(forcedErrorBoundaries().map(getFiberId))
  // Without registered roots there is no live tree to verify against, so recorded state stands as committed.
  const live = _fiberRoots.size > 0 ? scanLiveTree([...caught.values()]) : null
  const organicCaught: {
    fiber: Fiber
    boundaryId: number
    entry: CaughtEntry
    forced: boolean
    status: 'active' | 'unknown'
    statusReason: CaughtErrorStatusReason
  }[] = []
  for (const [id, entry] of caught) {
    const current = live ? live.current.get(entry) : entry.fiber
    if (!current) {
      caught.delete(id)
      continue
    }
    // React DevTools' forced error goes through a real DidCapture commit, so only the override registry can tell it apart.
    const forced = forcedErrorIds.has(entry.boundaryId)
    const status = forced
      ? { status: 'active' as const, reason: 'forced' as const }
      : boundaryStatus(entry, current)
    if (status.status === 'recovered') {
      caught.delete(id)
      continue
    }
    organicCaught.push({
      fiber: current,
      boundaryId: entry.boundaryId,
      entry,
      forced,
      status: status.status,
      statusReason: status.reason,
    })
  }
  const caughtIds = new Set(caught.keys())
  const forcedCaught = dedupeByBoundaryId(forcedErrorBoundaries(), caughtIds).map((entry) => ({
    ...entry,
    entry: null,
    forced: true,
    status: 'active' as const,
    statusReason: 'forced' as const,
  }))

  const caughtCandidates: CaughtError[] = await Promise.all(
    [...organicCaught, ...forcedCaught]
      .slice(0, query.appOnly ? 1000 : limit)
      .map(async ({ fiber, boundaryId, entry, forced, status, statusReason }) => {
        const { source, isLibrary, ownership } = await classify(fiber)
        const log = entry?.log ?? null
        const isRoot = entry?.isRoot ?? false
        return {
          boundaryId,
          boundaryName: isRoot ? 'root' : nameOf(fiber),
          boundaryKind: isRoot ? ('root' as const) : ('error-boundary' as const),
          boundarySource: includeSource && !isRoot ? source : null,
          sourceOwnership: ownership,
          throwingComponent: log?.throwingComponent ?? null,
          message: log?.message ?? (forced ? FORCED_ERROR_MESSAGE : null),
          stack: log?.stack ? (includeSource ? log.stack : withoutLibraryFrames(log.stack)) : null,
          stackFrames: log?.stack ? await resolveStackFrames(log.stack, isGenieFrame) : [],
          isLibraryBoundary: isLibrary,
          forced,
          status,
          statusReason,
          rendered: renderedOutputOf(fiber),
        }
      }),
  )

  const showing = live
    ? live.fallbacks.map((fiber) => ({ id: getFiberId(fiber), fiber }))
    : [...suspended.values()]
  const suspendedIds = new Set(showing.map((entry) => entry.id))
  const forcedSuspenseFibers = forcedSuspenseBoundaries()
  const forcedSuspenseIds = new Set(forcedSuspenseFibers.map(getFiberId))
  const forcedSuspended = dedupeByBoundaryId(forcedSuspenseFibers, suspendedIds)
  const suspendedCandidates: SuspendedBoundary[] = await Promise.all(
    [
      ...showing.map((entry) => ({
        fiber: entry.fiber,
        boundaryId: entry.id,
        forced: forcedSuspenseIds.has(entry.id),
      })),
      ...forcedSuspended.map((entry) => ({ ...entry, forced: true })),
    ]
      .slice(0, query.appOnly ? 1000 : limit)
      .map(async ({ fiber, boundaryId, forced }) => {
        const classification = await classify(fiber)
        return {
          boundaryId,
          boundaryName: suspenseBoundaryName(fiber),
          source: includeSource ? classification.source : null,
          sourceOwnership: classification.ownership,
          isFallbackShowing: true,
          forced,
        }
      }),
  )

  const all = [...caughtCandidates, ...suspendedCandidates]
  const kept = (entry: { sourceOwnership: SourceOwnership }) =>
    !query.appOnly || !isHiddenByAppOnly(entry.sourceOwnership)
  const caughtErrors = caughtCandidates.filter(kept).slice(0, limit)
  const suspendedList = suspendedCandidates.filter(kept).slice(0, limit)
  return {
    ...(query.afterDocumentCommitId === undefined
      ? {}
      : {
          catchLog: getBoundaryCatchLog(query.afterDocumentCommitId, limit),
          hideLog: getSuspenseHideLog(
            query.afterDocumentCommitId,
            limit,
            latestUnscannedCommit > query.afterDocumentCommitId,
          ),
        }),
    caughtErrors,
    suspended: suspendedList,
    blankTreeHint: hintFrom(caughtErrors),
    ownershipCoverage: ownershipCoverage(all.map((entry) => entry.sourceOwnership)),
    scanTruncated:
      live?.fallbackScanTruncated === true ||
      organicCaught.length + forcedCaught.length > caughtCandidates.length ||
      showing.length + forcedSuspended.length > suspendedCandidates.length,
  }
}

const STACK_FRAME = /^\s*at\s|@/

/** Drop frames from installed packages (React's own work loop dominates a boundary error's stack). */
export function withoutLibraryFrames(stack: string): string {
  const lines = stack.split('\n')
  const kept = lines.filter((line) => !STACK_FRAME.test(line) || !line.includes('/node_modules/'))
  const omitted = lines.length - kept.length
  return omitted > 0 ? [...kept, `    … ${omitted} library frames omitted`].join('\n') : stack
}

// Forced boundaries are appended after organic ones and unknown states sort last, so a real active error always wins the hint.
function hintFrom(caughtErrors: CaughtError[]): string | null {
  const first =
    caughtErrors.find((entry) => entry.status === 'active' && !entry.forced) ??
    caughtErrors.find((entry) => entry.status === 'active') ??
    caughtErrors[0]
  if (!first) return null
  if (first.forced)
    return `error boundary <${first.boundaryName}> is held in its error state by react_force_error_boundary (no real error) — call react_reset_overrides to release it`
  const what = first.message ? `"${first.message}"` : 'an error'
  const by = first.throwingComponent ? ` thrown by <${first.throwingComponent}>` : ''
  if (first.boundaryKind === 'root')
    return `an uncaught error${first.message ? ` (${what})` : ''}${by} unmounted the root — no error boundary caught it, so nothing renders`
  const at = first.boundarySource
    ? ` at ${first.boundarySource.file}:${first.boundarySource.line}`
    : ''
  if (first.status === 'unknown')
    return `error boundary <${first.boundaryName}>${at} caught ${what}${by} and has since re-rendered with different state — it may have recovered; check the screen`
  const shows =
    first.rendered.output === 'nothing'
      ? 'renders nothing in its place, so the failure is invisible on screen'
      : first.rendered.output === 'visible'
        ? `shows${first.rendered.text ? ` "${first.rendered.text}"` : ' a fallback'} instead`
        : first.rendered.output === 'empty'
          ? 'renders only empty elements in its place'
          : 'renders a fallback Genie cannot read on this renderer'
  return `error boundary <${first.boundaryName}>${at} caught ${what}${by} — its children did not render and it ${shows}`
}

// Forced fibers can arrive as both current and alternate buffers; collapse by boundary id and drop any already reported organically.
function dedupeByBoundaryId(
  fibers: Fiber[],
  exclude: Set<number>,
): { fiber: Fiber; boundaryId: number }[] {
  const seen = new Set<number>()
  const out: { fiber: Fiber; boundaryId: number }[] = []
  for (const fiber of fibers) {
    const boundaryId = getFiberId(fiber)
    if (exclude.has(boundaryId) || seen.has(boundaryId)) continue
    seen.add(boundaryId)
    out.push({ fiber, boundaryId })
  }
  return out
}
