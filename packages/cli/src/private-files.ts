import { lstatSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { isOwnedByCurrentUser } from 'genie-react/hub/token'

export interface RetentionPolicy {
  /** Files kept whatever their age. */
  keep: number
  /** Beyond `keep`, files younger than this survive: another agent may have just been told to read one. */
  minAgeMs: number
  /** Disk bound under sustained load: beyond this count the oldest go even when young. */
  hardCap: number
}

/** One hour covers any agent turn between being given a path and reading it. */
export const SHARED_FILE_RETENTION: RetentionPolicy = {
  keep: 20,
  minAgeMs: 60 * 60_000,
  hardCap: 200,
}

/** Removes our own regular files matching `pattern` that the policy no longer protects; anything else in the directory is left alone. */
export function pruneOwnFiles(
  directory: string,
  pattern: RegExp,
  policy: RetentionPolicy = SHARED_FILE_RETENTION,
  now: number = Date.now(),
): void {
  let names: string[]
  try {
    names = readdirSync(directory).filter((name) => pattern.test(name))
  } catch {
    return
  }
  const files = names.flatMap((name) => {
    const path = join(directory, name)
    try {
      const info = lstatSync(path)
      return info.isFile() && isOwnedByCurrentUser(info.uid)
        ? [{ path, modified: info.mtimeMs }]
        : []
    } catch {
      return []
    }
  })
  files.sort((left, right) => right.modified - left.modified)
  files.forEach((file, index) => {
    const expired = index >= policy.keep && now - file.modified >= policy.minAgeMs
    if (!expired && index < policy.hardCap) return
    try {
      rmSync(file.path)
    } catch {}
  })
}
