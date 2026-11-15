import {
  _fiberRoots,
  type Fiber,
  type FiberRoot,
  getReactWorkTagsForFiber,
  instrument,
  type Unsubscribe,
} from 'bippy'
import { currentlyRenderingFiber } from '../causal/render-started-queries'
import { getDocumentCommitId } from './observation'
import { supportedCommitHandler } from './safe-instrumentation'
import { isHiddenOffscreen, own } from './suspense-debug-info'
import { committedSuspenseState } from './suspense-state'
import { isSuspenseFiber } from './work-tags'

// React marks a HostRoot it renders again on the client after hydration failed outside every Suspense boundary.
const FORCE_CLIENT_RENDER = 0b1_0000_0000
// React's DehydratedFragment work tag in 18 and 19: the fiber standing for a boundary's server HTML until it hydrates.
const DEHYDRATED_FRAGMENT_TAG = 18
const SCAN_LIMIT = 20_000
const RECORD_LIMIT = 100
const MESSAGE_LIMIT = 300
const DIFF_LIMIT = 4_000
const STACK_LINE_LIMIT = 12
const HYDRATION_LINK = 'https://react.dev/link/hydration-mismatch'

export type HydrationOutcome = 'hydrated' | 'client-rendered'

export type HydrationReportKind =
  | 'text-mismatch'
  | 'html-mismatch'
  | 'attribute-mismatch'
  | 'hydration-error'
  | 'server-render-error'
  | 'recoverable-error'

interface HeldFiber {
  deref(): Fiber | undefined
}

interface BoundaryOutcome {
  boundary: HeldFiber
  root: FiberRoot
  outcome: HydrationOutcome
  atMs: number
  documentCommitId: number
}

interface RootOutcome {
  root: FiberRoot
  outcome: HydrationOutcome
  atMs: number
  documentCommitId: number
}

export interface HydrationReport {
  kind: HydrationReportKind
  message: string
  digest: string | null
  diff: string | null
  differences: Array<{ under: string | null; client: string | null; server: string | null }>
  componentStack: string[]
  source: HeldFiber | null
  boundary: HeldFiber | null
  root: FiberRoot | null
  atMs: number
  documentCommitId: number
}

interface RootState {
  /** false for a root created on the client, seen at its first commit; null when Genie first saw it after its first commit, so whether it hydrated is unknown. */
  serverRendered: boolean | null
  watching: boolean
}

const hold = (fiber: Fiber): HeldFiber =>
  typeof WeakRef === 'function' ? new WeakRef(fiber) : { deref: () => fiber }

const rootStates = new WeakMap<FiberRoot, RootState>()
const observedRoots: FiberRoot[] = []
const dehydratedSeen = new WeakSet<Fiber>()
const resolvedBoundaries = new WeakMap<Fiber, HydrationOutcome>()
const boundaryOutcomes: BoundaryOutcome[] = []
const rootOutcomes: RootOutcome[] = []
const reports: HydrationReport[] = []
const wrappedRoots = new WeakSet<FiberRoot>()
let instrumentation: Unsubscribe | null = null
let originalConsoleError: typeof console.error | null = null
let captureConsoleError: typeof console.error | null = null

function bounded<T>(list: T[], item: T): void {
  list.push(item)
  if (list.length > RECORD_LIMIT) list.shift()
}

function isDehydratedFragment(fiber: Fiber): boolean {
  const tag = getReactWorkTagsForFiber(fiber).DehydratedSuspenseComponent
  return fiber.tag === (typeof tag === 'number' && tag >= 0 ? tag : DEHYDRATED_FRAGMENT_TAG)
}

/** React deletes a boundary's DehydratedFragment, and with it the server HTML, only when it renders that boundary on the client instead of hydrating it. */
function deletedServerHtml(boundary: Fiber): boolean {
  const deletions = own(boundary, 'deletions')
  return Array.isArray(deletions) && deletions.some((child: Fiber) => isDehydratedFragment(child))
}

function isDehydratedRootState(state: unknown): boolean {
  return own(state, 'isDehydrated') === true
}

function noteBoundary(root: FiberRoot, boundary: Fiber, outcome: HydrationOutcome): void {
  resolvedBoundaries.set(boundary, outcome)
  if (boundary.alternate) resolvedBoundaries.set(boundary.alternate, outcome)
  bounded(boundaryOutcomes, {
    boundary: hold(boundary),
    root,
    outcome,
    atMs: performance.now(),
    documentCommitId: getDocumentCommitId(),
  })
}

/** Finds boundaries still showing server HTML and those that stopped this commit; returns whether any remain. */
function scanBoundaries(root: FiberRoot): boolean {
  const stack: Fiber[] = root.current.child ? [root.current.child] : []
  let remaining = false
  let visited = 0
  while (stack.length > 0 && visited < SCAN_LIMIT) {
    const fiber = stack.pop() as Fiber
    visited += 1
    if (fiber.sibling) stack.push(fiber.sibling)
    if (isHiddenOffscreen(fiber)) continue
    if (isSuspenseFiber(fiber)) {
      const state = committedSuspenseState(fiber)
      if (state === 'dehydrated') {
        dehydratedSeen.add(fiber)
        if (fiber.alternate) dehydratedSeen.add(fiber.alternate)
        remaining = true
        continue
      }
      const wasDehydrated =
        dehydratedSeen.has(fiber) ||
        committedSuspenseState(fiber.alternate ?? fiber) === 'dehydrated'
      if (wasDehydrated && !resolvedBoundaries.has(fiber)) {
        noteBoundary(root, fiber, deletedServerHtml(fiber) ? 'client-rendered' : 'hydrated')
      }
    }
    if (fiber.child) stack.push(fiber.child)
  }
  return remaining || visited >= SCAN_LIMIT
}

function observeCommit(root: FiberRoot): void {
  wrapRecoverableErrors(root)
  let state = rootStates.get(root)
  const previous = root.current.alternate
  if (!state) {
    const hydratingNow = isDehydratedRootState(previous?.memoizedState)
    const firstClientCommit = !hydratingNow && own(previous?.memoizedState, 'element') == null
    state = {
      serverRendered: hydratingNow ? true : firstClientCommit ? false : null,
      watching: true,
    }
    rootStates.set(root, state)
    bounded(observedRoots, root)
    if (hydratingNow && !isDehydratedRootState(root.current.memoizedState)) {
      bounded(rootOutcomes, {
        root,
        outcome: (root.current.flags & FORCE_CLIENT_RENDER) !== 0 ? 'client-rendered' : 'hydrated',
        atMs: performance.now(),
        documentCommitId: getDocumentCommitId(),
      })
    }
  }
  if (!state.watching) return
  const remaining = scanBoundaries(root)
  if (remaining && state.serverRendered === null) state.serverRendered = true
  state.watching = remaining
}

// ── What React reports ─────────────────────────────────────────────────────────

function ownString(value: unknown, key: string): string | null {
  const read = own(value, key)
  return typeof read === 'string' ? read : null
}

function classify(message: string): HydrationReportKind {
  if (/^Hydration failed because the server rendered text/.test(message)) return 'text-mismatch'
  if (/^Hydration failed because/.test(message)) return 'html-mismatch'
  if (/^Text content does not match server-rendered HTML/.test(message)) return 'text-mismatch'
  if (
    /^The server could not finish this Suspense boundary/.test(message) ||
    /^Switched to client rendering because the server rendering errored/.test(message)
  ) {
    return 'server-render-error'
  }
  if (/hydrat/i.test(message)) return 'hydration-error'
  return 'recoverable-error'
}

/** React's development diff: `+` lines are what the client rendered, `-` lines what the server sent, nested under the element they belong to. A line on one side only is a difference when it is an element only that side had; React also prints unchanged client text that way. */
function parseHydrationDiff(diff: string): HydrationReport['differences'] {
  const differences: HydrationReport['differences'] = []
  const open: Array<{ indent: number; name: string }> = []
  for (const line of diff.split('\n')) {
    const marker = /^\s*([+-])\s*(.*)$/.exec(line)
    if (!marker) {
      const tag = /^(\s*)<([A-Za-z][\w.$:-]*)/.exec(line)
      if (tag) {
        const indent = tag[1]?.length ?? 0
        while (open.length > 0 && (open[open.length - 1]?.indent ?? 0) >= indent) open.pop()
        open.push({ indent, name: tag[2] ?? '' })
      }
      continue
    }
    const content = marker[2] ?? ''
    const under = open[open.length - 1]?.name ?? null
    const last = differences[differences.length - 1]
    if (marker[1] === '+') {
      differences.push({ under, client: content, server: null })
    } else if (last && last.server === null && last.client !== null && last.under === under) {
      last.server = content
    } else {
      differences.push({ under, client: null, server: content })
    }
  }
  return differences
    .filter(
      ({ client, server }) =>
        (client !== null && server !== null) || (client ?? server ?? '').startsWith('<'),
    )
    .slice(0, 20)
}

function splitMessage(text: string): { message: string; diff: string | null } {
  const linkAt = text.indexOf(HYDRATION_LINK)
  const head = (linkAt >= 0 ? text.slice(0, linkAt) : text).split('\n')[0] ?? ''
  const diff = linkAt >= 0 ? text.slice(linkAt + HYDRATION_LINK.length).replace(/^\s*\n/, '') : ''
  return {
    message: head.slice(0, MESSAGE_LIMIT),
    diff: diff.trim() ? diff.slice(0, DIFF_LIMIT) : null,
  }
}

function stackLines(componentStack: string | null): string[] {
  if (!componentStack) return []
  return componentStack
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, STACK_LINE_LIMIT)
}

function nearestBoundary(fiber: Fiber | null): Fiber | null {
  let node = fiber
  while (node && !isSuspenseFiber(node)) node = node.return
  return node
}

function recordReport(
  kind: HydrationReportKind,
  text: string,
  details: { componentStack: string | null; digest: string | null; root: FiberRoot | null },
): void {
  const { message, diff } = splitMessage(text)
  const source = currentlyRenderingFiber()
  const boundary = nearestBoundary(source)
  bounded(reports, {
    kind,
    message,
    digest: details.digest?.slice(0, MESSAGE_LIMIT) ?? null,
    diff,
    differences: diff ? parseHydrationDiff(diff) : [],
    componentStack: stackLines(details.componentStack),
    source: source ? hold(source) : null,
    boundary: boundary ? hold(boundary) : null,
    root: details.root,
    atMs: performance.now(),
    documentCommitId: getDocumentCommitId(),
  })
}

/** React reads `onRecoverableError` from the FiberRoot after the DevTools commit hook runs, so wrapping it there sees the hydration errors of that same commit. The original handler always runs with the same arguments. */
function wrapRecoverableErrors(root: FiberRoot): void {
  if (wrappedRoots.has(root)) return
  wrappedRoots.add(root)
  const original = own(root, 'onRecoverableError')
  if (typeof original !== 'function') return
  const wrapper = function (this: unknown, ...args: unknown[]): unknown {
    try {
      const [error, info] = args
      const text =
        ownString(error, 'message') ?? (typeof error === 'string' ? error : String(error))
      recordReport(classify(text), text, {
        componentStack: ownString(info, 'componentStack'),
        digest: ownString(error, 'digest'),
        root,
      })
    } catch {
      // Evidence is best effort; the app's handler must run regardless.
    }
    return Reflect.apply(original, this, args)
  }
  try {
    ;(root as unknown as { onRecoverableError: unknown }).onRecoverableError = wrapper
  } catch {
    // A frozen root keeps its handler; recoverable errors stay unobserved.
  }
}

/** React 19 warns, without regenerating anything, when only attributes differ; React 18 warns about each difference before it throws. */
function hydrationWarning(args: unknown[]): { kind: HydrationReportKind; text: string } | null {
  const [format, ...rest] = args
  if (typeof format !== 'string') return null
  const kind: HydrationReportKind | null =
    format.startsWith('A tree hydrated but some attributes') ||
    format.startsWith('Warning: Prop `%s` did not match')
      ? 'attribute-mismatch'
      : format.startsWith('Warning: Text content did not match')
        ? 'text-mismatch'
        : /^Warning: (Expected|Did not expect) server HTML to contain/.test(format)
          ? 'html-mismatch'
          : null
  if (!kind) return null
  let index = 0
  return { kind, text: format.replace(/%[sdoO]/g, () => String(rest[index++] ?? '')) }
}

function installHydrationCapture(): void {
  if (captureConsoleError || typeof console === 'undefined') return
  originalConsoleError = console.error
  captureConsoleError = (...args: unknown[]): void => {
    try {
      const warning = hydrationWarning(args)
      if (warning) {
        recordReport(warning.kind, warning.text, { componentStack: null, digest: null, root: null })
      }
    } catch {
      // Never let capture break the app's logging.
    }
    originalConsoleError?.apply(console, args)
  }
  console.error = captureConsoleError
}

export function startHydrationTracking(): void {
  if (instrumentation) return
  installHydrationCapture()
  instrumentation = instrument({
    name: 'genie-react-hydration',
    onCommitFiberRoot: supportedCommitHandler((_rendererId, root) => observeCommit(root)),
  })
  for (const root of _fiberRoots) {
    try {
      observeCommit(root)
    } catch {
      // A root that cannot be read yet is observed on its next commit.
    }
  }
}

export function disposeHydrationTracking(): void {
  instrumentation?.()
  instrumentation = null
  if (captureConsoleError && console.error === captureConsoleError && originalConsoleError) {
    console.error = originalConsoleError
  }
  captureConsoleError = null
  originalConsoleError = null
}

export function resetHydrationStateForTests(): void {
  boundaryOutcomes.length = 0
  rootOutcomes.length = 0
  reports.length = 0
  observedRoots.length = 0
}

// ── Reads ──────────────────────────────────────────────────────────────────────

/** How a boundary that arrived as server HTML ended up on screen, when Genie watched it hydrate. */
export function hydrationOutcomeOf(boundary: Fiber): HydrationOutcome | null {
  return resolvedBoundaries.get(boundary) ?? null
}

export interface HydrationSnapshot {
  roots: Array<{
    root: FiberRoot
    serverRendered: boolean | null
    outcome: RootOutcome | null
  }>
  boundaries: BoundaryOutcome[]
  reports: HydrationReport[]
  watching: boolean
}

export function hydrationSnapshot(): HydrationSnapshot {
  const roots = observedRoots.map((root) => ({
    root,
    serverRendered: rootStates.get(root)?.serverRendered ?? null,
    outcome: rootOutcomes.find((entry) => entry.root === root) ?? null,
  }))
  return {
    roots,
    boundaries: [...boundaryOutcomes],
    reports: [...reports],
    watching: roots.some(({ root }) => rootStates.get(root)?.watching === true),
  }
}
