import { createHash, randomUUID } from 'node:crypto'
import { constants, realpathSync } from 'node:fs'
import { open, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  ensurePrivateDirectory,
  genieUserDirectory,
  isOwnedByCurrentUser,
} from './private-directory'

const PRIVATE_FILE_MODE = 0o600

/** Keeps the token outside any web-served project root, in the verified per-user directory. */
export function agentTokenDirectory(): string {
  return genieUserDirectory()
}

/** The token file for an app root, keyed by the root's realpath so the hub and CLI agree across symlinked paths. */
export async function agentTokenFile(rootDir: string): Promise<string> {
  return tokenFileForRealRoot(await realpath(rootDir))
}

/** {@link agentTokenFile} for exit handlers, where no promise settles before the process ends. */
export function agentTokenFileSync(rootDir: string): string {
  return tokenFileForRealRoot(realpathSync(rootDir))
}

function tokenFileForRealRoot(realRoot: string): string {
  const digest = createHash('sha256').update(realRoot).digest('hex')
  return join(agentTokenDirectory(), `${digest}.json`)
}

/** Publishes the hub's agent token for `rootDir`; returns the file path. `instance` names the publication, so only the hub that wrote it removes it. */
export async function writeAgentToken(
  rootDir: string,
  token: string,
  instance?: string,
): Promise<string> {
  ensurePrivateDirectory(agentTokenDirectory())
  const file = await agentTokenFile(rootDir)
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify({ token, pid: process.pid, instance })}\n`, {
    mode: PRIVATE_FILE_MODE,
    flag: 'wx',
  })
  await rename(temporary, file)
  return file
}

/** The token a hub published for `rootDir`; undefined unless it is a private regular file owned by the current user. */
export async function readAgentToken(rootDir: string): Promise<string | undefined> {
  const file = await agentTokenFile(rootDir).catch(() => null)
  return file === null ? undefined : readAgentTokenFile(file)
}

/** Reads a token file by path, with the same private-regular-file checks as {@link readAgentToken}. */
export async function readAgentTokenFile(file: string): Promise<string | undefined> {
  const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)).catch(
    () => null,
  )
  if (!handle) return undefined
  try {
    const info = await handle.stat()
    if (!info.isFile() || !isOwnedPrivately(info.uid, info.mode)) return undefined
    const parsed: unknown = JSON.parse(await handle.readFile('utf8'))
    return typeof parsed === 'object' &&
      parsed !== null &&
      'token' in parsed &&
      typeof parsed.token === 'string'
      ? parsed.token
      : undefined
  } catch {
    return undefined
  } finally {
    await handle.close()
  }
}

export async function removeAgentToken(rootDir: string): Promise<void> {
  try {
    await rm(await agentTokenFile(rootDir), { force: true })
  } catch {
    // the root vanished, so there is no key to locate a token by; ignore
  }
}

function isOwnedPrivately(uid: number, mode: number): boolean {
  return isOwnedByCurrentUser(uid) && (process.getuid === undefined || (mode & 0o077) === 0)
}
