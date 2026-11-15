import { type Fiber, isCompositeFiber } from 'bippy'
import type { SourceMap } from 'bippy/source'
import type { ErasedCollectorTool } from '../../client'
import { genieFetch } from '../genie-fetch'
import { recordSourceName } from './component-name'
import { findAllRootFibers, nameOf } from './fiber'
import { getCommitCount } from './render-tracker'
import { capturedDebugFrames, dataPropertyValue, isPageLoadableUrl, sourceMapFor } from './source'

const TREE_SCAN_LIMIT = 5_000
const OWNED_CHILD_SCAN_LIMIT = 200
const CANDIDATE_TYPE_LIMIT = 20
const PROOF_BUDGET_MS = 1_000
const MAX_BUNDLE_CHARACTERS = 32 * 1024 * 1024
const SCANNED_COMPONENT_LIMIT = 100

/** A source name when the source map shows the bundler renamed the component, null when it shows the runtime name is the source name, undefined when there is no evidence either way. */
type SourceNameProof = string | null | undefined

interface BodyFrame {
  url: string
  line: number
  column: number
}

const proofs = new WeakMap<object, Promise<SourceNameProof>>()
const generatedSources = new WeakMap<SourceMap, Promise<string[] | null>>()
const scannedAtCommit = new Map<string, number>()

/** Wraps a collector tool so a `component` selector first proves which numbered runtime names are bundler renames of it; the name matcher then accepts them. */
export function withBundlerRenameProof(tool: ErasedCollectorTool): ErasedCollectorTool {
  return {
    ...tool,
    handler: (args, ctx) => {
      const component = selectedComponent(args)
      if (component === undefined) return tool.handler(args, ctx)
      return proveBundlerRenames(component).then(() => tool.handler(args, ctx))
    },
  }
}

/** esbuild resolves a name collision by appending a number (`const Row = memo(function Row…)` emits `function Row2`), and its source map names the original identifier at that token. A numbered runtime name counts as `component` only when the map says so; a real `Row2` has no such record, so it never matches `Row`. */
async function proveBundlerRenames(component: string): Promise<void> {
  const commit = getCommitCount()
  if (scannedAtCommit.get(component) === commit) return
  scannedAtCommit.delete(component)
  scannedAtCommit.set(component, commit)
  if (scannedAtCommit.size > SCANNED_COMPONENT_LIMIT) {
    const oldest = scannedAtCommit.keys().next().value
    if (oldest !== undefined) scannedAtCommit.delete(oldest)
  }

  const candidates = numberedCandidates(component)
  if (candidates.length === 0) return
  const settled = Promise.all(
    candidates.map(async ({ fiber, name }) => {
      const proof = await proofFor(fiber, name)
      if (proof !== undefined) recordSourceName(name, proof)
    }),
  )
  let timer: ReturnType<typeof setTimeout> | undefined
  const budget = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, PROOF_BUDGET_MS)
  })
  try {
    await Promise.race([settled, budget])
  } finally {
    clearTimeout(timer)
  }
}

export function resetBundlerRenameScansForTests(): void {
  scannedAtCommit.clear()
}

/** A numbered selector can itself name a renamed component (esbuild emits `Row2` for `Row`), so its literal match is proven too. */
function isRenameCandidate(name: string, component: string): boolean {
  return isNumberedVariant(name, component) || (name === component && /\d$/.test(component))
}

function isNumberedVariant(name: string, base: string): boolean {
  return name.length > base.length && name.startsWith(base) && /^\d+$/.test(name.slice(base.length))
}

function selectedComponent(args: unknown): string | undefined {
  if (typeof args !== 'object' || args === null) return undefined
  const component = Reflect.get(args, 'component') ?? Reflect.get(args, 'query')
  return typeof component === 'string' && component.length > 0 ? component : undefined
}

function numberedCandidates(component: string): { fiber: Fiber; name: string }[] {
  const candidates: { fiber: Fiber; name: string }[] = []
  const types = new Set<unknown>()
  const stack: Fiber[] = [...findAllRootFibers()].reverse()
  for (let visited = 0; stack.length > 0 && visited < TREE_SCAN_LIMIT; visited += 1) {
    const fiber = stack.pop() as Fiber
    if (fiber.sibling) stack.push(fiber.sibling)
    if (fiber.child) stack.push(fiber.child)
    if (!isCompositeFiber(fiber) || types.has(fiber.type)) continue
    const name = nameOf(fiber)
    if (!isRenameCandidate(name, component)) continue
    types.add(fiber.type)
    candidates.push({ fiber, name })
    if (candidates.length >= CANDIDATE_TYPE_LIMIT) break
  }
  return candidates
}

function proofFor(fiber: Fiber, runtimeName: string): Promise<SourceNameProof> {
  const type: object = fiber.type
  const cached = proofs.get(type)
  if (cached) return cached
  const proof = proveSourceName(fiber, runtimeName).catch(() => undefined)
  proofs.set(type, proof)
  // Missing evidence can be transient (a map still loading), so only a decided proof stays cached.
  void proof.then((value) => {
    if (value === undefined && proofs.get(type) === proof) proofs.delete(type)
  })
  return proof
}

async function proveSourceName(fiber: Fiber, runtimeName: string): Promise<SourceNameProof> {
  const frame = ownedBodyFrame(fiber, runtimeName)
  if (!frame) return undefined
  const map = await sourceMapFor(frame.url)
  if (!map) return undefined
  const lines = await generatedSource(frame.url, map)
  if (!lines) return undefined
  return renamedFrom(map, lines, runtimeName, frame)
}

/** A child created by JSX in this component's body carries a React-captured stack whose frame for the component sits inside its function, so its source is read without calling it. */
function ownedBodyFrame(fiber: Fiber, runtimeName: string): BodyFrame | null {
  const stack: Fiber[] = fiber.child ? [fiber.child] : []
  for (let visited = 0; stack.length > 0 && visited < OWNED_CHILD_SCAN_LIMIT; visited += 1) {
    const child = stack.pop() as Fiber
    if (child.sibling) stack.push(child.sibling)
    if (child.child) stack.push(child.child)
    const owner = dataPropertyValue(child, '_debugOwner')
    if (owner !== fiber && (fiber.alternate === null || owner !== fiber.alternate)) continue
    for (const frame of capturedDebugFrames(child)) {
      if (
        frame.functionName === runtimeName &&
        frame.fileName &&
        typeof frame.lineNumber === 'number' &&
        typeof frame.columnNumber === 'number'
      ) {
        return { url: frame.fileName, line: frame.lineNumber - 1, column: frame.columnNumber - 1 }
      }
    }
  }
  return null
}

function generatedSource(url: string, map: SourceMap): Promise<string[] | null> {
  let pending = generatedSources.get(map)
  if (!pending) {
    pending = (async () => {
      if (!isPageLoadableUrl(url)) return null
      const response = await genieFetch(url)
      if (!response.ok) return null
      const text = await response.text()
      return text.length > MAX_BUNDLE_CHARACTERS ? null : text.split('\n')
    })().catch(() => null)
    generatedSources.set(map, pending)
  }
  return pending
}

/** The nearest named mapping before the frame whose generated token is the runtime name decides: inside the function body that token is the function's own name or a reference to it, and esbuild never shadows a renamed binding. */
export function renamedFrom(
  map: SourceMap,
  generatedLines: readonly string[],
  runtimeName: string,
  frame: Pick<BodyFrame, 'line' | 'column'>,
): SourceNameProof {
  const section = sectionAt(map, frame)
  if (!section) return undefined
  const { mappings, names, offset } = section
  for (let line = frame.line - offset.line; line >= 0; line -= 1) {
    const segments = mappings[line] ?? []
    const generatedLine = line + offset.line
    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const segment = segments[index]
      if (segment?.length !== 5) continue
      const column = line === 0 ? segment[0] + offset.column : segment[0]
      if (generatedLine === frame.line && column >= frame.column) continue
      if (!startsWithToken(generatedLines[generatedLine] ?? '', column, runtimeName)) continue
      const sourceName = names?.[segment[4]]
      return sourceName !== undefined && isNumberedVariant(runtimeName, sourceName)
        ? sourceName
        : null
    }
  }
  return null
}

function sectionAt(
  map: SourceMap,
  position: Pick<BodyFrame, 'line' | 'column'>,
):
  | { mappings: SourceMap['mappings']; names?: string[]; offset: { line: number; column: number } }
  | undefined {
  if (!map.sections)
    return { mappings: map.mappings, names: map.names, offset: { line: 0, column: 0 } }
  let found: (typeof map.sections)[number] | undefined
  for (const section of map.sections) {
    const { line, column } = section.offset
    if (line > position.line || (line === position.line && column > position.column)) break
    found = section
  }
  return found && { mappings: found.map.mappings, names: found.map.names, offset: found.offset }
}

const IDENTIFIER_PART = /[\p{ID_Continue}$\u200c\u200d]/u

function startsWithToken(text: string, column: number, token: string): boolean {
  if (!text.startsWith(token, column)) return false
  const next = text[column + token.length]
  return next === undefined || !IDENTIFIER_PART.test(next)
}
