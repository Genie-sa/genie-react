import { decode } from '@jridgewell/sourcemap-codec'
import { type Fiber, getFiberId, getLatestFiber } from 'bippy'
import {
  getFiberHooks,
  getSource,
  getSourceFromSourceMap,
  type HookSource,
  type HooksNode,
  isSourceFile,
  normalizeFileName,
  type SourceMap,
} from 'bippy/source'

export interface ResolvedSource {
  file: string
  line: number | null
  column: number | null
  functionName: string | null
}

export interface FiberClassification {
  source: ResolvedSource | null
  isLibrary: boolean
}

const cache = new Map<number, ResolvedSource>()
const effectSourceCache = new Map<number, (ResolvedSource | null)[]>()
const ANCESTOR_HOPS = 20

export function clearSourceCache(): void {
  cache.clear()
  effectSourceCache.clear()
  moduleMapCache.clear()
}

/**
 * Resolves a fiber to its definition site (file:line). On React 19 `_debugSource` is gone, so bippy
 * symbolicates `_debugStack` through the bundle's source map — hence this is async and network-bound
 * (the source map is fetched once per bundle, then cached). bippy skips Vite's inline maps, so the line
 * is then upgraded to the original via {@link toOriginalPosition} for parity with per-effect sources.
 * Only successes are cached, so a transient null (e.g. just after HMR) can recover on the next call.
 */
export async function resolveSource(fiber: Fiber): Promise<ResolvedSource | null> {
  const id = getFiberId(fiber)
  const cached = cache.get(id)
  if (cached) return cached

  try {
    const source = await getSource(getLatestFiber(fiber) ?? fiber)
    if (!source?.fileName) return null
    const { line, column } = await toOriginalPosition(
      source.fileName,
      source.lineNumber ?? null,
      source.columnNumber ?? null,
    )
    const resolved: ResolvedSource = {
      file: normalizeFileName(source.fileName),
      line,
      column,
      functionName: source.functionName ?? null,
    }
    cache.set(id, resolved)
    return resolved
  } catch {
    return null
  }
}

/** A file outside the project tree (under node_modules, incl. Vite's pre-bundled deps) is a library. */
export function isLibraryFile(file: string): boolean {
  return !isSourceFile(file)
}

/**
 * Classifies a fiber as app vs library by its resolved source. Host fibers and framework-only stacks
 * resolve to nothing, so it climbs to the nearest composite ancestor that does and inherits that.
 * Unresolved stays app (`isLibrary: false`) so a missing source never silently hides a component.
 */
export async function classifyFiber(fiber: Fiber): Promise<FiberClassification> {
  let current: Fiber | null = fiber
  for (let hops = 0; current && hops < ANCESTOR_HOPS; hops++) {
    const source = await resolveSource(current)
    if (source) return { source, isLibrary: isLibraryFile(source.file) }
    current = current.return
  }
  return { source: null, isLibrary: false }
}

/** A stable display identity for an otherwise-anonymous fiber, e.g. `cmdk.js:1998`. */
export function sourceLabel(source: ResolvedSource | null): string | null {
  if (!source) return null
  const base = source.file.split('/').pop() || source.file
  return source.line != null ? `${base}:${source.line}` : base
}

const EFFECT_HOOK_NAMES = new Set(['Effect', 'LayoutEffect', 'InsertionEffect'])

/**
 * Walk the hook tree depth-first (hook-call order) and collect each effect node's call-site. An effect
 * node is identified by name — not by being a leaf: in a bundled (esbuild-optimized) dev build the
 * inspector nests the effect's own React/bippy frames beneath it, so the effect node has children. We
 * recurse only through non-effect containers (component frames, custom/library hooks) so an effect
 * created inside a library hook is still found, and stop at the effect node itself (its subHooks are
 * its internal implementation, not more user effects).
 */
function collectEffectCallSites(nodes: HooksNode[], out: HookSource[]): void {
  for (const node of nodes) {
    if (EFFECT_HOOK_NAMES.has(node.name)) {
      if (node.hookSource) out.push(node.hookSource)
    } else {
      collectEffectCallSites(node.subHooks, out)
    }
  }
}

const INLINE_SOURCE_MAP_RE =
  /\/\/[#@]\s*sourceMappingURL=data:application\/json;(?:[^,]*?;)?base64,([A-Za-z0-9+/=]+)/

const moduleMapCache = new Map<string, SourceMap | null>()

/**
 * Loads a Vite-served module's inline (`data:`) source map. bippy's symbolicator only fetches *external*
 * map URLs, so in dev — where Vite inlines the map — its line numbers stay at the served (transformed)
 * position. Decoding the inline map ourselves recovers the original line.
 */
async function inlineSourceMap(url: string): Promise<SourceMap | null> {
  if (moduleMapCache.has(url)) return moduleMapCache.get(url) ?? null
  let map: SourceMap | null = null
  try {
    const response = await fetch(url)
    const encoded = response.ok ? (await response.text()).match(INLINE_SOURCE_MAP_RE)?.[1] : null
    if (encoded) {
      const raw = JSON.parse(atob(encoded)) as { mappings?: unknown; sources?: unknown }
      if (typeof raw.mappings === 'string' && Array.isArray(raw.sources)) {
        map = { ...(raw as object), mappings: decode(raw.mappings) } as SourceMap
      }
    }
  } catch {
    map = null
  }
  moduleMapCache.set(url, map)
  return map
}

/**
 * Maps a served (transformed) line/column to the original via the module's inline source map — the
 * piece bippy's symbolicator skips. Returns the input unchanged when there is no inline map (e.g. a dep
 * served with an external map, or production), so callers keep a usable served-coordinate fallback.
 */
async function toOriginalPosition(
  servedUrl: string,
  line: number | null,
  column: number | null,
): Promise<{ line: number | null; column: number | null }> {
  if (typeof line !== 'number' || typeof column !== 'number') return { line, column }
  const map = await inlineSourceMap(servedUrl)
  const original = map ? getSourceFromSourceMap(map, line, column) : null
  if (original && typeof original.lineNumber === 'number') {
    return { line: original.lineNumber, column: original.columnNumber ?? column }
  }
  return { line, column }
}

/**
 * Resolves one hook's call-site. The file and library classification come from the served URL (reliable:
 * `/node_modules/.vite/deps/*` is a dep, `/src/*` is yours) — never from the source map's own `sources`,
 * which can point a bundled dep at a non-node_modules path and misclassify it. Only the line/column are
 * mapped back to the original.
 */
async function resolveHookSource(hook: HookSource): Promise<ResolvedSource | null> {
  if (!hook.fileName) return null
  const file = normalizeFileName(hook.fileName)
  if (!file) return null
  const { line, column } = await toOriginalPosition(
    hook.fileName,
    hook.lineNumber ?? null,
    hook.columnNumber ?? null,
  )
  return { file, line, column, functionName: hook.functionName ?? null }
}

/**
 * Resolves the call-site of each of a function component's user effects (useEffect / useLayoutEffect /
 * useInsertionEffect), in hook-call order. Where `resolveSource` resolves the component's *definition*
 * line (the same for every effect), this uses bippy's hook inspector — a shadow render that captures a
 * stack at each hook — so an effect created inside a library hook (i18next, cmdk) resolves to that
 * library's file, not the component.
 *
 * Returns `null` when inspection is unavailable (a non-function fiber, or a hook the inspector cannot
 * replay) — the caller cannot attribute and falls back. Returns `[]` when inspection *succeeded* but the
 * component calls no user effects at all: any effects in its commit list then come from internal hooks
 * (useSyncExternalStore, useActionState), which the caller can treat as library noise. A non-empty array
 * lines up 1:1 with the commit list only when its length matches (no interleaved internal effects).
 */
export async function resolveEffectSources(
  fiber: Fiber,
): Promise<(ResolvedSource | null)[] | null> {
  const target = getLatestFiber(fiber) ?? fiber
  const id = getFiberId(target)
  const cached = effectSourceCache.get(id)
  if (cached) return cached

  const callSites: HookSource[] = []
  try {
    collectEffectCallSites(getFiberHooks(target), callSites)
  } catch {
    return null
  }
  if (callSites.length === 0) return []

  const resolved = await Promise.all(callSites.map(resolveHookSource))
  if (resolved.some((source) => source !== null)) effectSourceCache.set(id, resolved)
  return resolved
}
