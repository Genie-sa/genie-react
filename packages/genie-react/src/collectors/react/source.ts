import {
  type Fiber,
  getDisplayName,
  getFiberId,
  getLatestFiber,
  getReactWorkTagsForFiber,
} from 'bippy'
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
import { genieFetch } from '../genie-fetch'

/** What a component source points at: where its element was created (`<Card />` in the parent), or a line inside the component's own body. */
export type SourceRole = 'element-callsite' | 'component-body' | 'hook-callsite'

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
  /** Where the component's own code lives, when its rendered children reveal it. */
  definition?: ResolvedSource
  /** The evidence ownership rests on; absent when ownership is unknown. */
  ownershipBasis?: OwnershipBasis
  /** The JSX tag the verified callsite wrote, such as `Link`, kept only for a component React knows no name for. */
  elementName?: string
}

export type SourceOwnership = 'app' | 'library' | 'unknown'

/** component-definition: a frame in the component's own body. owned-elements: all its elements came from app source (React 18) or all from library code. element-callsite: created inside library code, or a boundary such as Suspense. */
export type OwnershipBasis = 'component-definition' | 'owned-elements' | 'element-callsite'

export type SourceAttribution =
  | { role: 'usage-or-definition-fallback'; evidence: 'inferred' }
  | { role: 'unavailable'; evidence: 'unknown' }

export interface ResolvedHookAncestryFrame {
  name: string
  source: ResolvedSource | null
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

const cache = new Map<number, FiberClassification>()
const pendingClassification = new Map<number, Promise<FiberClassification>>()
let definitionsByType = new WeakMap<object, DefinitionConclusion>()
/** Unknown ownership backed by a resolved app callsite holds until the component renders different children. */
let settledUnknownByFiber = new WeakMap<
  Fiber,
  { child: Fiber | null; classification: FiberClassification }
>()
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
  pendingClassification.clear()
  definitionsByType = new WeakMap()
  settledUnknownByFiber = new WeakMap()
  metroFrameCache.clear()
  rawSourceCache.clear()
  pageScriptTexts.clear()
  pendingMetroFrame.clear()
  warmupQueue = []
  activeWarmup = null
}

/** Fiber → JSX usage site or definition fallback. Symbolication is async; only successes are cached so a transient null can recover. */
export async function resolveSource(fiber: Fiber): Promise<ResolvedSource | null> {
  return (await classifyFiber(fiber)).source
}

/** What a component's own code reveals about where it lives: the elements a component creates describe the component, while the element that renders it describes its parent. */
type DefinitionConclusion =
  | { ownership: 'app' | 'library'; basis: OwnershipBasis; source: ResolvedSource | null }
  | { ownership: 'unknown'; transient?: true }

const NO_DEFINITION: DefinitionConclusion = { ownership: 'unknown' }
/** Evidence existed but could not be symbolicated yet, so the conclusion may change on retry. */
const UNRESOLVED_DEFINITION: DefinitionConclusion = { ownership: 'unknown', transient: true }

interface ClassificationLookup {
  classification: FiberClassification
  settled: boolean
}

async function lookupClassification(
  target: Fiber,
  generation: number,
): Promise<ClassificationLookup> {
  // A boundary such as Suspense (a symbol type) has no code of its own: whoever wrote the element owns it.
  if (typeof target.type === 'symbol') {
    const { source } = await resolveCallsite(target, generation)
    return { classification: classifyBoundaryElement(source), settled: true }
  }
  const [{ source, elementName }, definition] = await Promise.all([
    resolveCallsite(target, generation),
    definitionOf(memoWrappedFiber(target) ?? target, generation),
  ])
  return {
    classification: {
      ...combineEvidence(source, definition),
      ...(elementName ? { elementName } : {}),
    },
    settled: !(definition.ownership === 'unknown' && definition.transient),
  }
}

/** `memo(forwardRef(...))` renders the component it wraps as its own child fiber, and that child's code is the only code the wrapper has. */
function memoWrappedFiber(fiber: Fiber): Fiber | null {
  if (fiber.tag !== getReactWorkTagsForFiber(fiber).MemoComponent || !isRecord(fiber.type)) {
    return null
  }
  const wrapped = dataPropertyValue(fiber.type, 'type')
  const child = fiber.child
  return child && wrapped !== undefined && child.elementType === wrapped ? child : null
}

function classifyBoundaryElement(callsite: ResolvedSource | null): FiberClassification {
  const ownership = sourceOwnershipForSource(callsite)
  return {
    source: callsite,
    ownership,
    isLibrary: ownership === 'library',
    ...(ownership === 'unknown' ? {} : { ownershipBasis: 'element-callsite' as const }),
  }
}

function combineEvidence(
  callsite: ResolvedSource | null,
  definition: DefinitionConclusion,
): FiberClassification {
  const callsiteOwnership = sourceOwnershipForSource(callsite)
  const definitionSource = definition.ownership === 'unknown' ? null : definition.source
  const source = callsite && callsiteOwnership === 'app' ? callsite : (definitionSource ?? callsite)
  const evidence = definitionSource ? { definition: definitionSource } : {}
  if (definition.ownership !== 'unknown') {
    return {
      source,
      ownership: definition.ownership,
      isLibrary: definition.ownership === 'library',
      ...evidence,
      ownershipBasis: definition.basis,
    }
  }
  // An element created inside library code is the library's own child unless the component's code says otherwise; one created in app code says nothing about the component it names.
  if (callsiteOwnership === 'library') {
    return {
      source,
      ownership: 'library',
      isLibrary: true,
      ...evidence,
      ownershipBasis: 'element-callsite',
    }
  }
  return { source, ownership: 'unknown', isLibrary: false, ...evidence }
}

interface ResolvedCallsite {
  source: ResolvedSource | null
  elementName?: string
}

async function resolveCallsite(fiber: Fiber, generation: number): Promise<ResolvedCallsite> {
  const source = await safeFiberSource(fiber)
  if (!source?.fileName || generation !== cacheGeneration) return { source: null }
  const resolved = await resolveCapturedSource(source, generation)
  if (!resolved || generation !== cacheGeneration) return { source: null }
  return verifyCallsiteLine(resolved, source, fiber)
}

async function definitionOf(fiber: Fiber, generation: number): Promise<DefinitionConclusion> {
  const type = componentTypeKey(fiber)
  const known = type ? definitionsByType.get(type) : undefined
  if (known) return known
  const evidence = ownedElementEvidence(fiber)
  const conclusion = await concludeDefinition(fiber, evidence, generation)
  if (type && conclusion.ownership !== 'unknown' && generation === cacheGeneration) {
    definitionsByType.set(type, conclusion)
  }
  return conclusion
}

function componentTypeKey(fiber: Fiber): object | null {
  const type: unknown = fiber.type
  return typeof type === 'function' || isRecord(type) ? type : null
}

async function concludeDefinition(
  fiber: Fiber,
  evidence: OwnedElementEvidence,
  generation: number,
): Promise<DefinitionConclusion> {
  if (evidence.bodyFrame) {
    const frame = await symbolicateCapturedFrame(evidence.bodyFrame, 'component-body')
    const source = frame ? await resolveCapturedSource(frame, generation) : null
    const ownership = sourceOwnershipForSource(source)
    if (source && ownership !== 'unknown') {
      return { ownership, basis: 'component-definition', source }
    }
    return UNRESOLVED_DEFINITION
  }
  if (evidence.debugSources.length > 0 && evidence.debugSources.length === evidence.owned) {
    const [first] = evidence.debugSources
    const source = first ? await resolveCapturedSource(first, generation) : null
    const ownership = sourceOwnershipForSource(source)
    if (source && ownership !== 'unknown') return { ownership, basis: 'owned-elements', source }
  }
  if (evidence.owned > 0 && evidence.withoutDebugInfo === evidence.owned) {
    return appCompilesElementSources(fiber)
      ? { ownership: 'library', basis: 'owned-elements', source: null }
      : NO_DEFINITION
  }
  if (evidence.withCreationStack > 0 && evidence.withCreationStack === evidence.owned) {
    return allCreatedByLibrary(evidence.creatorFrames, generation)
  }
  return NO_DEFINITION
}

async function allCreatedByLibrary(
  frames: readonly StackFrame[],
  generation: number,
): Promise<DefinitionConclusion> {
  for (const frame of frames) {
    const symbolicated = await symbolicateCapturedFrame(frame, 'element-callsite')
    const source = symbolicated ? await resolveCapturedSource(symbolicated, generation) : null
    if (sourceOwnershipForSource(source) !== 'library') return NO_DEFINITION
  }
  return { ownership: 'library', basis: 'owned-elements', source: null }
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
  const debugSource = debugSourceOf(fiber, 'element-callsite')
  if (debugSource) return debugSource
  // React captures _debugStack where the element was created, so its first app frame is the JSX callsite.
  const frame = capturedDebugFrames(fiber).find((entry) => typeof entry.fileName === 'string')
  return frame ? symbolicateCapturedFrame(frame, 'element-callsite') : null
}

function debugSourceOf(value: object, role: SourceRole): SafeFiberSource | null {
  const debugSource = dataPropertyValue(value, '_debugSource')
  if (!isRecord(debugSource)) return null
  const fileName = dataPropertyValue(debugSource, 'fileName')
  const lineNumber = dataPropertyValue(debugSource, 'lineNumber')
  const columnNumber = dataPropertyValue(debugSource, 'columnNumber')
  if (typeof fileName !== 'string' || typeof lineNumber !== 'number') return null
  return {
    fileName,
    lineNumber,
    columnNumber: typeof columnNumber === 'number' ? columnNumber : null,
    functionName: null,
    role,
  }
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
    (normalizeModuleFileName(symbolicated.fileName) !== normalizeModuleFileName(frame.fileName) ||
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

type StackFrame = ReturnType<typeof parseStack>[number]

interface OwnedElementEvidence {
  /** A frame of the component's own function, from an owned element's creation stack (React 19). */
  bodyFrame: StackFrame | null
  /** Owned elements carrying React 18 `_debugSource`, which names the file that created them. */
  debugSources: SafeFiberSource[]
  /** A sample of the frames that created owned elements, when no stack showed the component's own frame. */
  creatorFrames: StackFrame[]
  withCreationStack: number
  withoutDebugInfo: number
  owned: number
}

const CREATOR_FRAME_LIMIT = 8

/** Reads only React-captured metadata of the elements this component created; never re-invokes it. */
function ownedElementEvidence(fiber: Fiber): OwnedElementEvidence {
  const evidence: OwnedElementEvidence = {
    bodyFrame: null,
    debugSources: [],
    creatorFrames: [],
    withCreationStack: 0,
    withoutDebugInfo: 0,
    owned: 0,
  }
  const callableName = stableCallableName(fiber.type)
  const componentName = callableName ?? getDisplayName(fiber.type)
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
    evidence.owned += 1
    const frames = capturedDebugFrames(child)
    if (frames.length > 0) {
      const bodyFrame = componentName
        ? bodyFrameOf(frames, componentName, callableName !== null)
        : null
      if (bodyFrame) {
        evidence.bodyFrame = bodyFrame
        return evidence
      }
      const creator = frames.find((frame) => typeof frame.fileName === 'string')
      if (!creator) continue
      evidence.withCreationStack += 1
      if (evidence.creatorFrames.length < CREATOR_FRAME_LIMIT) evidence.creatorFrames.push(creator)
      continue
    }
    const debugSource = debugSourceOf(child, 'component-body')
    if (debugSource) evidence.debugSources.push(debugSource)
    else evidence.withoutDebugInfo += 1
  }
  return evidence
}

function bodyFrameOf(
  frames: readonly StackFrame[],
  componentName: string,
  requireExact: boolean,
): StackFrame | null {
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    const frame = frames[index]
    if (
      !frame?.fileName ||
      !frameFunctionMatchesComponent(frame.functionName, componentName, requireExact)
    ) {
      continue
    }
    return {
      ...frame,
      lineNumber: frame.enclosingLineNumber || frame.lineNumber,
      columnNumber: frame.enclosingColumnNumber || frame.columnNumber,
    }
  }
  return null
}

const SOURCE_COMPILATION_OWNER_LIMIT = 50

/** React 18 JSX dev transforms attach `_debugSource` to every element the app writes, so an owner chain that carries one shows the app is compiled that way and elements without one came from precompiled code. */
function appCompilesElementSources(fiber: Fiber): boolean {
  let current: unknown = fiber
  for (let depth = 0; depth < SOURCE_COMPILATION_OWNER_LIMIT && isRecord(current); depth += 1) {
    if (debugSourceOf(current, 'element-callsite')) return true
    current = dataPropertyValue(current, '_debugOwner')
  }
  return false
}

const WEBPACK_NAMESPACED_SOURCE_RE = /^webpack:\/\/[^/]*\/\.\//

// bippy returns a map's `sources` entry as written, often relative to the module (`App.jsx` for `/src/App.jsx`). webpack names a module `webpack://<namespace>/./src/a.ts`, relative to the project root as its served URL is.
function resolveMapSource(source: string, moduleUrl: string): string {
  if (WEBPACK_NAMESPACED_SOURCE_RE.test(source))
    return source.replace(WEBPACK_NAMESPACED_SOURCE_RE, '/')
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
        const response = await genieFetch(url)
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
): Promise<ResolvedCallsite> {
  if (resolved.role !== 'element-callsite' || resolved.line === null) return { source: resolved }
  const url = rawSourceUrl(resolved, source)
  const lines = url ? await rawSourceLines(url) : null
  if (!lines) return { source: resolved }
  const text = lines[resolved.line - 1] ?? ''
  const names = elementNames(fiber)
  if (names.some((name) => text.includes(name))) return { source: resolved }
  // A component with no runtime name is verified by the element the line opens at the mapped column, and that tag is the name the app calls it by.
  const elementName =
    names.length === 0 && resolved.column !== null
      ? JSX_ELEMENT_TAG.exec(text.slice(resolved.column - 1))?.[1]
      : undefined
  if (elementName) return { source: resolved, elementName }
  return { source: { ...resolved, line: null, column: null } }
}

const JSX_ELEMENT_TAG = /^<([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/

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
  // A class component's body is its render method.
  if (frameFunctionName === `${componentName}.render`) return true
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

/** A file outside the project tree is a library. Next.js serves app and dependency code alike from unmapped chunks, and an unsymbolicated Metro bundle entry names the whole app; neither carries attribution, so neither is evidence of a library. */
export function isLibraryFile(file: string): boolean {
  if (isOpaqueBundlerFile(file)) return false
  if (VITE_DEPENDENCY_CHUNK_RE.test(file.replaceAll('\\', '/'))) return true
  return !isSourceFile(file)
}

export function sourceOwnershipForSource(source: ResolvedSource | null): SourceOwnership {
  if (!source || isOpaqueBundlerFile(source.file)) return 'unknown'
  return isLibraryFile(source.file) ? 'library' : 'app'
}

function isOpaqueBundlerFile(file: string): boolean {
  const normalized = file.replaceAll('\\', '/')
  return (
    normalized.includes('/.next/dev/server/chunks/') ||
    normalized.includes('/_next/static/chunks/') ||
    METRO_BUNDLE_PATH_RE.test(normalized)
  )
}

/** Ownership requires evidence about this fiber's own component; an ancestor's source cannot establish it. */
export async function classifyFiber(fiber: Fiber): Promise<FiberClassification> {
  const generation = cacheGeneration
  const id = getFiberId(fiber)
  const cached = classifyFiberFromCache(fiber)
  if (cached) return cached
  const pending = pendingClassification.get(id)
  if (pending) return pending

  let lookup!: Promise<FiberClassification>
  lookup = (async () => {
    try {
      const target = getLatestFiber(fiber) ?? fiber
      const { classification, settled } = await lookupClassification(target, generation)
      if (generation !== cacheGeneration) return UNCLASSIFIED_FIBER
      if (!settled) return classification
      if (classification.ownership !== 'unknown') cache.set(id, classification)
      else if (sourceOwnershipForSource(classification.source) === 'app') {
        settledUnknownByFiber.set(target, { child: target.child, classification })
      }
      return classification
    } catch {
      return UNCLASSIFIED_FIBER
    } finally {
      if (pendingClassification.get(id) === lookup) pendingClassification.delete(id)
    }
  })()
  pendingClassification.set(id, lookup)
  return lookup
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
  if (cached) return cached
  const target = getLatestFiber(fiber) ?? fiber
  const settled = settledUnknownByFiber.get(target)
  return settled && settled.child === target.child ? settled.classification : null
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
  warmupQueue = fibers.filter((fiber) => classifyFiberFromCache(fiber) === null)
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

/** How a frame's position relates to the code on disk: translated by a source map, as the dev server served the module, or inside a build output file that no map explained. */
export type FrameMapping = 'mapped' | 'served' | 'unmapped-build-file'

export interface ResolvedStackFrame {
  functionName: string | null
  file: string | null
  line: number | null
  column: number | null
  isLibrary: boolean
  mapping: FrameMapping
}

const STACK_FRAME_RESOLVE_LIMIT = 20

/** Parses an Error stack and source-maps each frame where the served module carries a map; frames no map explains keep their served position and say so. Frames `isOwnFrame` claims are Genie's and are dropped before any lookup. */
export async function resolveStackFrames(
  stack: string,
  isOwnFrame: (frame: StackFrame) => boolean = () => false,
): Promise<ResolvedStackFrame[]> {
  let frames: ReturnType<typeof parseStack>
  try {
    frames = parseStack(stack)
  } catch {
    return []
  }
  return Promise.all(
    frames
      .filter((frame) => typeof frame.fileName === 'string' && frame.fileName.length > 0)
      .filter((frame) => !isOwnFrame(frame))
      .slice(0, STACK_FRAME_RESOLVE_LIMIT)
      .map(resolveStackFrame),
  )
}

/** One parsed frame, source-mapped when its served module carries a map. */
export async function resolveStackFrame(frame: StackFrame): Promise<ResolvedStackFrame> {
  const servedUrl = frame.fileName ?? ''
  const mapped = METRO_BUNDLE_URL_RE.test(servedUrl)
    ? undefined
    : await mapFrame(frame, servedUrl).catch(() => undefined)
  return stackFrameAt(mapped ?? frame, mapped !== undefined)
}

/** One parsed frame at the position the dev server served, without a source map lookup. */
export function servedStackFrame(frame: StackFrame): ResolvedStackFrame {
  return stackFrameAt(frame, false)
}

function stackFrameAt(frame: StackFrame, mapped: boolean): ResolvedStackFrame {
  const file = normalizeServedFileName(frame.fileName ?? '')
  return {
    functionName: frame.functionName ?? null,
    file,
    line: frame.lineNumber ?? null,
    column: frame.columnNumber ?? null,
    isLibrary: isLibraryFile(file),
    mapping: frameMappingOf(file, mapped),
  }
}

export function frameMappingOf(file: string, mapped: boolean): FrameMapping {
  if (mapped) return 'mapped'
  return isUnmappedBuildFile(file) ? 'unmapped-build-file' : 'served'
}

/** Build output a source map should have explained: Next.js server and client chunks, a Metro bundle, or a bundled asset entry. */
function isUnmappedBuildFile(file: string): boolean {
  const normalized = file.replaceAll('\\', '/')
  return (
    isOpaqueBundlerFile(normalized) ||
    /\/\.next\/(?:dev\/)?server\//.test(normalized) ||
    /\/_next\/static\//.test(normalized) ||
    isAppBundleEntry(normalized)
  )
}

/** A stable display identity for an otherwise-anonymous fiber, e.g. `cmdk.js:1998`. */
export function sourceLabel(source: ResolvedSource | null): string | null {
  if (!source) return null
  const base = source.file.split('/').pop() || source.file
  return source.line != null ? `${base}:${source.line}` : base
}

/** The name an otherwise-anonymous fiber is reported under: the JSX tag its callsite wrote, else its source label. */
export function unnamedComponentLabel(
  classification: Pick<FiberClassification, 'source' | 'elementName'>,
): string | null {
  return classification.elementName ?? sourceLabel(classification.source)
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
  const optimized = VITE_DEPENDENCY_CHUNK_RE.exec(normalized)
  if (optimized) {
    return packageNameFromOptimizedChunk(normalized.slice(optimized.index + optimized[0].length))
  }
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

/** A pre-bundled entry is named after its package (`@tanstack_react-query.js`); shared chunks carry a content hash (`modern-Du3lnq9_.js`, `chunk-ABC123.js`) and name no package. */
function packageNameFromOptimizedChunk(fileName: string): string | null {
  const base = fileName.split('/')[0]?.replace(/\.[cm]?js$/, '')
  if (!base || base.startsWith('chunk-') || /-[A-Za-z0-9_]{8}$/.test(base)) return null
  return base.startsWith('@') ? base.replace('_', '/') : base
}

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

/** Vite's dependency optimizer writes pre-bundled packages to `<cacheDir>/deps/`, and a cache dir inside the project (`./.vite`) is served at `/.vite/deps/`. */
const VITE_DEPENDENCY_CHUNK_RE = /\/\.vite\/deps(?:_[^/]*)?\//

function normalizeServedFileName(file: string): string {
  const served = file.replaceAll('\\', '/')
  // bippy drops a leading `/.vite`, which would leave a pre-bundled package looking like an app file.
  if (VITE_DEPENDENCY_CHUNK_RE.test(served)) {
    return served.replace(/^[a-z][\w+.-]*:\/\/[^/]+/i, '').replace(/[?#].*$/, '')
  }
  return normalizeModuleFileName(file)
    .replaceAll('\\', '/')
    .replace(NATIVE_METRO_BUNDLE_PARAMS_RE, '$1')
}

const HTTP_ORIGIN_RE = /^https?:\/\/[^/]+/i

/** bippy reads the first directory of a served URL as a deploy base when the next one is short, so `/src/lib/a.ts` became `/lib/a.ts`; a served path names the module as the dev server does. */
export function normalizeModuleFileName(file: string): string {
  return normalizeFileName(file.replace(HTTP_ORIGIN_RE, ''))
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
      genieFetch(`${origin}/symbolicate`, {
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
        ? normalizeModuleFileName(resolveMapSource(original.fileName, servedUrl))
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

/** A server-component frame or a webpack eval module cannot be fetched, but its map can be found from the page. It answers as a stub module carrying that map inline, since bippy follows no external map from a module whose URL is not http(s). */
async function unloadableFrame(url: string): Promise<Response> {
  const inline = url.startsWith(WEBPACK_EVAL_MODULE_PREFIX)
    ? await webpackEvalModuleMap(url)
    : await nextServerSourceMap(url)
  if (inline === null) return NOT_LOADABLE()
  return new Response(`//# sourceMappingURL=${inline}\n`, { status: 200 })
}

async function nextServerSourceMap(url: string): Promise<string | null> {
  const endpoint = nextServerSourceMapUrl(url)
  if (endpoint === null) return null
  const map = await genieFetch(endpoint)
  if (!map.ok) return null
  return `data:application/json;base64,${base64(await map.text())}`
}

const WEBPACK_EVAL_MODULE_PREFIX = 'webpack-internal:///'
const SOURCE_MAPPING_URL_COMMENT = '//# sourceMappingURL='
const INLINE_JSON_MAP_RE = /^data:application\/json;(?:charset=utf-8;)?base64,[A-Za-z0-9+/]+={0,2}$/
const pageScriptTexts = new Map<string, Promise<string | null>>()

/** webpack's eval devtools run each module through `eval` with its map inline, so no URL serves the module. Its code sits in a page script as a string literal that ends with that map and then its `sourceURL`. */
async function webpackEvalModuleMap(url: string): Promise<string | null> {
  const footer = `\\n//# sourceURL=${url}\\n`
  for (const script of pageScriptUrls()) {
    const text = await pageScriptText(script)
    const end = text?.indexOf(footer) ?? -1
    if (!text || end === -1) continue
    const comment = text.lastIndexOf(SOURCE_MAPPING_URL_COMMENT, end)
    const map = comment === -1 ? '' : text.slice(comment + SOURCE_MAPPING_URL_COMMENT.length, end)
    return INLINE_JSON_MAP_RE.test(map) ? map : null
  }
  return null
}

/** Same-origin scripts, newest first, so a module's hot update wins over the code it replaced. */
function pageScriptUrls(): string[] {
  if (typeof document === 'undefined') return []
  const loaded = performance
    .getEntriesByType('resource')
    .filter((entry) => (entry as PerformanceResourceTiming).initiatorType === 'script')
    .map((entry) => entry.name)
    .reverse()
  const declared = Array.from(document.scripts, (script) => script.src).filter(Boolean)
  return [...new Set([...loaded, ...declared])].filter(
    (url) => new URL(url, document.baseURI).origin === location.origin,
  )
}

function pageScriptText(url: string): Promise<string | null> {
  let pending = pageScriptTexts.get(url)
  if (!pending) {
    pending = genieFetch(url)
      .then((response) => (response.ok ? response.text() : null))
      .catch(() => null)
    pageScriptTexts.set(url, pending)
  }
  return pending
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
  return (url, init) => (isPageLoadableUrl(url) ? genieFetch(url, init) : unloadableFrame(url))
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

/** Resolves where a hook was called, as the hook inspector recorded it, to its original source. */
export async function resolveHookCallsite(hook: HookSource | null): Promise<ResolvedSource | null> {
  const source = await resolveHookSource(hook, cacheGeneration)
  return source ? { ...source, role: 'hook-callsite' } : null
}

// A map that names the served module itself (Vite serves `/src/a.ts` with a map back to `<root>/src/a.ts`) only translates its lines, so its line and column always win. Otherwise classification prefers the served URL; the map's original file is trusted only when the served URL is an opaque bundle chunk (Next/Turbopack) AND the original classifies as app source — so a dep bundled into an app chunk stays library. A Metro bundle entry is the sole exception: it names the whole app, so any symbolicated path beats it, library ones included.
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
    const sameModule = original.file !== null && namesSameModule(original.file, served)
    const position = sameModule
      ? { file: served, line: original.line, column: original.column }
      : selectSourcePosition(served, hook.lineNumber ?? null, hook.columnNumber ?? null, original)
    return {
      ...position,
      functionName: hook.functionName ?? null,
      sourceMapConfidence: sameModule || position.file === original.file ? 'mapped' : 'served',
    }
  } catch {
    return null
  }
}

function namesSameModule(originalFile: string, servedFile: string): boolean {
  const servedPath = servedFile.startsWith('/') ? servedFile : `/${servedFile}`
  return originalFile === servedFile || originalFile.endsWith(servedPath)
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

/** appOnly hides only what is known to be library code: hiding unknown ownership would let "unattributed" read as "absent". */
export function isHiddenByAppOnly(ownership: SourceOwnership): boolean {
  return ownership === 'library'
}

export function ownershipCoverage(ownership: readonly SourceOwnership[]) {
  const counts = { app: 0, library: 0, unknown: 0 }
  for (const value of ownership) counts[value] += 1
  return { complete: counts.unknown === 0, totalCandidates: ownership.length, ...counts }
}
