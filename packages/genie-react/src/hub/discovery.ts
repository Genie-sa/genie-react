import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { isIPv6 } from 'node:net'
import { dirname, join } from 'node:path'
import { GENIE_DISCOVERY_FILE, GENIE_WS_PATH } from '../protocol'
import { agentTokenFile, writeAgentToken } from './agent-token'

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
  // A second dev server or hub for the same root must not take over: its exit would delete the files and strand the first, still-running bridge.
  const owner = await discoveryOwnerPid(file)
  if (owner !== null && owner !== process.pid && isPidAlive(owner)) return null
  const directory = dirname(file)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await chmod(directory, 0o700)
  await ensureSelfIgnored(directory)
  // Token first, so a CLI that already sees the new endpoint can authenticate to it.
  const tokenFile = await writeAgentToken(rootDir, token)
  // Write-then-rename so a concurrent CLI read never sees a torn file.
  const temporary = `${file}.${process.pid}.tmp`
  await rm(temporary, { force: true })
  // The token path is recorded because a CLI running with a different TMPDIR (agent sandboxes) would otherwise look in the wrong per-user directory.
  await writeFile(
    temporary,
    `${JSON.stringify({ ...endpoint, pid: process.pid, tokenFile }, null, 2)}\n`,
    { mode: 0o600, flag: 'wx' },
  )
  await rename(temporary, file)
  return file
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

/** The `pid` recorded in a discovery or token file; null when the file is missing, unreadable or carries none. */
async function discoveryOwnerPid(file: string): Promise<number | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'))
    const pid = typeof parsed === 'object' && parsed !== null && 'pid' in parsed ? parsed.pid : null
    return typeof pid === 'number' ? pid : null
  } catch {
    return null
  }
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
