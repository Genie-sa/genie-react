import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

type PackageManager = 'npm' | 'pnpm' | 'yarn-berry' | 'yarn-classic' | 'bun'

/** Without a lockfile, npm: it ships with Node, so every suggested command runs as written. */
const DEFAULT_PACKAGE_MANAGER: PackageManager = 'npm'

const LOCKFILES: ReadonlyArray<readonly [PackageManager | 'yarn', readonly string[]]> = [
  ['pnpm', ['pnpm-lock.yaml']],
  ['yarn', ['yarn.lock']],
  ['bun', ['bun.lock', 'bun.lockb']],
  ['npm', ['package-lock.json']],
]

interface PackageManagerCommands {
  /** Runs a locally installed bin without consulting a global store; Yarn 1 needs --silent to keep stdout pure JSON. */
  exec: readonly string[]
  add: readonly string[]
  dev: readonly string[]
}

const COMMANDS: Record<PackageManager, PackageManagerCommands> = {
  npm: { exec: ['npx'], add: ['npm', 'install', '-D'], dev: ['npm', 'run', 'dev'] },
  pnpm: { exec: ['pnpm', 'exec'], add: ['pnpm', 'add', '-D'], dev: ['pnpm', 'dev'] },
  'yarn-berry': { exec: ['yarn'], add: ['yarn', 'add', '-D'], dev: ['yarn', 'dev'] },
  'yarn-classic': { exec: ['yarn', '--silent'], add: ['yarn', 'add', '-D'], dev: ['yarn', 'dev'] },
  bun: { exec: ['bunx'], add: ['bun', 'add', '-d'], dev: ['bun', 'dev'] },
}

/** Lockfile walk-up so a monorepo app dir reports the repo's real package manager. */
function detectPackageManager(cwd: string): PackageManager {
  let dir = cwd
  while (true) {
    for (const [manager, files] of LOCKFILES) {
      const lockfile = files.find((file) => existsSync(join(dir, file)))
      if (!lockfile) continue
      if (manager !== 'yarn') return manager
      return isYarnClassicLockfile(join(dir, lockfile)) ? 'yarn-classic' : 'yarn-berry'
    }
    const parent = dirname(dir)
    if (parent === dir) return DEFAULT_PACKAGE_MANAGER
    dir = parent
  }
}

function isYarnClassicLockfile(path: string): boolean {
  try {
    return readFileSync(path, 'utf8').includes('# yarn lockfile v1')
  } catch {
    return false
  }
}

export function packageManagerCommands(cwd: string): PackageManagerCommands {
  return COMMANDS[detectPackageManager(cwd)]
}

/** The `genie-react` invocation for this project, shared by the installed skill and every CLI hint. */
export function genieCommand(
  args: readonly string[],
  cwd = process.cwd(),
): { command: string; argv: string[] } {
  const argv = [...packageManagerCommands(cwd).exec, 'genie-react', ...args]
  return { command: argv.map(shellQuote).join(' '), argv }
}

function shellQuote(value: string): string {
  if (/^[a-zA-Z0-9_./:@=-]+$/.test(value)) return value
  return `'${value.replaceAll("'", `'\\''`)}'`
}
