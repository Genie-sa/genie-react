import { chmodSync, lstatSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PRIVATE_DIRECTORY_MODE = 0o700

/** Per-user state outside any web-served project root, shared by the hub's agent tokens and the CLI's output spills. */
export function genieUserDirectory(): string {
  const base = process.env.XDG_RUNTIME_DIR || tmpdir()
  return join(base, `genie-react-${process.getuid?.() ?? 'user'}`)
}

/** Accepts only a real directory owned by us, then forces 0700: another user's pre-created dir or symlink could read or swap our files. */
export function ensurePrivateDirectory(directory: string): void {
  try {
    mkdirSync(directory, { mode: PRIVATE_DIRECTORY_MODE })
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error
  }
  const info = lstatSync(directory)
  if (!info.isDirectory() || !isOwnedByCurrentUser(info.uid)) {
    throw new Error(
      `genie-react: refusing to use ${directory}: it is not a directory owned by the current user`,
    )
  }
  if (process.getuid !== undefined && (info.mode & 0o777) !== PRIVATE_DIRECTORY_MODE) {
    chmodSync(directory, PRIVATE_DIRECTORY_MODE)
  }
}

export function isOwnedByCurrentUser(uid: number): boolean {
  return process.getuid === undefined || uid === process.getuid()
}
