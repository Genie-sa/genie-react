import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type PackageManager = 'pnpm' | 'yarn' | 'bun' | 'npm'

const LOCKFILES: ReadonlyArray<readonly [PackageManager, readonly string[]]> = [
  ['pnpm', ['pnpm-lock.yaml']],
  ['yarn', ['yarn.lock']],
  ['bun', ['bun.lock', 'bun.lockb']],
  ['npm', ['package-lock.json']],
]

/** Lockfile walk-up so a monorepo app dir reports the repo's real package manager. */
export function detectPackageManager(cwd: string): PackageManager | null {
  let dir = cwd
  while (true) {
    for (const [manager, files] of LOCKFILES) {
      if (files.some((file) => existsSync(join(dir, file)))) return manager
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/** The command that runs a locally installed bin without consulting a global store. */
export const EXEC_PREFIX: Record<PackageManager, string> = {
  npm: 'npx',
  pnpm: 'pnpm exec',
  yarn: 'yarn',
  bun: 'bunx',
}
