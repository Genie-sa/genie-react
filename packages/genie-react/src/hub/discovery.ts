import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { GENIE_DISCOVERY_FILE } from '../protocol'

export interface HubDiscovery {
  url: string
  port: number
}

/** Writes the discovery file the genie CLI reads to find the hub; returns the file path. */
export async function writeDiscoveryFile(rootDir: string, info: HubDiscovery): Promise<string> {
  const file = join(rootDir, GENIE_DISCOVERY_FILE)
  const directory = dirname(file)
  await mkdir(directory, { recursive: true })
  await ensureSelfIgnored(directory)
  await writeFile(file, `${JSON.stringify({ ...info, pid: process.pid }, null, 2)}\n`)
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
