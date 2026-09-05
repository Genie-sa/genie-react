import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeDiagnostic, writeJson } from './cli-output'

// The unpublished "local link" install path: symlinks a checkout into node_modules so `genie-react` and this CLI resolve normally.

const LINKABLE = [
  { dir: 'genie-react', name: 'genie-react' },
  { dir: 'cli', name: '@genie-react/cli' },
] as const
const SKILL_FILES = ['SKILL.md', 'APP_TOOLS.md'] as const

export interface LinkOptions {
  cwd?: string
  maxBytes?: number
  /** Path to the genie-react checkout. Defaults to the repo this CLI was built from. */
  genieRoot?: string
}

export function runLink(opts: LinkOptions = {}): number {
  const cwd = opts.cwd ?? process.cwd()
  let changesMayHaveApplied = false
  const packages: { name: string; path: string; target: string }[] = []
  const fail = (reason: string, message: string): number => {
    writeJson(
      {
        schemaVersion: '1.0',
        status: 'error',
        reason,
        message,
        userActionRequired: true,
        data: { packages, changesMayHaveApplied },
        next: {
          command: 'genie-react link <path-to-genie-react>',
          argv: ['genie-react', 'link', '<path-to-genie-react>'],
        },
      },
      opts.maxBytes,
    )
    return 1
  }
  try {
    const genieRoot = opts.genieRoot ?? detectGenieRoot()
    if (!genieRoot) return fail('checkout_not_found', 'Provide the path to a Genie checkout.')
    const packagesDir = join(genieRoot, 'packages')
    if (!existsSync(packagesDir))
      return fail('invalid_checkout', 'The checkout must contain a packages directory.')
    let missingDist = false
    for (const pkg of LINKABLE) {
      const target = join(packagesDir, pkg.dir)
      if (!existsSync(join(target, 'package.json'))) continue
      if (!existsSync(join(target, 'dist'))) missingDist = true
      const linkPath = join(cwd, 'node_modules', pkg.name)
      changesMayHaveApplied = true
      mkdirSync(dirname(linkPath), { recursive: true })
      rmSync(linkPath, { recursive: true, force: true })
      symlinkSync(target, linkPath, 'dir')
      packages.push({ name: pkg.name, path: linkPath, target })
    }
    if (packages.length === 0)
      return fail('packages_not_found', 'The checkout contains no linkable Genie packages.')
    const binPath = missingDist ? null : dropGenieBin(cwd, packagesDir)
    const skillPath = installAgentSkill(cwd, packagesDir)
    if (!skillPath)
      writeDiagnostic(
        'bundled_skill_missing',
        'Rebuild or reinstall the CLI package to restore its bundled skill.',
      )
    if (missingDist)
      writeDiagnostic('build_required', 'Build the packages in the Genie checkout.', {
        next: { command: 'pnpm -r build', argv: ['pnpm', '-r', 'build'], cwd: genieRoot },
      })
    writeJson(
      {
        schemaVersion: '1.0',
        status: 'ok',
        reason: 'packages_linked',
        message: 'Linked the local Genie packages.',
        userActionRequired: missingDist || !skillPath,
        data: {
          packages,
          binPath,
          skillPaths: skillPath ? SKILL_FILES.map((name) => join(dirname(skillPath), name)) : [],
          buildRequired: missingDist,
        },
        next: { command: 'genie-react init --dry-run', argv: ['genie-react', 'init', '--dry-run'] },
      },
      opts.maxBytes,
    )
    return 0
  } catch {
    return fail(
      'link_failed',
      'Failed to link local packages. Check file permissions and inspect the installed links before retrying.',
    )
  }
}

function installAgentSkill(cwd: string, packagesDir: string): string | null {
  const sourceDirectory = join(packagesDir, 'cli', 'skill')
  if (SKILL_FILES.some((name) => !existsSync(join(sourceDirectory, name)))) return null
  const destinationDirectory = join(cwd, '.agents', 'skills', 'genie')
  mkdirSync(destinationDirectory, { recursive: true })
  for (const name of SKILL_FILES) {
    writeFileSync(join(destinationDirectory, name), readFileSync(join(sourceDirectory, name)))
  }
  return join(destinationDirectory, 'SKILL.md')
}

function dropGenieBin(cwd: string, packagesDir: string): string | null {
  const cliBin = join(packagesDir, 'cli', 'dist', 'cli.js')
  if (!existsSync(cliBin)) return null
  const binDir = join(cwd, 'node_modules', '.bin')
  mkdirSync(binDir, { recursive: true })
  const binPath = join(binDir, 'genie-react')
  rmSync(binPath, { force: true })
  symlinkSync(cliBin, binPath, 'file')
  return binPath
}

function detectGenieRoot(): string | null {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let depth = 0; depth < 8; depth++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml')) && existsSync(join(dir, 'packages')))
      return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}
