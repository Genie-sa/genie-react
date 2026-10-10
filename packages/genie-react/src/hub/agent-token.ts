import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { chmod, lstat, mkdir, open, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PRIVATE_FILE_MODE = 0o600
const PRIVATE_DIRECTORY_MODE = 0o700

/** Keeps the token outside any web-served project root: a verified per-uid 0700 dir on POSIX; on Windows the per-user temp dir's ACL. */
export function agentTokenDirectory(): string {
  const base = process.env.XDG_RUNTIME_DIR || tmpdir()
  return join(base, `genie-react-${process.getuid?.() ?? 'user'}`)
}

/** The token file for an app root, keyed by the root's realpath so the hub and CLI agree across symlinked paths. */
export async function agentTokenFile(rootDir: string): Promise<string> {
  const digest = createHash('sha256')
    .update(await realpath(rootDir))
    .digest('hex')
  return join(agentTokenDirectory(), `${digest}.json`)
}

/** Publishes the hub's agent token for `rootDir`; returns the file path. */
export async function writeAgentToken(rootDir: string, token: string): Promise<string> {
  await ensurePrivateDirectory(agentTokenDirectory())
  const file = await agentTokenFile(rootDir)
  const temporary = `${file}.${process.pid}.tmp`
  await rm(temporary, { force: true })
  await writeFile(temporary, `${JSON.stringify({ token, pid: process.pid })}\n`, {
    mode: PRIVATE_FILE_MODE,
    flag: 'wx',
  })
  await rename(temporary, file)
  return file
}

/** The token a hub published for `rootDir`; undefined unless it is a private regular file owned by the current user. */
export async function readAgentToken(rootDir: string): Promise<string | undefined> {
  const handle = await agentTokenFile(rootDir)
    .then((file) => open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)))
    .catch(() => null)
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

async function ensurePrivateDirectory(directory: string): Promise<void> {
  try {
    await mkdir(directory, { mode: PRIVATE_DIRECTORY_MODE })
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error
  }
  const info = await lstat(directory)
  // A directory or symlink pre-created by another user in a shared temp dir would let them read or swap the token.
  if (!info.isDirectory() || !isOwnedByCurrentUser(info.uid)) {
    throw new Error(
      `genie-react: refusing to store the agent token in ${directory}: it is not a directory owned by the current user`,
    )
  }
  if (process.getuid && (info.mode & 0o077) !== 0) await chmod(directory, PRIVATE_DIRECTORY_MODE)
}

function isOwnedByCurrentUser(uid: number): boolean {
  return process.getuid === undefined || uid === process.getuid()
}

function isOwnedPrivately(uid: number, mode: number): boolean {
  return isOwnedByCurrentUser(uid) && (process.getuid === undefined || (mode & 0o077) === 0)
}
