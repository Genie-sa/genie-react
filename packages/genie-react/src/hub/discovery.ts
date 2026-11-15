import { randomUUID } from 'node:crypto'
import { readFileSync, rmSync } from 'node:fs'
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { connect, isIPv6 } from 'node:net'
import { dirname, join } from 'node:path'
import { GENIE_DISCOVERY_FILE, GENIE_WS_PATH } from '../protocol'
import { agentTokenFile, agentTokenFileSync, writeAgentToken } from './agent-token'

export interface HubDiscovery {
  url: string
  port: number
  /** Agent token the hub requires; stored in a per-user private file, never under the web-served project root. */
  token: string
}

/** Agent URL as the bound IP literal, never `localhost`, so a specific loopback bind cannot be shadowed by a squatter on the other family; wildcards map to 127.0.0.1, which `::` still serves when IPv6 is disabled. */
export function bridgeUrlFor(address: string, port: number): string {
  const host = address === '0.0.0.0' || address === '::' ? '127.0.0.1' : address
  return `ws://${isIPv6(host) ? `[${host}]` : host}:${port}${GENIE_WS_PATH}`
}

/** Publishes the hub for the genie CLI: endpoint in `.genie/bridge.json`, token in the private token store; returns the discovery path, or null when another live process already publishes this root and keeps it. */
export async function writeDiscoveryFile(
  rootDir: string,
  info: HubDiscovery,
): Promise<string | null> {
  const { token, ...endpoint } = info
  const file = join(rootDir, GENIE_DISCOVERY_FILE)
  const directory = dirname(file)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await chmod(directory, 0o700)
  await ensureSelfIgnored(directory)
  // Two dev servers starting at once must not interleave: one's endpoint paired with the other's token authenticates nowhere.
  return withPublishLock(directory, async () => {
    // A second dev server or hub for the same root must not take over: its exit would delete the files and strand the first, still-running bridge.
    if (await publishedByAnotherLiveBridge(file)) return null
    // Token first, so a CLI that already sees the new endpoint can authenticate to it.
    const tokenFile = await writeAgentToken(rootDir, token)
    // Write-then-rename so a concurrent CLI read never sees a torn file.
    const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`
    // The token path is recorded because a CLI running with a different TMPDIR (agent sandboxes) would otherwise look in the wrong per-user directory.
    await writeFile(
      temporary,
      `${JSON.stringify({ ...endpoint, pid: process.pid, tokenFile }, null, 2)}\n`,
      { mode: 0o600, flag: 'wx' },
    )
    await rename(temporary, file)
    return file
  })
}

const PUBLISH_LOCK = 'publish.lock'
const PUBLISH_LOCK_WAIT_MS = 5_000
// Publishing takes milliseconds; a lock this old belongs to a process that died or hung mid-publish.
const PUBLISH_LOCK_STALE_MS = 10_000
const PUBLISH_LOCK_POLL_MS = 20

/** Runs `task` while holding an exclusive lock file in `directory`, taking over one whose owner died or that outlived any real publication. */
export async function withPublishLock<T>(directory: string, task: () => Promise<T>): Promise<T> {
  const lock = join(directory, PUBLISH_LOCK)
  const owner = `${process.pid}:${randomUUID()}`
  const deadline = Date.now() + PUBLISH_LOCK_WAIT_MS
  for (;;) {
    try {
      await writeFile(lock, owner, { mode: 0o600, flag: 'wx' })
      break
    } catch (error) {
      if (!isErrorCode(error, 'EEXIST')) throw error
      if (await releaseStaleLock(lock)) continue
      if (Date.now() >= deadline) {
        throw new Error(
          `genie-react: ${lock} is held by another dev server or hub that is publishing this project; delete it if no such process is starting`,
        )
      }
      await new Promise((resolve) => setTimeout(resolve, PUBLISH_LOCK_POLL_MS))
    }
  }
  try {
    return await task()
  } finally {
    if ((await readFile(lock, 'utf8').catch(() => null)) === owner) await rm(lock, { force: true })
  }
}

async function releaseStaleLock(lock: string): Promise<boolean> {
  const [holder, info] = await Promise.all([
    readFile(lock, 'utf8').catch(() => null),
    stat(lock).catch(() => null),
  ])
  if (holder === null || info === null) return true
  const pid = Number(holder.split(':')[0])
  const stale =
    !Number.isInteger(pid) || !isPidAlive(pid) || Date.now() - info.mtimeMs > PUBLISH_LOCK_STALE_MS
  // Re-read before removing, so a lock another process just took over is left alone.
  if (!stale || (await readFile(lock, 'utf8').catch(() => null)) !== holder) return false
  await rm(lock, { force: true })
  return true
}

function isErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

// The directory holds only ephemeral state, so it keeps itself out of git without touching the project's .gitignore.
async function ensureSelfIgnored(directory: string): Promise<void> {
  try {
    await writeFile(join(directory, '.gitignore'), '*\n', { flag: 'wx' })
  } catch {
    // an existing .gitignore already covers it; ignore
  }
}

/** Removes only the files this process published, so a hub that exits after another took over the root leaves the newer hub discoverable. */
export async function removeDiscoveryFile(rootDir: string): Promise<void> {
  const discoveryFile = join(rootDir, GENIE_DISCOVERY_FILE)
  const tokenFile = await agentTokenFile(rootDir).catch(() => null)
  await Promise.all([
    removeIfOwned(discoveryFile),
    tokenFile === null ? undefined : removeIfOwned(tokenFile),
  ])
}

async function removeIfOwned(file: string): Promise<void> {
  if ((await discoveryOwnerPid(file)) === process.pid) await rm(file, { force: true })
}

/** {@link removeDiscoveryFile} for exit and signal handlers, where no promise settles before the process ends. */
export function removeDiscoveryFileSync(rootDir: string): void {
  removeIfOwnedSync(join(rootDir, GENIE_DISCOVERY_FILE))
  try {
    removeIfOwnedSync(agentTokenFileSync(rootDir))
  } catch {
    // the root vanished, so there is no key to locate a token by; ignore
  }
}

function removeIfOwnedSync(file: string): void {
  try {
    if (ownerPidOf(readFileSync(file, 'utf8')) === process.pid) rmSync(file, { force: true })
  } catch {
    // already gone or unreadable: nothing of ours to remove
  }
}

// A live pid alone can be a recycled one after a crash, so the owner must also still accept connections on its published endpoint.
async function publishedByAnotherLiveBridge(file: string): Promise<boolean> {
  const owner = await discoveryOwnerPid(file)
  if (owner === null || owner === process.pid || !isPidAlive(owner)) return false
  const endpoint = await publishedEndpoint(file)
  return endpoint !== null && (await acceptsConnections(endpoint.host, endpoint.port))
}

async function publishedEndpoint(file: string): Promise<{ host: string; port: number } | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'))
    const url = typeof parsed === 'object' && parsed !== null && 'url' in parsed ? parsed.url : null
    if (typeof url !== 'string') return null
    const { hostname, port } = new URL(url)
    return { host: hostname.replace(/^\[|\]$/g, ''), port: Number(port) }
  } catch {
    return null
  }
}

function acceptsConnections(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port, timeout: 500 })
    const finish = (accepted: boolean): void => {
      socket.destroy()
      resolve(accepted)
    }
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

/** The `pid` recorded in a discovery or token file; null when the file is missing, unreadable or carries none. */
async function discoveryOwnerPid(file: string): Promise<number | null> {
  try {
    return ownerPidOf(await readFile(file, 'utf8'))
  } catch {
    return null
  }
}

function ownerPidOf(text: string): number | null {
  const parsed: unknown = JSON.parse(text)
  const pid = typeof parsed === 'object' && parsed !== null && 'pid' in parsed ? parsed.pid : null
  return typeof pid === 'number' ? pid : null
}

/** ESRCH means the process is gone; EPERM means alive but owned by another user. */
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EPERM'
  }
}
