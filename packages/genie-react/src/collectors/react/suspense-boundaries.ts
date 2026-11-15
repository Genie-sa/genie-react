import { type Fiber, getFiberId, isCompositeFiber } from 'bippy'
import { normalizeFileName, parseStack, symbolicateStack } from 'bippy/source'
import { roundMilliseconds } from '../../protocol'
import type { NodeId } from './contracts'
import { findAllRootFibers, findFiberById, nameOf, registerFiber } from './fiber'
import { getDocumentCommitId } from './observation'
import { findSuspenseBoundary, forcedSuspenseBoundaries } from './overrides'
import {
  classifyFibersWithinBudget,
  type FiberClassification,
  isLibraryFile,
  ownershipCoverage,
  packageNameFromFile,
} from './source'
import { capturedWakeablesOf, retryCacheOf } from './suspense-capture'
import type {
  SuspenseAwaiter,
  SuspenseBlockerFull,
  SuspenseBlockerStatus,
  SuspenseBoundaryState,
  SuspenseCapability,
  SuspenseReport,
  SuspenseStackFrame,
} from './suspense-contract'
import {
  type AwaiterRef,
  assessSuspenseCapability,
  componentEntriesOf,
  contentBlockersOf,
  dataLibraryOfFile,
  dedupeBlockers,
  isHiddenOffscreen,
  own,
  pendingBlockersOf,
  type RawBlocker,
  type StackSource,
  weakestCapability,
} from './suspense-debug-info'
import { committedSuspenseState, visibleChildOf } from './suspense-state'
import { isSuspenseFiber } from './work-tags'

export const SUSPENSE_FIBER_SCAN_LIMIT = 20_000
const APP_ONLY_CLASSIFY_LIMIT = 1_000
const STACK_FRAME_LIMIT = 8
const SOURCE_BUDGET_MS = 1_500
const SERVER_COMPONENT_LIMIT = 10
const WAITING_STATES: ReadonlySet<SuspenseBoundaryState> = new Set([
  'fallback',
  'transition-pending',
  'dehydrated',
])

export interface SuspenseQuery {
  id?: number
  waitingOnly: boolean
  limit: number
  blockerLimit: number
  includeSource: boolean
  appOnly: boolean
  view: 'summary' | 'full'
}

interface BoundaryRecord {
  fiber: Fiber
  root: Fiber
  capability: SuspenseCapability
  parent: BoundaryRecord | null
  content: RawBlocker[]
  pending: RawBlocker[]
  state: SuspenseBoundaryState
  memoizedState: unknown
  order: number
}

interface Scan {
  records: BoundaryRecord[]
  capabilities: SuspenseCapability[]
  roots: Fiber[]
  scanTruncated: boolean
  unattributedEntries: number
}

interface WalkItem {
  fiber: Fiber
  enclosing: BoundaryRecord | null
  composite: Fiber | null
}

function fiberRootOf(root: Fiber): unknown {
  return own(root, 'stateNode')
}

/** A FiberRoot with no pending lanes has nothing left to render, so an uncommitted attempt it once suspended is stale. */
function rootHasPendingWork(root: Fiber): boolean {
  const lanes = own(fiberRootOf(root), 'pendingLanes')
  return typeof lanes !== 'number' || lanes !== 0
}

/** React's own record that a render on this root suspended and has not committed, such as a transition waiting on data. */
function rootHoldsSuspendedRender(root: Fiber): boolean {
  const lanes = own(fiberRootOf(root), 'suspendedLanes')
  return typeof lanes === 'number' && lanes !== 0
}

/** React parks a finished render behind `timeoutHandle` (reveal throttling) or `cancelPendingCommit` (a commit waiting on suspensey resources). */
function rootHoldsFinishedRender(root: Fiber): boolean {
  const fiberRoot = fiberRootOf(root)
  const timeoutHandle = own(fiberRoot, 'timeoutHandle')
  const timeoutPending =
    timeoutHandle !== undefined && timeoutHandle !== null && timeoutHandle !== -1
  return timeoutPending || own(fiberRoot, 'cancelPendingCommit') != null
}

function awaiterFor(fiber: Fiber, composite: Fiber | null): AwaiterRef | null {
  const target = isCompositeFiber(fiber) ? fiber : composite
  return target ? { fiber: target, name: nameOf(target), env: null } : null
}

function describeBoundary(fiber: Fiber): string {
  const name = own(own(fiber, 'memoizedProps'), 'name')
  return typeof name === 'string' && name.length > 0 ? name.slice(0, 120) : 'Suspense'
}

function scanRoots(roots: Fiber[]): Scan {
  const records: BoundaryRecord[] = []
  const capabilities: SuspenseCapability[] = []
  let visited = 0
  let unattributedEntries = 0
  let scanTruncated = false

  for (const root of roots) {
    const capability = assessSuspenseCapability(root)
    capabilities.push(capability)
    const readsDebugInfo = capability.asyncDebugInfo !== 'unavailable'
    const pendingWork = rootHasPendingWork(root)
    const stack: WalkItem[] = root.child
      ? [{ fiber: root.child, enclosing: null, composite: null }]
      : []
    while (stack.length > 0) {
      const frame = stack.pop()
      if (!frame) break
      if (visited >= SUSPENSE_FIBER_SCAN_LIMIT) {
        scanTruncated = true
        break
      }
      visited += 1
      const { fiber, enclosing, composite } = frame
      if (fiber.sibling) stack.push({ fiber: fiber.sibling, enclosing, composite })
      if (isHiddenOffscreen(fiber)) continue
      if (readsDebugInfo) {
        const entries = contentBlockersOf(fiber, awaiterFor(fiber, composite))
        if (enclosing) enclosing.content.push(...entries)
        else unattributedEntries += entries.length
      }

      if (isSuspenseFiber(fiber)) {
        const committed = committedSuspenseState(fiber)
        const pending = dedupeBlockers(
          pendingBlockersOf(fiber, committed === 'fallback', capturedWakeablesOf(fiber)),
        ).filter((blocker) => committed !== null || (pendingWork && isUnsettled(blocker)))
        const record: BoundaryRecord = {
          fiber,
          root,
          capability,
          parent: enclosing,
          content: [],
          pending: readsDebugInfo ? pending : [],
          state: committed ?? (pending.length > 0 ? 'transition-pending' : 'content'),
          memoizedState: own(fiber, 'memoizedState'),
          order: records.length,
        }
        records.push(record)
        const child = visibleChildOf(fiber, committed)
        if (child) {
          stack.push({
            fiber: child,
            enclosing: committed === 'fallback' ? enclosing : record,
            composite,
          })
        }
        continue
      }
      if (fiber.child) {
        stack.push({
          fiber: fiber.child,
          enclosing,
          composite: isCompositeFiber(fiber) ? fiber : composite,
        })
      }
    }
    if (scanTruncated) break
  }
  return { records, capabilities, roots, scanTruncated, unattributedEntries }
}

function isUnsettled(blocker: RawBlocker): boolean {
  return blocker.status === 'pending' || blocker.status === 'unknown'
}

function targetBoundaryId(id: number, roots: Fiber[]): number {
  const fiber = roots.length > 0 ? findFiberById(roots[0] as Fiber, id as NodeId) : null
  if (!fiber) throw new Error(`Component ${id} not found (it may have unmounted).`)
  const boundary = findSuspenseBoundary(fiber)
  if (!boundary) {
    throw new Error(
      `No <Suspense> boundary at or above ${nameOf(fiber)} (#${id}); call react_suspense without id to list every boundary.`,
    )
  }
  return getFiberId(boundary)
}

// ── Stacks ─────────────────────────────────────────────────────────────────────

interface ResolvedStack {
  frames: SuspenseStackFrame[]
  truncated: boolean
}

const EMPTY_STACK: ResolvedStack = { frames: [], truncated: false }

function toFrame(
  functionName: unknown,
  fileName: unknown,
  line: unknown,
  column: unknown,
): SuspenseStackFrame {
  const file = typeof fileName === 'string' && fileName ? normalizeFileName(fileName) : null
  return {
    functionName: typeof functionName === 'string' && functionName ? functionName : null,
    file,
    line: typeof line === 'number' && Number.isInteger(line) ? line : null,
    column: typeof column === 'number' && Number.isInteger(column) ? column : null,
    isLibrary: file ? isLibraryFile(file) : false,
  }
}

function framesOfError(error: Error): ReturnType<typeof parseStack> {
  try {
    return typeof error.stack === 'string' ? parseStack(error.stack) : []
  } catch {
    return []
  }
}

const REACT_PACKAGES = new Set(['react', 'react-dom', 'scheduler'])

// React creates these Errors inside its own code (React.lazy, the Flight client), and bundlers serve React pre-bundled, so React frames are recognized only after source mapping.
function isReactFrame(frame: SuspenseStackFrame): boolean {
  const name = frame.file ? packageNameFromFile(frame.file) : null
  return name !== null && REACT_PACKAGES.has(name)
}

async function resolveStack(source: StackSource, symbolicate: boolean): Promise<ResolvedStack> {
  if (!source) return EMPTY_STACK
  let frames: SuspenseStackFrame[]
  if (Array.isArray(source)) {
    frames = source.flatMap((entry) =>
      Array.isArray(entry) ? [toFrame(entry[0], entry[1], entry[2], entry[3])] : [],
    )
  } else {
    const parsed = framesOfError(source).slice(0, STACK_FRAME_LIMIT * 2)
    let mapped = parsed
    if (symbolicate && parsed.length > 0) {
      try {
        mapped = await symbolicateStack(parsed)
      } catch {
        mapped = parsed
      }
    }
    frames = mapped.map((frame) =>
      toFrame(frame.functionName, frame.fileName, frame.lineNumber, frame.columnNumber),
    )
  }
  const kept = frames.filter((frame) => !isReactFrame(frame))
  return { frames: kept.slice(0, STACK_FRAME_LIMIT), truncated: kept.length > STACK_FRAME_LIMIT }
}

function withDeadline<T>(
  work: Promise<T>,
  fallback: T,
  ms: number,
): Promise<{ value: T; timedOut: boolean }> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    work.then((value) => ({ value, timedOut: false })),
    new Promise<{ value: T; timedOut: boolean }>((resolve) => {
      timer = setTimeout(() => resolve({ value: fallback, timedOut: true }), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

function firstAppLocation(...stacks: ResolvedStack[]): string | null {
  for (const stack of stacks) {
    const frame = stack.frames.find((candidate) => candidate.file && !candidate.isLibrary)
    if (frame?.file) return frame.line === null ? frame.file : `${frame.file}:${frame.line}`
  }
  return null
}

async function classifyAwaiters(
  blockers: RawBlocker[],
  includeSource: boolean,
): Promise<{ byFiber: Map<Fiber | null, FiberClassification>; partial: boolean }> {
  const fibers = [
    ...new Set(
      blockers.flatMap((blocker) => (blocker.awaitedBy?.fiber ? [blocker.awaitedBy.fiber] : [])),
    ),
  ]
  if (!includeSource || fibers.length === 0) return { byFiber: new Map(), partial: false }
  const { classes, partial } = await classifyFibersWithinBudget(fibers)
  const byFiber = new Map<Fiber | null, FiberClassification>()
  fibers.forEach((fiber, index) => {
    const classification = classes[index]
    if (classification) byFiber.set(fiber, classification)
  })
  return { byFiber, partial }
}

// ── Output ─────────────────────────────────────────────────────────────────────

function awaiterOutput(ref: AwaiterRef | null): SuspenseAwaiter {
  if (!ref) return null
  return { id: ref.fiber ? registerFiber(ref.fiber) : null, name: ref.name, env: ref.env }
}

function round(value: number | null): number | null {
  return value === null ? null : roundMilliseconds(value)
}

function shapeBlocker(
  blocker: RawBlocker,
  stacks: { await: ResolvedStack; io: ResolvedStack },
  awaiterSource: FiberClassification | undefined,
  observedAtMs: number,
): SuspenseBlockerFull {
  const library =
    (blocker.kind === 'use' || blocker.kind === 'unknown') &&
    ([...stacks.await.frames, ...stacks.io.frames].some((frame) => dataLibraryOfFile(frame.file)) ||
      dataLibraryOfFile(awaiterSource?.source?.file ?? null))
  const settled = blocker.status === 'fulfilled' || blocker.status === 'rejected'
  return {
    kind: library ? 'data-library' : blocker.kind,
    kindEvidence: library ? 'inferred' : blocker.kindEvidence,
    basis: library ? 'data-library-frame' : blocker.basis,
    phase: blocker.phase,
    status: blocker.status,
    name: blocker.name,
    description: blocker.description,
    durationMs:
      settled && blocker.startMs !== null && blocker.endMs !== null
        ? round(Math.max(0, blocker.endMs - blocker.startMs))
        : null,
    pendingForMs:
      blocker.status === 'pending' && blocker.startMs !== null
        ? round(Math.max(0, observedAtMs - blocker.startMs))
        : null,
    awaitedBy: awaiterOutput(blocker.awaitedBy),
    location: firstAppLocation(stacks.await, stacks.io),
    recordedBy: blocker.recordedBy,
    startMs: round(blocker.startMs),
    endMs: round(blocker.endMs),
    env: blocker.env,
    owner: awaiterOutput(blocker.owner),
    awaitStack: stacks.await.frames,
    ioStack: stacks.io.frames,
    stacksTruncated: stacks.await.truncated || stacks.io.truncated,
  }
}

function summarizeBlocker(blocker: SuspenseBlockerFull) {
  const {
    basis: _basis,
    recordedBy: _recordedBy,
    startMs: _startMs,
    endMs: _endMs,
    env: _env,
    owner: _owner,
    awaitStack: _awaitStack,
    ioStack: _ioStack,
    stacksTruncated: _stacksTruncated,
    ...summary
  } = blocker
  return summary
}

function blockerStatusOf(record: BoundaryRecord, forced: boolean): SuspenseBlockerStatus {
  if (record.capability.asyncDebugInfo === 'unavailable') return 'unavailable'
  if (record.pending.length > 0) return 'pending-observed'
  if (WAITING_STATES.has(record.state) || forced) return 'not-observable'
  if (record.content.length > 0) return 'awaited-only'
  return retryCacheOf(record.fiber) !== null ? 'unrecorded' : 'none'
}

const STATE_RANK: Record<SuspenseBoundaryState, number> = {
  fallback: 0,
  'transition-pending': 1,
  dehydrated: 2,
  content: 3,
}

function compareRecords(left: BoundaryRecord, right: BoundaryRecord): number {
  const byState = STATE_RANK[left.state] - STATE_RANK[right.state]
  if (byState !== 0) return byState
  const byContent = Number(right.content.length > 0) - Number(left.content.length > 0)
  return byContent !== 0 ? byContent : left.order - right.order
}

function blockerPhrase(blocker: SuspenseBlockerFull): string {
  const what = blocker.kind === 'use' ? 'use()' : blocker.kind
  const name = blocker.name ? ` "${blocker.name}"` : ''
  const timing =
    blocker.pendingForMs !== null
      ? ` pending ${Math.round(blocker.pendingForMs)}ms`
      : ` ${blocker.status}`
  return `${what}${name}${timing}`
}

function hintFor(
  boundary: {
    id: number
    name: string
    state: SuspenseBoundaryState
    forced: boolean
    blockerStatus: SuspenseBlockerStatus
    blockers: SuspenseBlockerFull[]
  },
  capability: SuspenseCapability,
  commitScheduled: boolean,
): string {
  const label = `<Suspense name="${boundary.name}"> #${boundary.id}`
  const showing =
    boundary.state === 'transition-pending'
      ? 'keeps old content on screen while a transition waits'
      : boundary.state === 'dehydrated'
        ? 'is still dehydrated server HTML'
        : 'shows its fallback'
  if (boundary.forced) {
    return `${label} ${showing} because react_toggle_suspense_fallback holds it; call react_reset_overrides to release it`
  }
  if (boundary.blockerStatus === 'unavailable') {
    return `${label} ${showing}; blockers are unavailable (${capability.reason ?? 'unknown reason'})`
  }
  const pending = boundary.blockers.filter((blocker) => blocker.phase === 'pending')
  if (pending.length === 0) {
    return commitScheduled
      ? `${label} ${showing}; React holds a finished render for commit (reveal throttling or loading stylesheets), so read again shortly`
      : `${label} ${showing}; React kept no pending render attempt to read, so its blocker is not observable yet`
  }
  const more = pending.length > 1 ? ` and ${pending.length - 1} more` : ''
  return `${label} ${showing}, waiting on ${blockerPhrase(pending[0] as SuspenseBlockerFull)}${more}`
}

/** Read every Suspense boundary and what it waits on. Fibers and promise states are read in one synchronous pass, so the snapshot is consistent; source resolution afterwards only adds locations. */
export async function getSuspenseReport(query: SuspenseQuery): Promise<SuspenseReport> {
  const observedAtMs = performance.now()
  const roots = findAllRootFibers()
  const scan = scanRoots(roots)
  const forcedIds = new Set(forcedSuspenseBoundaries().map(getFiberId))
  const targetId = query.id === undefined ? null : targetBoundaryId(query.id, roots)

  const counts = { boundaries: 0, fallback: 0, transitionPending: 0, dehydrated: 0, content: 0 }
  for (const record of scan.records) {
    counts.boundaries += 1
    if (record.state === 'transition-pending') counts.transitionPending += 1
    else counts[record.state] += 1
  }

  const candidates = scan.records
    .filter((record) => targetId === null || getFiberId(record.fiber) === targetId)
    .filter((record) => !query.waitingOnly || WAITING_STATES.has(record.state))
    .sort(compareRecords)
  const classifyBoundaries = query.includeSource || query.appOnly
  const classified = classifyBoundaries
    ? await classifyFibersWithinBudget(
        candidates
          .slice(0, query.appOnly ? APP_ONLY_CLASSIFY_LIMIT : query.limit)
          .map((record) => record.fiber),
      )
    : null
  const classOf = (index: number): FiberClassification | undefined => classified?.classes[index]
  const kept = candidates
    .map((record, index) => ({ record, classification: classOf(index) }))
    .filter(({ classification }) => !query.appOnly || classification?.ownership === 'app')
  const selected = kept.slice(0, query.limit)

  let sourcesPartial = classified?.partial ?? false
  const boundaries = await Promise.all(
    selected.map(async ({ record, classification }) => {
      const ordered = [...record.pending, ...dedupeBlockers(record.content)]
      const blockers = ordered.slice(0, query.blockerLimit)
      const awaiterSources = await classifyAwaiters(blockers, query.includeSource)
      if (awaiterSources.partial) sourcesPartial = true
      const resolved = await withDeadline(
        Promise.all(
          blockers.map(async (blocker) => ({
            await: await resolveStack(blocker.awaitStack, query.includeSource),
            io: await resolveStack(blocker.ioStack, query.includeSource),
          })),
        ),
        blockers.map(() => ({ await: EMPTY_STACK, io: EMPTY_STACK })),
        SOURCE_BUDGET_MS,
      )
      if (resolved.timedOut) sourcesPartial = true
      const shaped = blockers.map((blocker, index) =>
        shapeBlocker(
          blocker,
          resolved.value[index] ?? { await: EMPTY_STACK, io: EMPTY_STACK },
          awaiterSources.byFiber.get(blocker.awaitedBy?.fiber ?? null),
          observedAtMs,
        ),
      )
      const forced = forcedIds.has(getFiberId(record.fiber))
      return {
        id: registerFiber(record.fiber),
        name: describeBoundary(record.fiber),
        parentBoundaryId: record.parent ? registerFiber(record.parent.fiber) : null,
        state: record.state,
        stateEvidence:
          record.state === 'transition-pending' ? ('inferred' as const) : ('exact' as const),
        forced,
        fallbackCommittedSinceMount: retryCacheOf(record.fiber) !== null,
        blockerStatus: blockerStatusOf(record, forced),
        blockersOmitted: ordered.length - blockers.length,
        source: query.includeSource ? (classification?.source ?? null) : null,
        sourceOwnership: classification?.ownership ?? ('unknown' as const),
        blockers: shaped,
        serverComponents: componentEntriesOf(own(record.fiber, '_debugInfo'))
          .slice(0, SERVER_COMPONENT_LIMIT)
          .map(({ name, env }) => ({ name, env })),
      }
    }),
  )

  const settledDuringRead = selected.some(({ record }) =>
    record.pending.some((blocker) => blocker.liveStatus() !== blocker.status),
  )
  const committedDuringRead =
    scan.roots.some((root) => own(fiberRootOf(root), 'current') !== root) ||
    selected.some(({ record }) => own(record.fiber, 'memoizedState') !== record.memoizedState)

  const capability = weakestCapability(scan.capabilities) ?? assessSuspenseCapability(null)
  const waitingWithoutBlocker = scan.records.filter(
    (record) => WAITING_STATES.has(record.state) && record.pending.length === 0,
  ).length
  const changedDuringRead = settledDuringRead || committedDuringRead
  const commitScheduled = scan.roots.some(rootHoldsFinishedRender)
  const unattributedSuspendedRoots = scan.roots.filter(
    (root) =>
      rootHoldsSuspendedRender(root) &&
      !scan.records.some((record) => record.root === root && WAITING_STATES.has(record.state)),
  ).length
  const omittedByLimit = kept.length - selected.length
  const waiting = boundaries.find((boundary) => WAITING_STATES.has(boundary.state))
  const base = {
    capability,
    observedAtMs: roundMilliseconds(observedAtMs),
    documentCommitId: getDocumentCommitId(),
    counts,
    omittedByLimit,
    coverage: {
      complete:
        capability.asyncDebugInfo === 'available' &&
        !scan.scanTruncated &&
        omittedByLimit === 0 &&
        waitingWithoutBlocker === 0 &&
        unattributedSuspendedRoots === 0 &&
        !changedDuringRead,
      scanTruncated: scan.scanTruncated,
      fiberScanLimit: SUSPENSE_FIBER_SCAN_LIMIT,
      waitingWithoutBlocker,
      unattributedEntries: scan.unattributedEntries,
      unattributedSuspendedRoots,
      changedDuringRead,
      commitScheduled,
      sourcesPartial,
    },
    ownershipCoverage: ownershipCoverage(
      candidates.map((_record, index) => classOf(index)?.ownership ?? 'unknown'),
    ),
    waitingHint: waiting
      ? hintFor(waiting, capability, commitScheduled)
      : unattributedSuspendedRoots > 0
        ? 'React holds a suspended render, such as a transition, that no Suspense boundary explains; the screen may still show the previous UI'
        : null,
  }
  if (query.view === 'full') return { ...base, view: 'full', boundaries }
  return {
    ...base,
    view: 'summary',
    boundaries: boundaries.map(
      ({ serverComponents: _serverComponents, blockers, ...boundary }) => ({
        ...boundary,
        blockers: blockers.map(summarizeBlocker),
      }),
    ),
  }
}
