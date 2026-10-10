import type { Dirent } from 'node:fs'
import { access, readdir, readFile, unlink } from 'node:fs/promises'
import { dirname, join, parse, relative } from 'node:path'
import { GENIE_DISCOVERY_FILE, GENIE_WS_PATH } from 'genie-react/protocol'
import { writeDiagnostic } from './cli-output'
import { isRecord } from './guards'

/** ESRCH/ERANGE mean the process is gone; EPERM means alive but owned by another user. */
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error instanceof Error && 'code' in error && error.code === 'EPERM'
  }
}

export interface BridgeDiscovery {
  url: string
  pid?: number
  token?: string
}

/** Validate the WebSocket endpoint before it reaches ws or a paste-ready shell command. */
export function normalizeBridgeUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Bridge URL must be an absolute ws:// or wss:// URL.')
  }
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error('Bridge URL must use ws:// or wss://.')
  }
  if (url.username || url.password) throw new Error('Bridge URL cannot contain credentials.')
  if (url.search || url.hash) throw new Error('Bridge URL cannot contain a query or fragment.')
  return url.toString()
}

/** The single reader of a `.genie/bridge.json` payload, so the upward walk and `doctor` narrow the JSON identically. */
export function parseBridgeDiscovery(raw: string): BridgeDiscovery | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed) || typeof parsed.url !== 'string') return null
  let url: string
  try {
    url = normalizeBridgeUrl(parsed.url)
  } catch {
    return null
  }
  return {
    url,
    pid: typeof parsed.pid === 'number' ? parsed.pid : undefined,
    token: typeof parsed.token === 'string' ? parsed.token : undefined,
  }
}

export interface ResolvedBridge {
  url: string
  /** Agent token the hub requires; undefined when nothing published one for this URL. */
  token?: string
  /** `fallback` means the URL is a guess (no env, no discovery file) — callers should say so instead of presenting it as fact. */
  source: 'env' | 'file' | 'workspace' | 'fallback'
}

const DISCOVERY_ROOT_MARKERS = ['.git', 'pnpm-workspace.yaml'] as const
const IGNORED_DISCOVERY_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
])
const MAX_DISCOVERY_DEPTH = 5

interface WorkspaceDiscovery {
  file: string
  url: string
  token?: string
}

/** Priority: env → nearest discovery file → one live descendant in a workspace root → localhost fallback; the token travels with the file that published the URL. */
export async function resolveBridge(cwd: string = process.cwd()): Promise<ResolvedBridge> {
  const fromEnv = process.env.GENIE_BRIDGE_URL
  if (fromEnv) {
    const url = normalizeBridgeUrl(fromEnv)
    return { url, token: await resolveBridgeToken(url, cwd), source: 'env' }
  }

  const fromFile = await readDiscoveryUpward(cwd)
  if (fromFile) return { url: fromFile.url, token: fromFile.token, source: 'file' }

  const fromWorkspace = await readWorkspaceDiscoveries(cwd)
  const [only] = fromWorkspace
  if (only && fromWorkspace.length === 1) {
    return { url: only.url, token: only.token, source: 'workspace' }
  }
  if (fromWorkspace.length > 1) {
    const choices = fromWorkspace
      .map(({ file, url }) => `  ${relative(cwd, file) || file} -> ${url}`)
      .join('\n')
    throw new Error(
      `Multiple live Genie bridges were found below ${cwd}:\n${choices}\nRun from the app directory, or choose one with --url <ws-url> / GENIE_BRIDGE_URL.`,
    )
  }

  const port = process.env.GENIE_BRIDGE_PORT ?? '5173'
  return { url: normalizeBridgeUrl(`ws://localhost:${port}${GENIE_WS_PATH}`), source: 'fallback' }
}

export async function resolveBridgeUrl(cwd: string = process.cwd()): Promise<string> {
  return (await resolveBridge(cwd)).url
}

/** Token for an explicitly chosen URL: GENIE_BRIDGE_TOKEN, else the discovery file (upward, then below a workspace root) publishing that endpoint. */
export async function resolveBridgeToken(
  url: string,
  cwd: string = process.cwd(),
): Promise<string | undefined> {
  const fromEnv = process.env.GENIE_BRIDGE_TOKEN
  if (fromEnv) return fromEnv
  const nearest = await readDiscoveryUpward(cwd)
  if (nearest && sameEndpoint(nearest.url, url)) return nearest.token
  const descendants = await readWorkspaceDiscoveries(cwd)
  return descendants.find((discovery) => sameEndpoint(discovery.url, url))?.token
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

// Discovery always says `localhost`; a user-typed 127.0.0.1 or [::1] for the same port is the same hub.
function sameEndpoint(a: string, b: string): boolean {
  const left = new URL(a)
  const right = new URL(b)
  const hostsMatch =
    left.hostname === right.hostname ||
    (LOOPBACK_HOSTS.has(left.hostname) && LOOPBACK_HOSTS.has(right.hostname))
  return (
    hostsMatch &&
    left.protocol === right.protocol &&
    left.port === right.port &&
    left.pathname === right.pathname
  )
}

// Walks up to the filesystem root, so `genie-react call` works from nested dirs and monorepo roots.
async function readDiscoveryUpward(startDir: string): Promise<BridgeDiscovery | null> {
  const { root } = parse(startDir)
  let dir = startDir
  for (;;) {
    const path = join(dir, GENIE_DISCOVERY_FILE)
    try {
      const raw = await readFile(path, 'utf8')
      const discovery = parseBridgeDiscovery(raw)
      if (discovery?.url) {
        if (discovery.pid === undefined || isPidAlive(discovery.pid)) return discovery
        // A SIGKILLed dev server/hub never cleans up; a dead pid means the URL is a lie — heal instead of failing weird.
        await unlink(path).catch(() => {})
        writeDiagnostic(
          'stale_discovery',
          'Removed a stale bridge discovery file because its process no longer exists.',
          { file: GENIE_DISCOVERY_FILE, pid: discovery.pid },
        )
      }
    } catch {
      // not in this dir — keep walking up
    }
    if (dir === root) return null
    dir = dirname(dir)
  }
}

// Search downward only from a monorepo root; a nested directory could select a sibling app, while home or `/` would be costly.
async function readWorkspaceDiscoveries(cwd: string): Promise<WorkspaceDiscovery[]> {
  if (!(await isWorkspaceRoot(cwd))) return []
  const found: WorkspaceDiscovery[] = []

  const visit = async (dir: string, depth: number): Promise<void> => {
    if (depth > MAX_DISCOVERY_DEPTH) return
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue
      if (entry.name === '.genie') {
        const file = join(dir, entry.name, 'bridge.json')
        const discovery = await readLiveDiscovery(file)
        if (discovery) found.push({ file, url: discovery.url, token: discovery.token })
        continue
      }
      if (IGNORED_DISCOVERY_DIRS.has(entry.name)) continue
      await visit(join(dir, entry.name), depth + 1)
    }
  }

  await visit(cwd, 0)
  const unique = new Map<string, WorkspaceDiscovery>()
  for (const discovery of found) unique.set(discovery.url, discovery)
  return [...unique.values()].sort((a, b) => a.file.localeCompare(b.file))
}

async function isWorkspaceRoot(cwd: string): Promise<boolean> {
  for (const marker of DISCOVERY_ROOT_MARKERS) {
    try {
      await access(join(cwd, marker))
      return true
    } catch {
      // Try the next marker.
    }
  }
  return false
}

async function readLiveDiscovery(file: string): Promise<BridgeDiscovery | null> {
  let discovery: BridgeDiscovery | null = null
  try {
    discovery = parseBridgeDiscovery(await readFile(file, 'utf8'))
  } catch {
    return null
  }
  if (!discovery) return null
  if (discovery.pid === undefined || isPidAlive(discovery.pid)) return discovery
  await unlink(file).catch(() => {})
  writeDiagnostic(
    'stale_discovery',
    'Removed a stale bridge discovery file because its process no longer exists.',
    { file: relative(process.cwd(), file) || file, pid: discovery.pid },
  )
  return null
}
