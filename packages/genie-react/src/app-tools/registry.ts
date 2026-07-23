import type {
  CollectorContext,
  ErasedCollectorTool,
  GenieCollector,
  ToolAvailability,
} from '../client/collector'
import {
  encodeMessage,
  errorMessage,
  type GenieRegistry,
  newId,
  readGenieGlobal,
  registerGenieCollector,
} from '../protocol'
import { type GenieAppTool, GenieToolError } from './define'

// Agents pay for every byte a tool returns; past the cap the honest move is a loud failure naming the fix, not silent truncation.
const DEFAULT_RESULT_BYTE_CAP = 128 * 1024

// Bounded so dynamically-named tools can't grow the catalog and every future hello forever.
const MAX_TOMBSTONES = 32

/** Store shared by every registration surface; an unregistered tool becomes a tombstone — still advertised, marked unavailable with a recovery hint, revived in place on remount. */
interface AppToolEntry {
  /** Live registrations, oldest first; the newest one answers calls, so releasing a duplicate falls back to the survivor. */
  registrations: GenieAppTool[]
  /** Latest known definition — keeps the tombstone's contract after the last registration releases. */
  tool: GenieAppTool
  /** Stable erased wrapper (lazy): reads the entry live, so refreshes reuse one object instead of re-allocating per tool. */
  erased?: ErasedCollectorTool
  lastPathname: string | undefined
  releasedAt: number | undefined
}

const entries = new Map<string, AppToolEntry>()
let stopWaitingForClient: (() => void) | null = null
let registeredWith: GenieRegistry | null = null
let context: CollectorContext | null = null
let refreshQueued = false

const appToolsCollector: GenieCollector = {
  // Unique id per module copy, so two genie-react instances on one page advertise side by side instead of evicting each other.
  meta: {
    id: `app-tools-${newId()}`,
    title: 'App tools',
    description: 'Custom tools registered by the application',
  },
  capabilities: ['app'],
  get tools(): ErasedCollectorTool[] {
    return [...entries.values()].map((entry) => (entry.erased ??= erase(entry)))
  },
  start: (ctx) => {
    context = ctx
    return () => {
      if (context === ctx) context = null
    }
  },
}

/** Registers app tools with the running genie client (queued until one starts) and returns an unregister function; safe anywhere in browser code, a no-op server-side. React components should prefer `useGenieTool`. */
export function registerGenieTools(...tools: GenieAppTool[]): () => void {
  if (typeof window === 'undefined' || tools.length === 0) return () => {}
  for (const tool of tools) upsert(tool)
  ensureCollectorRegistered()
  scheduleRefresh()

  let released = false
  return () => {
    if (released) return
    released = true
    for (const tool of tools) release(tool)
    scheduleRefresh()
  }
}

/** Registers with the live client, re-registering when a NEW client replaced it (Fast Refresh); with no client yet, every call re-arms the bounded retry so a late-starting client still picks the collector up. */
function ensureCollectorRegistered(): void {
  const live = readGenieGlobal()
  if (live) {
    if (registeredWith !== live) {
      live.register(appToolsCollector)
      registeredWith = live
    }
    return
  }
  stopWaitingForClient?.()
  stopWaitingForClient = registerGenieCollector(appToolsCollector)
}

// One hello per tick instead of one per hook: StrictMode mounts a three-tool panel with a single catalog refresh.
function scheduleRefresh(): void {
  if (refreshQueued) return
  refreshQueued = true
  queueMicrotask(() => {
    refreshQueued = false
    context?.refreshTools()
  })
}

function upsert(tool: GenieAppTool): void {
  const name = tool.contract.name
  const existing = entries.get(name)
  if (!existing) {
    entries.set(name, {
      registrations: [tool],
      tool,
      lastPathname: currentPathname(),
      releasedAt: undefined,
    })
    return
  }
  if (existing.registrations.length > 0) {
    console.warn(`[genie] app tool "${name}" registered more than once — the latest handler wins`)
  }
  existing.registrations.push(tool)
  adoptNewest(existing)
  existing.lastPathname = currentPathname()
  existing.releasedAt = undefined
}

/** Releases one exact registration; a surviving duplicate takes over, so a released handler can never answer again. */
function release(tool: GenieAppTool): void {
  const entry = entries.get(tool.contract.name)
  if (!entry) return
  const index = entry.registrations.lastIndexOf(tool)
  if (index === -1) return
  entry.registrations.splice(index, 1)
  if (entry.registrations.length > 0) adoptNewest(entry)
  else {
    entry.releasedAt = Date.now()
    pruneTombstones()
  }
}

/** Points the entry (and its advertised contract) at the newest live registration. */
function adoptNewest(entry: AppToolEntry): void {
  const newest = entry.registrations[entry.registrations.length - 1]
  if (!newest || newest === entry.tool) return
  entry.tool = newest
  entry.erased = erase(entry)
}

function pruneTombstones(): void {
  const tombstones = [...entries.entries()].filter(([, entry]) => entry.registrations.length === 0)
  if (tombstones.length <= MAX_TOMBSTONES) return
  tombstones.sort(([, a], [, b]) => (a.releasedAt ?? 0) - (b.releasedAt ?? 0))
  for (const [name] of tombstones.slice(0, tombstones.length - MAX_TOMBSTONES)) {
    entries.delete(name)
  }
}

function erase(entry: AppToolEntry): ErasedCollectorTool {
  return {
    contract: entry.tool.contract,
    availability: (): ToolAvailability =>
      entry.registrations.length > 0
        ? { available: true }
        : { available: false, reason: unavailableReason(entry) },
    handler: (args: never) => runHandler(entry, args),
  }
}

async function runHandler(entry: AppToolEntry, args: never): Promise<unknown> {
  const name = entry.tool.contract.name
  let result: unknown
  try {
    result = await entry.tool.handler(args)
  } catch (error) {
    if (error instanceof GenieToolError) throw error
    throw new Error(
      `the app's "${name}" handler threw: ${errorMessage(error)} (the failure is in the app's own tool code, not genie)`,
    )
  }
  guardResultSize(name, result, entry.tool.maxResultBytes ?? DEFAULT_RESULT_BYTE_CAP)
  return result
}

/** Pre-flights the wire encoding: an unserializable result would otherwise vanish into a bridge timeout or silently collapse, and an unbounded one floods the agent's context. */
function guardResultSize(name: string, result: unknown, capBytes: number): void {
  let lossy: string | null
  try {
    lossy = findLossyValue(result, 'result', new Set())
  } catch (error) {
    throw new Error(
      `"${name}" returned a value that cannot be serialized (${errorMessage(error)}) — return plain data, not DOM nodes, fibers, or class instances`,
    )
  }
  if (lossy) {
    throw new Error(
      `"${name}" returned a value that cannot cross the wire: ${lossy} — return plain serializable data`,
    )
  }
  let encoded: string
  try {
    encoded = encodeMessage(result)
  } catch (error) {
    throw new Error(
      `"${name}" returned a value that cannot be serialized (${errorMessage(error)}) — return plain data, not DOM nodes, fibers, or class instances`,
    )
  }
  const bytes = new TextEncoder().encode(encoded).byteLength
  if (bytes <= capBytes) return
  const kb = Math.round(bytes / 1024)
  const shape =
    typeof result === 'object' && result !== null
      ? ` (top-level keys: ${Object.keys(result).slice(0, 10).join(', ')})`
      : ''
  throw new Error(
    `"${name}" returned ~${kb}KB — over its ${Math.round(capBytes / 1024)}KB result cap, too large for an agent to read${shape}. Return a summary, accept limit/filter args, or raise maxResultBytes on the tool if this size is intentional.`,
  )
}

/** SuperJSON drops functions and symbols silently, so a handler returning one would report `ok:true` with a hollow result; name the offending path instead. */
function findLossyValue(value: unknown, path: string, seen: Set<object>): string | null {
  if (typeof value === 'function') return `${path} is a function`
  if (typeof value === 'symbol') return `${path} is a symbol`
  if (typeof value !== 'object' || value === null) return null
  if (seen.has(value)) return null
  seen.add(value)
  if (value instanceof Date || value instanceof RegExp) return null
  if (value instanceof Map) {
    for (const [key, item] of value) {
      const found = findLossyValue(item, `${path}.get(${String(key)})`, seen)
      if (found) return found
    }
    return null
  }
  if (value instanceof Set) {
    for (const item of value) {
      const found = findLossyValue(item, `${path} (set item)`, seen)
      if (found) return found
    }
    return null
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const found = findLossyValue(value[index], `${path}[${index}]`, seen)
      if (found) return found
    }
    return null
  }
  for (const [key, item] of Object.entries(value)) {
    const found = findLossyValue(item, `${path}.${key}`, seen)
    if (found) return found
  }
  return null
}

function unavailableReason(entry: AppToolEntry): string {
  const location = entry.lastPathname
    ? ` (it was registered at URL path ${entry.lastPathname})`
    : ''
  return `the code that registers it is not mounted${location}. Drive the app back to that UI, then retry — \`genie-react tools app\` shows what is live.`
}

function currentPathname(): string | undefined {
  return typeof location !== 'undefined' ? location.pathname : undefined
}

/** Test-only: clears the shared store so suites start from a blank registry. */
export function resetGenieAppToolsForTests(): void {
  entries.clear()
  stopWaitingForClient?.()
  stopWaitingForClient = null
  registeredWith = null
  context = null
  refreshQueued = false
}
