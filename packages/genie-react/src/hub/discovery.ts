import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { GENIE_DISCOVERY_FILE } from '../protocol'
import { removeAgentToken, writeAgentToken } from './agent-token'

export interface HubDiscovery {
  url: string
  port: number
  /** Agent token the hub requires; stored in a per-user private file, never under the web-served project root. */
  token: string
}

/** Publishes the hub for the genie CLI: endpoint in `.genie/bridge.json`, token in the private token store; returns the discovery path. */
export async function writeDiscoveryFile(rootDir: string, info: HubDiscovery): Promise<string> {
  const { token, ...endpoint } = info
  const file = join(rootDir, GENIE_DISCOVERY_FILE)
  const directory = dirname(file)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await chmod(directory, 0o700)
  await ensureSelfIgnored(directory)
  // Token first, so a CLI that already sees the new endpoint can authenticate to it.
  await writeAgentToken(rootDir, token)
  // Write-then-rename so a concurrent CLI read never sees a torn file.
  const temporary = `${file}.${process.pid}.tmp`
  await rm(temporary, { force: true })
  await writeFile(temporary, `${JSON.stringify({ ...endpoint, pid: process.pid }, null, 2)}\n`, {
    mode: 0o600,
    flag: 'wx',
  })
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

export async function removeDiscoveryFile(rootDir: string): Promise<void> {
  await removeAgentToken(rootDir)
  try {
    await rm(join(rootDir, GENIE_DISCOVERY_FILE))
  } catch {
    // discovery file may not exist; ignore
  }
}
