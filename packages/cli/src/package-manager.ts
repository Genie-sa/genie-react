import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

export type PackageManager = 'npm' | 'pnpm' | 'yarn-berry' | 'yarn-classic' | 'bun'

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
  /** Runs a package.json script by name. */
  run: readonly string[]
}

const COMMANDS: Record<PackageManager, PackageManagerCommands> = {
  npm: {
    exec: ['npx'],
    add: ['npm', 'install', '-D'],
    dev: ['npm', 'run', 'dev'],
    run: ['npm', 'run'],
  },
  pnpm: {
    exec: ['pnpm', 'exec'],
    add: ['pnpm', 'add', '-D'],
    dev: ['pnpm', 'dev'],
    run: ['pnpm', 'run'],
  },
  'yarn-berry': {
    exec: ['yarn'],
    add: ['yarn', 'add', '-D'],
    dev: ['yarn', 'dev'],
    run: ['yarn', 'run'],
  },
  'yarn-classic': {
    exec: ['yarn', '--silent'],
    add: ['yarn', 'add', '-D'],
    dev: ['yarn', 'dev'],
    run: ['yarn', 'run'],
  },
  bun: { exec: ['bunx'], add: ['bun', 'add', '-d'], dev: ['bun', 'dev'], run: ['bun', 'run'] },
}

/** Lockfile walk-up so a monorepo app dir reports the repo's real package manager. */
export function detectPackageManager(cwd: string): PackageManager {
  const found = findLockfile(cwd)
  if (!found) return DEFAULT_PACKAGE_MANAGER
  if (found.manager !== 'yarn') return found.manager
  return isYarnClassicLockfile(found.path) ? 'yarn-classic' : 'yarn-berry'
}

function findLockfile(cwd: string): { manager: PackageManager | 'yarn'; path: string } | null {
  for (let dir = cwd; ; dir = dirname(dir)) {
    for (const [manager, files] of LOCKFILES) {
      const lockfile = files.find((file) => existsSync(join(dir, file)))
      if (lockfile) return { manager, path: join(dir, lockfile) }
    }
    if (dirname(dir) === dir) return null
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

/** The package manager that ran this process, read from the user agent each one sets for the commands it runs, such as `pnpm/10.34.4 npm/? node/v22.23.4`. */
function invokingPackageManager(): PackageManager | null {
  const [name, version = ''] = process.env.npm_config_user_agent?.split(' ', 1)[0]?.split('/') ?? []
  switch (name) {
    case 'npm':
    case 'pnpm':
    case 'bun':
      return name
    case 'yarn':
      return version.startsWith('1.') ? 'yarn-classic' : 'yarn-berry'
    default:
      return null
  }
}

function genieInvocation(
  manager: PackageManager,
  args: readonly string[],
): { command: string; argv: string[] } {
  const argv = [...COMMANDS[manager].exec, 'genie-react', ...args]
  return { command: argv.map(shellQuote).join(' '), argv }
}

/** The `genie-react` invocation for every CLI hint: the runner the caller used, else the project's package manager. */
export function genieCommand(
  args: readonly string[],
  cwd = process.cwd(),
): { command: string; argv: string[] } {
  return genieInvocation(invokingPackageManager() ?? detectPackageManager(cwd), args)
}

/** The installed CLI binary nearest to `cwd` within the project, as a path from `cwd`; the lockfile's directory bounds the search so a binary from another project is never chosen. */
function installedGenieBin(cwd: string): string | null {
  const projectRoot = dirname(findLockfile(cwd)?.path ?? join(cwd, 'package.json'))
  for (let dir = cwd; ; dir = dirname(dir)) {
    const bin = join(dir, 'node_modules', '.bin', 'genie-react')
    if (existsSync(bin)) return relative(cwd, bin)
    if (dir === projectRoot || dirname(dir) === dir) return null
  }
}

/** What the installed skill runs: the project's binary when one is installed, since a package-manager wrapper adds 10–350 ms to every command; Windows shells and Yarn Plug'n'Play installs, which have no runnable `.bin` path, keep the project's exec command, which stays the same whichever runner wrote the skill. */
export function skillInvocation(cwd: string): string {
  const bin = process.platform === 'win32' ? null : installedGenieBin(cwd)
  return bin ?? genieInvocation(detectPackageManager(cwd), []).command
}

function shellQuote(value: string): string {
  if (/^[a-zA-Z0-9_./:@=-]+$/.test(value)) return value
  return `'${value.replaceAll("'", `'\\''`)}'`
}
