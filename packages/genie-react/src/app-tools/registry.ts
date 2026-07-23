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

/** Store shared by every registration surface; an unregistered tool becomes a tombstone — still advertised, marked unavailable with a recovery hint, revived in place on remount. */
interface AppToolEntry {
  tool: GenieAppTool
  /** Stable erased wrapper (lazy): reads `tool`/`refs` live, so refreshes reuse one object instead of re-allocating per tool. */
  erased?: ErasedCollectorTool
  refs: number
  lastPathname: string | undefined
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
    for (const tool of tools) release(tool.contract.name)
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
    entries.set(name, { tool, refs: 1, lastPathname: currentPathname() })
    return
  }
  if (existing.refs > 0) {
    console.warn(`[genie] app tool "${name}" registered more than once — the latest handler wins`)
  }
  existing.tool = tool
  // The replaced definition may carry a new contract; rebuild the wrapper so discovery matches it.
  existing.erased = erase(existing)
  existing.refs += 1
  existing.lastPathname = currentPathname()
}

function release(name: string): void {
  const entry = entries.get(name)
  if (!entry) return
  entry.refs = Math.max(0, entry.refs - 1)
}

function erase(entry: AppToolEntry): ErasedCollectorTool {
  return {
    contract: entry.tool.contract,
    availability: (): ToolAvailability =>
      entry.refs > 0 ? { available: true } : { available: false, reason: unavailableReason(entry) },
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

/** Pre-flights the wire encoding: an unserializable result would otherwise vanish into a bridge timeout, and an unbounded one floods the agent's context. */
function guardResultSize(name: string, result: unknown, capBytes: number): void {
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
