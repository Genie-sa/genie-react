import { createHash } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  type Stats,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { EXEC_PREFIX, type PackageManager } from './package-manager'

const SKILL_FILE_NAMES = ['SKILL.md', 'APP_TOOLS.md', 'EVIDENCE.md'] as const
/** Read by Codex, Cursor, and other Agent Skills clients; the copy every other location mirrors. */
export const CANONICAL_SKILL_DIRECTORY = '.agents/skills/genie'
/** Claude Code discovers project skills only under `.claude/skills`. */
export const CLAUDE_SKILL_DIRECTORY = '.claude/skills/genie'
const SOURCE_INVOCATION = 'npx genie-react'

export type SkillFiles = ReadonlyArray<readonly [name: string, contents: string]>
export type SkillLink = 'symlink' | 'copy'

export interface SkillArtifact {
  kind: 'agent_skill'
  path: string
  status: 'planned' | 'applied' | 'already' | 'manual'
  reason?: string
  link?: SkillLink
}

export interface SkillLocation {
  path: string
  symlink: boolean
  version: string | null
  hash: string | null
  current: boolean
}

export function readSkillFiles(directory: string): SkillFiles | null {
  const files = SKILL_FILE_NAMES.map((name) => [name, readFileSafe(join(directory, name))] as const)
  return files.every(([, contents]) => contents !== '') ? files : null
}

/** The source skill is written for npm; installs use the project's own exec so commands run verbatim. */
export function renderSkillFiles(files: SkillFiles, manager: PackageManager | null): SkillFiles {
  const invocation = `${EXEC_PREFIX[manager ?? 'npm']} genie-react`
  return files.map(([name, contents]) => [name, contents.replaceAll(SOURCE_INVOCATION, invocation)])
}

export function installAgentSkill(
  cwd: string,
  files: SkillFiles,
  dryRun: boolean,
): SkillArtifact[] {
  const canonical = join(cwd, CANONICAL_SKILL_DIRECTORY)
  return [
    ...writeSkillFiles(canonical, files, dryRun),
    ...mirrorSkill(join(cwd, CLAUDE_SKILL_DIRECTORY), canonical, files, dryRun),
  ]
}

export function inspectAgentSkill(cwd: string, expected: SkillFiles | null) {
  const root = findSkillRoot(cwd) ?? cwd
  const expectedHash = expected ? hashSkill(expected) : null
  const inspect = (path: string): SkillLocation => {
    const installed = SKILL_FILE_NAMES.map(
      (name) => [name, readFileSafe(join(path, name))] as const,
    )
    const hasSkill = installed.some(([name, contents]) => name === 'SKILL.md' && contents)
    const hash = hasSkill ? hashSkill(installed) : null
    return {
      path,
      symlink: lstatSafe(path)?.isSymbolicLink() ?? false,
      version: skillVersion(installed),
      hash,
      current: expectedHash !== null && hash === expectedHash,
    }
  }
  return {
    expectedHash,
    canonical: inspect(join(root, CANONICAL_SKILL_DIRECTORY)),
    claude: inspect(join(root, CLAUDE_SKILL_DIRECTORY)),
  }
}

function writeSkillFiles(
  directory: string,
  files: SkillFiles,
  dryRun: boolean,
  link?: SkillLink,
): SkillArtifact[] {
  const artifacts = files.map(
    ([name, contents]): SkillArtifact => ({
      kind: 'agent_skill',
      path: join(directory, name),
      status:
        readFileSafe(join(directory, name)) === contents
          ? 'already'
          : dryRun
            ? 'planned'
            : 'applied',
      ...(link ? { link } : {}),
    }),
  )
  if (!dryRun && artifacts.some(({ status }) => status === 'applied')) {
    mkdirSync(directory, { recursive: true })
    for (const [name, contents] of files) writeFileSync(join(directory, name), contents)
  }
  return artifacts
}

function mirrorSkill(
  path: string,
  canonical: string,
  files: SkillFiles,
  dryRun: boolean,
): SkillArtifact[] {
  const artifact = { kind: 'agent_skill', path } as const
  const entry = lstatSafe(path)
  if (entry?.isSymbolicLink()) {
    return [
      linksTo(path, canonical)
        ? { ...artifact, status: 'already', link: 'symlink' }
        : { ...artifact, status: 'manual', reason: 'skill_path_conflict', link: 'symlink' },
    ]
  }
  if (entry?.isDirectory()) return writeSkillFiles(path, files, dryRun, 'copy')
  if (entry) return [{ ...artifact, status: 'manual', reason: 'skill_path_conflict' }]
  if (dryRun) return [{ ...artifact, status: 'planned', link: 'symlink' }]
  mkdirSync(dirname(path), { recursive: true })
  if (trySymlink(relative(dirname(path), canonical), path)) {
    return [{ ...artifact, status: 'applied', link: 'symlink' }]
  }
  return writeSkillFiles(path, files, false, 'copy')
}

// Windows without Developer Mode and some mounted filesystems refuse symlinks; the caller copies instead.
function trySymlink(target: string, path: string): boolean {
  try {
    symlinkSync(target, path, 'dir')
    return true
  } catch {
    return false
  }
}

function linksTo(path: string, target: string): boolean {
  if (resolve(dirname(path), readlinkSync(path)) === target) return true
  const linked = realpathSafe(path)
  return linked !== null && linked === realpathSafe(target)
}

function findSkillRoot(cwd: string): string | null {
  let directory = cwd
  while (true) {
    if (
      existsSync(join(directory, CANONICAL_SKILL_DIRECTORY, 'SKILL.md')) ||
      existsSync(join(directory, CLAUDE_SKILL_DIRECTORY, 'SKILL.md'))
    ) {
      return directory
    }
    const parent = dirname(directory)
    if (parent === directory) return null
    directory = parent
  }
}

export function skillVersion(files: SkillFiles | null): string | null {
  const markdown = files?.find(([name]) => name === 'SKILL.md')?.[1] ?? ''
  return /^\s*version:\s*["']?([^\s"']+)/m.exec(markdown)?.[1] ?? null
}

function hashSkill(files: SkillFiles): string {
  return createHash('sha256')
    .update(files.map(([, contents]) => contents).join('\0'))
    .digest('hex')
}

function lstatSafe(path: string): Stats | null {
  try {
    return lstatSync(path)
  } catch {
    return null
  }
}

function realpathSafe(path: string): string | null {
  try {
    return realpathSync(path)
  } catch {
    return null
  }
}

function readFileSafe(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}
