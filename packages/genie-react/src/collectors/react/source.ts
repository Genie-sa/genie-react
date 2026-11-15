import { type Fiber, getDisplayName, getFiberId, getLatestFiber } from 'bippy'
import {
  formatOwnerStack,
  getSourceFromSourceMap,
  getSourceMap,
  type HookSource,
  type HooksNode,
  isSourceFile,
  normalizeFileName,
  parseStack,
  type SourceFetch,
  type SourceMap,
} from 'bippy/source'
import { isDataDescriptor, safeOwnPropertyDescriptor } from '../causal/safe-object'

/** What a component source points at: where its element was created (`<Card />` in the parent), or a line inside the component's own body. */
export type SourceRole = 'element-callsite' | 'component-body'

export interface ResolvedSource {
  file: string
  line: number | null
  column: number | null
  functionName: string | null
  sourceMapConfidence?: 'mapped' | 'served'
  role?: SourceRole
}

export interface SourceProvenance {
  definitionSource: ResolvedSource | null
  allocationCallsite: ResolvedSource | null
  hookDefinitionOwner: ResolvedSource | null
  hookCallsite: ResolvedSource | null
  package: string | null
  sourceMapConfidence: 'mapped' | 'served' | 'unknown'
  failureReason:
    | 'source-unresolved'
    | 'definition-and-allocation-not-distinguished'
    | 'hook-provenance-unavailable'
    | null
  usageOrDefinitionFallback: ResolvedSource | null
}

export interface FiberClassification {
  source: ResolvedSource | null
  ownership: SourceOwnership
  /** Compatibility projection only; false does not imply app ownership. */
  isLibrary: boolean
}

export type SourceOwnership = 'app' | 'library' | 'unknown'

export type SourceAttribution =
  | { role: 'usage-or-definition-fallback'; evidence: 'inferred' }
  | { role: 'unavailable'; evidence: 'unknown' }

export type EffectSourceResolutionStatus =
  | 'resolved'
  | 'no-user-effects'
  | 'inspection-unavailable'
  | 'inspection-truncated'
  | 'shadow-render-disabled'
  | 'deadline-exceeded'
  | 'report-state-advanced'

export interface EffectSourceResolution {
  status: EffectSourceResolutionStatus
  sources: (ResolvedSource | null)[] | null
  callsites: ResolvedEffectCallsite[] | null
}

export interface ResolvedHookAncestryFrame {
  name: string
  source: ResolvedSource | null
}

export interface ResolvedEffectCallsite {
  source: ResolvedSource | null
  hookAncestry: ResolvedHookAncestryFrame[]
}

export type ExternalStoreSourceResolutionStatus =
  | 'resolved'
  | 'no-external-stores'
  | 'inspection-unavailable'
  | 'inspection-truncated'
  | 'shadow-render-disabled'
  | 'deadline-exceeded'
  | 'report-state-advanced'

export interface ResolvedExternalStoreCallsite {
  callsite: ResolvedSource | null
  primitiveSource: ResolvedSource | null
  hookAncestry: ResolvedHookAncestryFrame[]
}

export interface ExternalStoreSourceResolution {
  status: ExternalStoreSourceResolutionStatus
  hooks: ResolvedExternalStoreCallsite[] | null
}

const cache = new Map<number, ResolvedSource>()
const pendingSource = new Map<number, Promise<ResolvedSource | null>>()
let cacheGeneration = 0
const OWNED_DEFINITION_SCAN_LIMIT = 200
const DEFAULT_CLASSIFY_LIMIT = 120
const DEFAULT_CLASSIFY_BUDGET_MS = 500
const UNCLASSIFIED_FIBER: FiberClassification = {
  source: null,
  ownership: 'unknown',
  isLibrary: false,
}

export function clearSourceCache(): void {
  cacheGeneration += 1
  generationFetch = boundFetch()
  cache.clear()
  pendingSource.clear()
  metroFrameCache.clear()
  rawSourceCache.clear()
  pendingMetroFrame.clear()
  warmupQueue = []
  activeWarmup = null
}

/** Fiber → JSX usage site or definition fallback. Symbolication is async; only successes are cached so a transient null can recover. */
export async function resolveSource(fiber: Fiber): Promise<ResolvedSource | null> {
  const generation = cacheGeneration
  const id = getFiberId(fiber)
  const cached = cache.get(id)
  if (cached) return cached
  const pending = pendingSource.get(id)
  if (pending) return pending

  let lookup!: Promise<ResolvedSource | null>
  lookup = (async () => {
    try {
      const target = getLatestFiber(fiber) ?? fiber
      const source = (await safeFiberSource(target)) ?? (await safeOwnedDefinitionSource(target))
      if (generation !== cacheGeneration) return null
      if (!source?.fileName) return null
      let resolved = await resolveCapturedSource(source, generation)
      if (!resolved || generation !== cacheGeneration) return null
      resolved = await verifyCallsiteLine(resolved, source, target)
      if (generation !== cacheGeneration) return null
      let cacheable = sourceOwnershipForSource(resolved) !== 'unknown'

      // A React 19 child-owner edge can recover an app body frame from a framework-owned usage frame without invoking user code.
      if (sourceOwnershipForSource(resolved) === 'library') {
        try {
          const ownedDefinition = await safeOwnedDefinitionSource(target)
          const ownedSource = ownedDefinition
            ? await resolveCapturedSource(ownedDefinition, generation)
            : null
          const ownedOwnership = sourceOwnershipForSource(ownedSource)
          if (ownedOwnership === 'app' && ownedSource) {
            resolved = ownedSource
          } else if (ownedDefinition && ownedOwnership === 'unknown') {
            cacheable = false
          }
        } catch {
          // Definition recovery is optional; retain the already-resolved usage frame.
          cacheable = false
        }
      }
      if (generation !== cacheGeneration) return null
      if (cacheable) cache.set(id, resolved)
      return resolved
    } catch {
      return null
    } finally {
      if (pendingSource.get(id) === lookup) pendingSource.delete(id)
    }
  })()
  pendingSource.set(id, lookup)
  return lookup
}

async function resolveCapturedSource(
  source: SafeFiberSource,
  generation: number,
): Promise<ResolvedSource | null> {
  const servedFile = normalizeServedFileName(source.fileName)
  // A frame symbolicated already carries original coordinates; running them through a map again would treat them as generated ones.
  const original =
    source.sourceMapConfidence === 'mapped'
      ? { file: null, line: source.lineNumber ?? null, column: source.columnNumber ?? null }
      : await toOriginalPosition(
          source.fileName,
          source.lineNumber ?? null,
          source.columnNumber ?? null,
          generation,
        )
  if (generation !== cacheGeneration) return null
  const position = selectSourcePosition(
    servedFile,
    source.lineNumber ?? null,
    source.columnNumber ?? null,
    original,
  )
  return {
    ...position,
    functionName: source.functionName ?? null,
    sourceMapConfidence:
      source.sourceMapConfidence === 'mapped' ||
      (original.file !== null && position.file === original.file)
        ? 'mapped'
        : 'served',
    role: source.role,
  }
}

interface SafeFiberSource {
  fileName: string
  lineNumber?: number | null
  columnNumber?: number | null
  functionName?: string | null
  sourceMapConfidence?: 'mapped'
  role: SourceRole
  /** The module URL the frame ran in, before symbolication. */
  servedUrl?: string
}

/** Read only React-captured debug metadata; never use bippy's component re-invocation fallback. */
async function safeFiberSource(fiber: Fiber): Promise<SafeFiberSource | null> {
  const debugSource = dataPropertyValue(fiber, '_debugSource')
  if (isRecord(debugSource)) {
    const fileName = dataPropertyValue(debugSource, 'fileName')
    const lineNumber = dataPropertyValue(debugSource, 'lineNumber')
    const columnNumber = dataPropertyValue(debugSource, 'columnNumber')
    if (typeof fileName === 'string' && typeof lineNumber === 'number') {
      return {
        fileName,
        lineNumber,
        columnNumber: typeof columnNumber === 'number' ? columnNumber : null,
        functionName: null,
        role: 'element-callsite',
      }
    }
  }

  // React captures _debugStack where the element was created, so its first app frame is the JSX callsite.
  const frame = capturedDebugFrames(fiber).find((entry) => typeof entry.fileName === 'string')
  return frame ? symbolicateCapturedFrame(frame, 'element-callsite') : null
}

export function capturedDebugFrames(fiber: Fiber): ReturnType<typeof parseStack> {
  const debugStack = dataPropertyValue(fiber, '_debugStack')
  if (!(debugStack instanceof Error)) return []
  // Hermes exposes Error.stack lazily; this React-created Error is the only accessor read, so app-object reads stay descriptor-safe.
  let stack: unknown
  try {
    stack = debugStack.stack
  } catch {
    return []
  }
  if (typeof stack !== 'string') return []
  const trustedStack = formatOwnerStack(stack)
  return trustedStack ? parseStack(trustedStack) : []
}

async function symbolicateCapturedFrame(
  frame: ReturnType<typeof parseStack>[number],
  role: SourceRole,
): Promise<SafeFiberSource | null> {
  if (!frame.fileName) return null
  const symbolicated = METRO_BUNDLE_URL_RE.test(frame.fileName)
    ? undefined
    : await mapFrame(frame, frame.fileName)
  const resolved = symbolicated ?? frame
  const symbolicationChangedPosition =
    symbolicated?.fileName !== undefined &&
    (normalizeFileName(symbolicated.fileName) !== normalizeFileName(frame.fileName) ||
      symbolicated.lineNumber !== frame.lineNumber ||
      symbolicated.columnNumber !== frame.columnNumber)
  return resolved.fileName
    ? {
        fileName: resolved.fileName,
        lineNumber: resolved.lineNumber ?? null,
        columnNumber: resolved.columnNumber ?? null,
        functionName: resolved.functionName ?? null,
        ...(symbolicationChangedPosition ? { sourceMapConfidence: 'mapped' as const } : {}),
        role,
        servedUrl: frame.fileName,
      }
    : null
}

async function mapFrame(
  frame: ReturnType<typeof parseStack>[number],
  moduleUrl: string,
): Promise<ReturnType<typeof parseStack>[number] | undefined> {
  if (typeof frame.lineNumber !== 'number' || typeof frame.columnNumber !== 'number')
    return undefined
  const map = await sourceMapFor(moduleUrl)
  const original = map ? originalPositionFor(map, frame.lineNumber, frame.columnNumber) : null
  if (!original?.fileName) return undefined
  return {
    ...frame,
    fileName: resolveMapSource(original.fileName, moduleUrl),
    lineNumber: original.lineNumber,
    columnNumber: original.columnNumber,
    functionName: original.functionName ?? frame.functionName,
  }
}

/** bippy's map lookup takes and returns 0-based columns, while stack frames, `_debugSource` and hook sources count columns from 1. */
function originalPositionFor(
  map: SourceMap,
  line: number,
  column: number,
): { fileName?: string; lineNumber: number; columnNumber: number; functionName?: string } | null {
  const original = getSourceFromSourceMap(map, line, Math.max(0, column - 1))
  if (!original || typeof original.lineNumber !== 'number') return null
  return {
    ...original,
    lineNumber: original.lineNumber,
    columnNumber: (original.columnNumber ?? column - 1) + 1,
  }
}

async function safeOwnedDefinitionSource(fiber: Fiber): Promise<SafeFiberSource | null> {
  const callableName = stableCallableName(fiber.type)
  const componentName = callableName ?? getDisplayName(fiber.type)
  if (!componentName) return null
  const stack: Fiber[] = fiber.child ? [fiber.child] : []
  let visited = 0
  while (stack.length > 0 && visited < OWNED_DEFINITION_SCAN_LIMIT) {
    const child = stack.pop()
    if (!child) continue
    visited += 1
    if (child.sibling) stack.push(child.sibling)
    if (child.child) stack.push(child.child)
    const owner = dataPropertyValue(child, '_debugOwner')
    const alternate = fiber.alternate
    const ownedByAlternate = alternate !== null && alternate !== undefined && owner === alternate
    if (owner !== fiber && !ownedByAlternate) continue
    const frames = capturedDebugFrames(child)
    for (let index = frames.length - 1; index >= 0; index -= 1) {
      const frame = frames[index]
      if (
        !frame?.fileName ||
        !frameFunctionMatchesComponent(frame.functionName, componentName, callableName !== null)
      ) {
        continue
      }
      return symbolicateCapturedFrame(
        {
          ...frame,
          lineNumber: frame.enclosingLineNumber || frame.lineNumber,
          columnNumber: frame.enclosingColumnNumber || frame.columnNumber,
        },
        'component-body',
      )
    }
  }
  return null
}

// bippy returns a map's `sources` entry as written, often relative to the module (`App.jsx` for `/src/App.jsx`).
function resolveMapSource(source: string, moduleUrl: string): string {
  if (/^[a-z][\w+.-]*:/i.test(source) || source.startsWith('/')) return source
  try {
    return new URL(source, moduleUrl).toString()
  } catch {
    return source
  }
}

const rawSourceCache = new Map<string, Promise<string[] | null>>()

/** The dev server's copy of a file as it is on disk. Vite answers `?raw` with `export default "<text>"`; anything else is not a raw file and verifies nothing. */
function rawSourceLines(url: string): Promise<string[] | null> {
  let pending = rawSourceCache.get(url)
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetch(url)
        if (!response.ok) return null
        const literal = /^export default ("(?:[^"\\]|\\.)*");?\s*$/s.exec(
          await response.text(),
        )?.[1]
        const text: unknown = literal ? JSON.parse(literal) : null
        return typeof text === 'string' ? text.split('\n') : null
      } catch {
        return null
      }
    })()
    rawSourceCache.set(url, pending)
  }
  return pending
}

function rawSourceUrl(resolved: ResolvedSource, source: SafeFiberSource): string | null {
  if (source.servedUrl && /^https?:\/\//.test(source.servedUrl)) {
    if (normalizeServedFileName(source.servedUrl) !== resolved.file) return null
    const url = new URL(source.servedUrl)
    url.search = '?raw'
    url.hash = ''
    return url.toString()
  }
  const origin = typeof location === 'undefined' ? null : location.origin
  if (source.servedUrl || !resolved.file.startsWith('/') || !origin?.startsWith('http')) return null
  return `${origin}/@fs${resolved.file}?raw`
}

/** A plugin that transforms a file without a source map (StyleX's Vite plugin is one) shifts both the compiled JSX source and the map, so a callsite line is kept only when the file on disk shows the element there. */
async function verifyCallsiteLine(
  resolved: ResolvedSource,
  source: SafeFiberSource,
  fiber: Fiber,
): Promise<ResolvedSource> {
  if (resolved.role !== 'element-callsite' || resolved.line === null) return resolved
  const url = rawSourceUrl(resolved, source)
  const lines = url ? await rawSourceLines(url) : null
  if (!lines) return resolved
  const text = lines[resolved.line - 1] ?? ''
  if (elementNames(fiber).some((name) => text.includes(name))) return resolved
  return { ...resolved, line: null, column: null }
}

function elementNames(fiber: Fiber): string[] {
  const names = new Set<string>()
  for (const type of [fiber.elementType, fiber.type]) {
    if (typeof type !== 'function' && !isRecord(type)) continue
    for (const candidate of [
      type,
      dataPropertyValue(type, 'type'),
      dataPropertyValue(type, 'render'),
    ]) {
      const name =
        typeof candidate === 'function' || isRecord(candidate) ? getDisplayName(candidate) : null
      if (name) names.add(name)
    }
  }
  return [...names]
}

function stableCallableName(value: unknown): string | null {
  if (typeof value === 'function') {
    const name = dataPropertyValue(value, 'name')
    return typeof name === 'string' && name.length > 0 ? name : null
  }
  if (!isRecord(value)) return null
  const render = dataPropertyValue(value, 'render')
  if (typeof render !== 'function') return null
  const name = dataPropertyValue(render, 'name')
  return typeof name === 'string' && name.length > 0 ? name : null
}

function frameFunctionMatchesComponent(
  frameFunctionName: string | undefined,
  componentName: string,
  requireExact: boolean,
): boolean {
  if (!frameFunctionName) return false
  if (requireExact) return frameFunctionName === componentName
  const wrappedName = /^(?:Memo|ForwardRef)\((.+)\)$/.exec(componentName)?.[1]
  const candidates = wrappedName ? [componentName, wrappedName] : [componentName]
  return candidates.some(
    (candidate) => frameFunctionName === candidate || frameFunctionName.endsWith(`.${candidate}`),
  )
}

export function dataPropertyValue(value: object, key: PropertyKey): unknown {
  const descriptor = safeOwnPropertyDescriptor(value, key)
  return isDataDescriptor(descriptor) ? descriptor.value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** A file outside the project tree is a library. Turbopack can expose app fibers as unmapped dev chunks, and an unsymbolicated Metro bundle entry names the whole app; neither carries attribution, so neither is evidence of a library. */
export function isLibraryFile(file: string): boolean {
  if (isOpaqueBundlerFile(file)) return false
  return !isSourceFile(file)
}

export function sourceOwnershipForSource(source: ResolvedSource | null): SourceOwnership {
  if (!source || isOpaqueBundlerFile(source.file)) return 'unknown'
  return isLibraryFile(source.file) ? 'library' : 'app'
}

function isOpaqueBundlerFile(file: string): boolean {
  const normalized = file.replaceAll('\\', '/')
  return normalized.includes('/.next/dev/server/chunks/') || METRO_BUNDLE_PATH_RE.test(normalized)
}

function classificationForSource(source: ResolvedSource | null): FiberClassification {
  const ownership = sourceOwnershipForSource(source)
  return { source, ownership, isLibrary: ownership === 'library' }
}

/** Ownership requires source evidence associated with this fiber; an ancestor's source cannot establish it. */
export async function classifyFiber(fiber: Fiber): Promise<FiberClassification> {
  const generation = cacheGeneration
  const source = await resolveSource(fiber)
  return generation === cacheGeneration ? classificationForSource(source) : UNCLASSIFIED_FIBER
}

export async function classifyFiberBeforeDeadline(
  fiber: Fiber,
  timeoutMs: number,
): Promise<FiberClassification | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      classifyFiber(fiber),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), Math.max(1, timeoutMs))
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Cache-only classification from source previously resolved for this fiber; null when unknown. */
export function classifyFiberFromCache(fiber: Fiber): FiberClassification | null {
  const cached = cache.get(getFiberId(fiber))
  return cached ? classificationForSource(cached) : null
}

// Cache hits are free and bypass the budget, so repeated reads warm the whole set ~limit fibers per call until partial goes false; only network-bound resolutions spend limit/budgetMs.
export async function classifyFibersWithinBudget(
  fibers: Fiber[],
  options: { limit?: number; budgetMs?: number } = {},
): Promise<{ classes: FiberClassification[]; evaluated: boolean[]; partial: boolean }> {
  const classes = fibers.map(() => UNCLASSIFIED_FIBER)
  const evaluated = fibers.map(() => false)
  const startedAt = Date.now()
  const limit = options.limit ?? DEFAULT_CLASSIFY_LIMIT
  // While the off-call warmer is draining, the call keeps only a token budget: return fast and partial instead of re-spending the full budget the warmer will cover anyway.
  const budgetMs =
    activeWarmup !== null
      ? WARMING_CALL_BUDGET_MS
      : (options.budgetMs ?? DEFAULT_CLASSIFY_BUDGET_MS)
  let resolved = 0
  let partial = false

  for (let index = 0; index < fibers.length; index += 1) {
    const fiber = fibers[index]
    if (!fiber) continue
    const fromCache = classifyFiberFromCache(fiber)
    if (fromCache) {
      classes[index] = fromCache
      evaluated[index] = true
      continue
    }
    const remaining = budgetMs - (Date.now() - startedAt)
    if (resolved >= limit || remaining <= 0) {
      partial = true
      continue
    }
    resolved += 1
    const result = await classifyFiberBeforeDeadline(fiber, remaining)
    if (result === null) {
      partial = true
      continue
    }
    classes[index] = result
    evaluated[index] = true
  }

  return { classes, evaluated, partial }
}

const WARMUP_CHUNK = 24
const WARMUP_GAP_MS = 50
const WARMING_CALL_BUDGET_MS = 100

let warmupQueue: Fiber[] = []
interface WarmupRun {
  generation: number
}

let activeWarmup: WarmupRun | null = null

/** Continue classifying a partial read's leftovers off the call path, in small paced chunks, so repeated reads stop paying the in-call budget once the set warms. */
export function scheduleClassificationWarmup(fibers: Fiber[]): void {
  const generation = cacheGeneration
  warmupQueue = fibers.filter((fiber) => !cache.has(getFiberId(fiber)))
  if (activeWarmup?.generation === generation || warmupQueue.length === 0) return
  const run: WarmupRun = { generation }
  activeWarmup = run
  void (async () => {
    try {
      while (activeWarmup === run && run.generation === cacheGeneration && warmupQueue.length > 0) {
        const chunk = warmupQueue.splice(0, WARMUP_CHUNK)
        await Promise.all(chunk.map((fiber) => classifyFiber(fiber).catch(() => null)))
        if (activeWarmup !== run || run.generation !== cacheGeneration) break
        await new Promise((resolve) => setTimeout(resolve, WARMUP_GAP_MS))
      }
    } finally {
      if (activeWarmup === run) activeWarmup = null
    }
  })()
}

/** A stable display identity for an otherwise-anonymous fiber, e.g. `cmdk.js:1998`. */
export function sourceLabel(source: ResolvedSource | null): string | null {
  if (!source) return null
  const base = source.file.split('/').pop() || source.file
  return source.line != null ? `${base}:${source.line}` : base
}

/** Bippy does not expose which source fallback won, so never label this as a definition site. */
export function sourceAttributionForSource(source: ResolvedSource | null): SourceAttribution {
  if (!source) return { role: 'unavailable', evidence: 'unknown' }
  return { role: 'usage-or-definition-fallback', evidence: 'inferred' }
}

/** Split provenance fields stay null unless that exact role is observable; the legacy source is retained only as an explicitly ambiguous fallback. */
export function sourceProvenanceForSource(
  source: ResolvedSource | null,
  exact: Partial<
    Pick<
      SourceProvenance,
      'definitionSource' | 'allocationCallsite' | 'hookDefinitionOwner' | 'hookCallsite'
    >
  > = {},
): SourceProvenance {
  const allocationCallsite =
    exact.allocationCallsite ?? (source?.role === 'element-callsite' ? source : null)
  const roleSource =
    exact.hookCallsite ??
    exact.hookDefinitionOwner ??
    allocationCallsite ??
    exact.definitionSource ??
    source
  const hasExactRole =
    allocationCallsite !== null || Object.values(exact).some((value) => value != null)
  return {
    definitionSource: exact.definitionSource ?? null,
    allocationCallsite,
    hookDefinitionOwner: exact.hookDefinitionOwner ?? null,
    hookCallsite: exact.hookCallsite ?? null,
    package:
      sourceOwnershipForSource(roleSource) === 'library' && roleSource
        ? packageNameFromFile(roleSource.file)
        : null,
    sourceMapConfidence: roleSource?.sourceMapConfidence ?? (roleSource ? 'served' : 'unknown'),
    failureReason: hasExactRole
      ? null
      : source
        ? 'definition-and-allocation-not-distinguished'
        : 'source-unresolved',
    usageOrDefinitionFallback: source,
  }
}

export function packageNameFromFile(file: string): string | null {
  const normalized = file.replaceAll('\\', '/')
  const marker = '/node_modules/'
  const index = normalized.lastIndexOf(marker)
  if (index === -1) return null
  const segments = normalized
    .slice(index + marker.length)
    .split('/')
    .filter(Boolean)
  if (segments[0] === '.pnpm') {
    const nestedIndex = segments.lastIndexOf('node_modules')
    if (nestedIndex >= 0) segments.splice(0, nestedIndex + 1)
  }
  const first = segments[0]
  if (!first) return null
  return first.startsWith('@') && segments[1] ? `${first}/${segments[1]}` : first
}

const EFFECT_HOOK_NAMES = new Set(['Effect', 'LayoutEffect', 'InsertionEffect'])
const EXTERNAL_STORE_HOOK_NAMES = new Set(['SyncExternalStore'])
const HOOK_ANCESTRY_LIMIT = 12
const HOOK_NODE_LIMIT = 1_000
const HOOK_CALLSITE_LIMIT = 100

interface PrimitiveCallsiteNode {
  source: HookSource | null
  hookAncestry: { name: string; source: HookSource | null }[]
}

interface PrimitiveCallsiteCollection {
  callsites: PrimitiveCallsiteNode[]
  truncated: boolean
}

interface HookTreeFrame {
  nodes: HooksNode[]
  index: number
  ancestry: PrimitiveCallsiteNode['hookAncestry']
}

function collectPrimitiveCallSites(
  nodes: HooksNode[],
  names: ReadonlySet<string>,
): PrimitiveCallsiteCollection {
  const callsites: PrimitiveCallsiteNode[] = []
  const stack: HookTreeFrame[] = [{ nodes, index: 0, ancestry: [] }]
  let visited = 0

  while (stack.length > 0) {
    const frame = stack.at(-1)
    if (!frame) break
    if (frame.index >= frame.nodes.length) {
      stack.pop()
      continue
    }
    if (visited >= HOOK_NODE_LIMIT) return { callsites, truncated: true }

    const node = frame.nodes[frame.index]
    frame.index += 1
    if (!node) continue
    visited += 1
    if (names.has(node.name)) {
      if (callsites.length >= HOOK_CALLSITE_LIMIT) return { callsites, truncated: true }
      callsites.push({
        source: node.hookSource,
        hookAncestry: frame.ancestry.slice(-HOOK_ANCESTRY_LIMIT),
      })
      continue
    }
    if (node.subHooks.length === 0) continue
    stack.push({
      nodes: node.subHooks,
      index: 0,
      ancestry: [...frame.ancestry, { name: node.name, source: node.hookSource }].slice(
        -HOOK_ANCESTRY_LIMIT,
      ),
    })
  }

  return { callsites, truncated: false }
}

function withoutComponentRoot(
  ancestry: PrimitiveCallsiteNode['hookAncestry'],
  fiber: Fiber,
): PrimitiveCallsiteNode['hookAncestry'] {
  const componentName = getDisplayName(fiber.type)
  return componentName && ancestry[0]?.name === componentName ? ancestry.slice(1) : ancestry
}

interface MappedPosition {
  file: string
  line: number
  column: number
}

const METRO_BUNDLE_PATH_RE = /\.(?:js)?bundle$/
const METRO_BUNDLE_URL_RE = /^(https?:\/\/[^/?#]+)\/[^?#]*\.(?:js)?bundle(?=\/\/&|[?#]|$)/
const NATIVE_METRO_BUNDLE_PARAMS_RE = /(\.(?:js)?bundle)\/\/&.*$/i
const METRO_SYMBOLICATE_TIMEOUT_MS = 1_000
const metroFrameCache = new Map<string, MappedPosition>()
const pendingMetroFrame = new Map<string, Promise<MappedPosition | null>>()

function normalizeServedFileName(file: string): string {
  return normalizeFileName(file).replaceAll('\\', '/').replace(NATIVE_METRO_BUNDLE_PARAMS_RE, '$1')
}

/** Metro's dev bundle and its source map are both far too large to pull into the app, so ask the dev server the way LogBox does. Only successes are cached, so a transient failure can recover. */
async function metroOriginalPosition(
  origin: string,
  servedUrl: string,
  line: number,
  column: number,
  generation: number,
): Promise<MappedPosition | null> {
  const key = `${servedUrl}|${line}|${column}`
  const cached = metroFrameCache.get(key)
  if (cached) return cached
  const pending = pendingMetroFrame.get(key)
  if (pending) return pending

  let lookup!: Promise<MappedPosition | null>
  lookup = (async () => {
    try {
      const mapped = await symbolicateMetroFrame(origin, servedUrl, line, column)
      if (mapped && generation === cacheGeneration) metroFrameCache.set(key, mapped)
      return mapped
    } finally {
      if (pendingMetroFrame.get(key) === lookup) pendingMetroFrame.delete(key)
    }
  })()
  pendingMetroFrame.set(key, lookup)
  return lookup
}

async function symbolicateMetroFrame(
  origin: string,
  servedUrl: string,
  line: number,
  column: number,
): Promise<MappedPosition | null> {
  const controller = typeof AbortController === 'undefined' ? null : new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const response = await Promise.race([
      fetch(`${origin}/symbolicate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stack: [{ file: servedUrl, lineNumber: line, column }] }),
        ...(controller ? { signal: controller.signal } : {}),
      }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          controller?.abort()
          resolve(null)
        }, METRO_SYMBOLICATE_TIMEOUT_MS)
      }),
    ])
    if (!response) return null
    const payload: unknown = response.ok ? await response.json() : null
    const frame = isRecord(payload) && Array.isArray(payload.stack) ? payload.stack[0] : null
    if (!isRecord(frame) || typeof frame.file !== 'string') return null
    if (typeof frame.lineNumber !== 'number') return null
    // Metro echoes the bundle entry back when it cannot map the frame.
    const file = normalizeServedFileName(frame.file)
    if (!file || METRO_BUNDLE_PATH_RE.test(file)) return null
    return {
      file,
      line: frame.lineNumber,
      column: typeof frame.column === 'number' ? frame.column : column,
    }
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// Maps a served line/column to the original; returns the input unchanged when no map exists, so callers keep a served-coordinate fallback.
async function toOriginalPosition(
  servedUrl: string,
  line: number | null,
  column: number | null,
  generation = cacheGeneration,
): Promise<{ file: string | null; line: number | null; column: number | null }> {
  if (typeof line !== 'number' || typeof column !== 'number') return { file: null, line, column }
  const metroOrigin = METRO_BUNDLE_URL_RE.exec(servedUrl)?.[1]
  if (metroOrigin) {
    const mapped = await metroOriginalPosition(metroOrigin, servedUrl, line, column, generation)
    return mapped ?? { file: null, line, column }
  }
  // Resolves both shapes: Vite's inline data-URI map and Next/Turbopack's external sourceMappingURL.
  const map = await sourceMapFor(servedUrl)
  const original = map ? originalPositionFor(map, line, column) : null
  if (original) {
    return {
      file: original.fileName
        ? normalizeFileName(resolveMapSource(original.fileName, servedUrl))
        : null,
      line: original.lineNumber,
      column: original.columnNumber,
    }
  }
  return { file: null, line, column }
}

const PAGE_LOADABLE_SCHEMES = new Set(['http', 'https', 'data', 'blob'])
const URL_SCHEME = /^([a-z][\w+.-]*):/i

/** Whether the page itself can fetch this URL; a path without a scheme resolves against the page. Next.js names server-component frames `about://React/Server/file:///…` and server chunks `file:///…`; fetching those is refused, and every refusal is a console error in the developer's app. */
export function isPageLoadableUrl(url: string): boolean {
  const scheme = URL_SCHEME.exec(url)?.[1]?.toLowerCase()
  return scheme === undefined || PAGE_LOADABLE_SCHEMES.has(scheme)
}

const NOT_LOADABLE = (): Promise<Response> =>
  Promise.resolve(new Response(null, { status: 404, statusText: 'not loadable from the page' }))
const REACT_SERVER_FRAME = /^about:\/\/React\/Server\/(.+?)(?:\?\d+)?$/
const NEXT_STATIC_SEGMENT = '/_next/static/'

/** The URL Next.js's dev server answers with a server chunk's source map: the endpoint its own client hands React as `findSourceMapURL`. The page's `/_next/static/` scripts prove it is a Next.js page and carry its basePath; without them there is no endpoint to ask. */
function nextServerSourceMapUrl(frameUrl: string): string | null {
  const filename =
    REACT_SERVER_FRAME.exec(frameUrl)?.[1] ?? (frameUrl.startsWith('file://') ? frameUrl : null)
  if (filename === null || typeof document === 'undefined') return null
  const script = document.querySelector<HTMLScriptElement>(`script[src*="${NEXT_STATIC_SEGMENT}"]`)
  if (!script) return null
  const page = new URL(script.src, document.baseURI)
  const basePath = page.pathname.slice(0, page.pathname.indexOf(NEXT_STATIC_SEGMENT))
  const url = new URL(`${basePath}/__nextjs_source-map`, page.origin)
  url.searchParams.set('filename', filename)
  return url.href
}

/** A server-component frame cannot be fetched, but Next.js serves its map from the page's own origin. It answers as a stub module carrying that map inline, since bippy follows no external map from a module whose URL is not http(s). */
async function unloadableFrame(url: string): Promise<Response> {
  const endpoint = nextServerSourceMapUrl(url)
  if (endpoint === null) return NOT_LOADABLE()
  const map = await fetch(endpoint)
  if (!map.ok) return NOT_LOADABLE()
  const inline = `data:application/json;base64,${base64(await map.text())}`
  return new Response(`//# sourceMappingURL=${inline}\n`, { status: 200 })
}

const BASE64_CHUNK = 0x8000

function base64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK))
  return btoa(binary)
}

// Bippy keys its map cache weakly by `fetchFn`, so a fresh function per generation is how `clearSourceCache` drops maps for rebuilt modules. An unloadable URL answers a 404 instead of a rejection, which bippy would treat as transient and retry on every lookup.
function boundFetch(): SourceFetch {
  return (url, init) => (isPageLoadableUrl(url) ? fetch(url, init) : unloadableFrame(url))
}

let generationFetch: SourceFetch = boundFetch()

// Guards a synchronous throw as well as a rejection, so a hostile bundle can't break classification.
export async function sourceMapFor(url: string): Promise<SourceMap | null> {
  try {
    return await getSourceMap(url, true, generationFetch)
  } catch {
    return null
  }
}

// Classification prefers the served URL; the map's original file is trusted only when the served URL is an opaque bundle chunk (Next/Turbopack) AND the original classifies as app source — so a dep bundled into an app chunk stays library. A Metro bundle entry is the sole exception: it names the whole app, so any symbolicated path beats it, library ones included.
async function resolveHookSource(
  hook: HookSource | null,
  generation: number,
): Promise<ResolvedSource | null> {
  try {
    if (!hook?.fileName || generation !== cacheGeneration) return null
    const served = normalizeServedFileName(hook.fileName)
    if (!served) return null
    const original = await toOriginalPosition(
      hook.fileName,
      hook.lineNumber ?? null,
      hook.columnNumber ?? null,
      generation,
    )
    if (generation !== cacheGeneration) return null
    return {
      ...selectSourcePosition(served, hook.lineNumber ?? null, hook.columnNumber ?? null, original),
      functionName: hook.functionName ?? null,
      sourceMapConfidence:
        original.file !== null &&
        selectSourcePosition(served, hook.lineNumber ?? null, hook.columnNumber ?? null, original)
          .file === original.file
          ? 'mapped'
          : 'served',
    }
  } catch {
    return null
  }
}

/** File and coordinates are one unit: never pair a rejected source-map file with its line. */
function selectSourcePosition(
  servedFile: string,
  servedLine: number | null,
  servedColumn: number | null,
  original: { file: string | null; line: number | null; column: number | null },
): Pick<ResolvedSource, 'file' | 'line' | 'column'> {
  if (
    original.file !== null &&
    (isSourceFile(original.file) || METRO_BUNDLE_PATH_RE.test(servedFile)) &&
    (!isSourceFile(servedFile) || isAppBundleEntry(servedFile))
  ) {
    return { file: original.file, line: original.line, column: original.column }
  }
  return { file: servedFile, line: servedLine, column: servedColumn }
}

function isAppBundleEntry(file: string): boolean {
  return /\/(?:assets|static)\/[^/]+\.(?:js|mjs|cjs)$/i.test(file)
}

/** Resolve a supplied hook tree only. Automatic reports omit `inspectedHooks` because obtaining it with bippy would re-run the application component. */
export async function resolveEffectSources(
  fiber: Fiber,
  inspectedHooks?: HooksNode[] | null,
): Promise<(ResolvedSource | null)[] | null> {
  const resolution = await resolveEffectSourceResolution(fiber, inspectedHooks)
  return resolution.sources
}

/** `undefined` means automatic shadow rendering is disabled; `null` means an explicit inspector failed. */
export async function resolveEffectSourceResolution(
  fiber: Fiber,
  inspectedHooks?: HooksNode[] | null,
): Promise<EffectSourceResolution> {
  if (inspectedHooks === undefined) {
    return { status: 'shadow-render-disabled', sources: null, callsites: null }
  }
  if (inspectedHooks === null) {
    return { status: 'inspection-unavailable', sources: null, callsites: null }
  }

  const generation = cacheGeneration
  const target = getLatestFiber(fiber) ?? fiber
  let collection: PrimitiveCallsiteCollection
  try {
    collection = collectPrimitiveCallSites(inspectedHooks, EFFECT_HOOK_NAMES)
  } catch {
    return { status: 'inspection-unavailable', sources: null, callsites: null }
  }
  if (collection.truncated) {
    return { status: 'inspection-truncated', sources: null, callsites: null }
  }
  if (collection.callsites.length === 0) {
    return { status: 'no-user-effects', sources: [], callsites: [] }
  }

  const resolved = await Promise.all(
    collection.callsites.map(
      async (callsite): Promise<ResolvedEffectCallsite> => ({
        source: await resolveHookSource(callsite.source, generation),
        hookAncestry: await Promise.all(
          withoutComponentRoot(callsite.hookAncestry, target).map(async (frame) => ({
            name: frame.name,
            source: await resolveHookSource(frame.source, generation),
          })),
        ),
      }),
    ),
  )
  if (generation !== cacheGeneration) {
    return { status: 'report-state-advanced', sources: null, callsites: null }
  }
  return {
    status: 'resolved',
    sources: resolved.map((callsite) => callsite.source),
    callsites: resolved,
  }
}

export async function resolveEffectSourcesBeforeDeadline(
  fiber: Fiber,
  timeoutMs: number,
  inspectedHooks?: HooksNode[] | null,
): Promise<(ResolvedSource | null)[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      resolveEffectSources(fiber, inspectedHooks),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), Math.max(1, timeoutMs))
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function resolveEffectSourceResolutionBeforeDeadline(
  fiber: Fiber,
  timeoutMs: number,
  inspectedHooks?: HooksNode[] | null,
): Promise<EffectSourceResolution> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      resolveEffectSourceResolution(fiber, inspectedHooks),
      new Promise<EffectSourceResolution>((resolve) => {
        timer = setTimeout(
          () => resolve({ status: 'deadline-exceeded', sources: null, callsites: null }),
          Math.max(1, timeoutMs),
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Resolve a supplied hook tree only; automatic reports return `shadow-render-disabled`. */
export async function resolveExternalStoreSourceResolution(
  fiber: Fiber,
  inspectedHooks?: HooksNode[] | null,
): Promise<ExternalStoreSourceResolution> {
  if (inspectedHooks === undefined) return { status: 'shadow-render-disabled', hooks: null }
  if (inspectedHooks === null) return { status: 'inspection-unavailable', hooks: null }

  const generation = cacheGeneration
  const target = getLatestFiber(fiber) ?? fiber
  let collection: PrimitiveCallsiteCollection
  try {
    collection = collectPrimitiveCallSites(inspectedHooks, EXTERNAL_STORE_HOOK_NAMES)
  } catch {
    return { status: 'inspection-unavailable', hooks: null }
  }
  if (collection.truncated) return { status: 'inspection-truncated', hooks: null }
  if (collection.callsites.length === 0) return { status: 'no-external-stores', hooks: [] }

  const resolved = await Promise.all(
    collection.callsites.map(async (entry): Promise<ResolvedExternalStoreCallsite> => {
      const primitiveSource = await resolveHookSource(entry.source, generation)
      const hookAncestry = await Promise.all(
        withoutComponentRoot(entry.hookAncestry, target).map(async (frame) => ({
          name: frame.name,
          source: await resolveHookSource(frame.source, generation),
        })),
      )
      return {
        callsite:
          hookAncestry.find((frame) => sourceOwnershipForSource(frame.source) === 'app')?.source ??
          hookAncestry.find((frame) => frame.source !== null)?.source ??
          primitiveSource,
        primitiveSource,
        hookAncestry,
      }
    }),
  )
  if (generation !== cacheGeneration) return { status: 'report-state-advanced', hooks: null }
  return { status: 'resolved', hooks: resolved }
}

export async function resolveExternalStoreSourceResolutionBeforeDeadline(
  fiber: Fiber,
  timeoutMs: number,
  inspectedHooks?: HooksNode[] | null,
): Promise<ExternalStoreSourceResolution> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      resolveExternalStoreSourceResolution(fiber, inspectedHooks),
      new Promise<ExternalStoreSourceResolution>((resolve) => {
        timer = setTimeout(
          () => resolve({ status: 'deadline-exceeded', hooks: null }),
          Math.max(1, timeoutMs),
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function ownershipCoverage(ownership: readonly SourceOwnership[]) {
  const counts = { app: 0, library: 0, unknown: 0 }
  for (const value of ownership) counts[value] += 1
  return { complete: counts.unknown === 0, totalCandidates: ownership.length, ...counts }
}
