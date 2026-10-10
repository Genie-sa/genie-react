import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { GENIE_DISCOVERY_FILE } from '../protocol'

export interface HubDiscovery {
  url: string
  port: number
  /** Agent token the hub requires; the file is owner-only because it grants full tool access. */
  token: string
}

/** Writes the discovery file the genie CLI reads to find and authenticate to the hub; returns the file path. */
export async function writeDiscoveryFile(rootDir: string, info: HubDiscovery): Promise<string> {
  const file = join(rootDir, GENIE_DISCOVERY_FILE)
  const directory = dirname(file)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await ensureSelfIgnored(directory)
  // Write-then-rename so a concurrent CLI read never sees a torn file, and the token is never world-readable even briefly.
  const temporary = `${file}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify({ ...info, pid: process.pid }, null, 2)}\n`, {
    mode: 0o600,
  })
  await chmod(temporary, 0o600)
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
  try {
    await rm(join(rootDir, GENIE_DISCOVERY_FILE))
  } catch {
    // discovery file may not exist; ignore
  }
}
