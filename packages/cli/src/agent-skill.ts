import { createHash, randomUUID } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  type Stats,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { genieCommand } from './package-manager'

const SKILL_FILE_NAMES = ['SKILL.md', 'APP_TOOLS.md', 'EVIDENCE.md'] as const
/** Read by Codex, Cursor, and other Agent Skills clients; the copy every other location mirrors. */
export const CANONICAL_SKILL_DIRECTORY = '.agents/skills/genie'
/** Claude Code discovers project skills only under `.claude/skills`. */
export const CLAUDE_SKILL_DIRECTORY = '.claude/skills/genie'
export const SKILL_PATH_CONFLICT = 'skill_path_conflict'
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
  /** Something other than Genie's skill occupies the path, so init leaves it alone. */
  conflict: boolean
  version: string | null
  hash: string | null
  current: boolean
}

/** Paths are checked against the project's real path so no write lands outside it through a symlink. */
interface Project {
  cwd: string
  real: string
}

export function readSkillFiles(directory: string): SkillFiles | null {
  const files = SKILL_FILE_NAMES.map((name) => [name, readFileSafe(join(directory, name))] as const)
  return files.every(([, contents]) => contents !== '') ? files : null
}

/** The source skill is written for npm; installs use the project's own exec so commands run verbatim. */
export function renderSkillFiles(files: SkillFiles, cwd: string): SkillFiles {
  const invocation = genieCommand([], cwd).command
  return files.map(([name, contents]) => [name, contents.replaceAll(SOURCE_INVOCATION, invocation)])
}

export function installAgentSkill(
  cwd: string,
  files: SkillFiles,
  dryRun: boolean,
): SkillArtifact[] {
  const project = { cwd, real: realpathSync(cwd) }
  const canonical = join(cwd, CANONICAL_SKILL_DIRECTORY)
  const canonicalArtifacts = placeSkillDirectory(project, canonical, files, dryRun)
  const canonicalOwned = canonicalArtifacts.every(({ status }) => status !== 'manual')
  const claude = join(cwd, CLAUDE_SKILL_DIRECTORY)
  return [
    ...canonicalArtifacts,
    ...mirrorSkill(project, claude, canonical, canonicalOwned, files, dryRun),
  ]
}

export function inspectAgentSkill(cwd: string, expected: SkillFiles | null) {
  const root = findSkillRoot(cwd) ?? cwd
  const project = { cwd: root, real: realpathSafe(root) ?? root }
  const expectedHash = expected ? hashSkill(expected) : null
  const inspect = (path: string, conflict: boolean): SkillLocation => {
    const installed = SKILL_FILE_NAMES.map(
      (name) => [name, readFileSafe(join(path, name))] as const,
    )
    const hasSkill = installed.some(([name, contents]) => name === 'SKILL.md' && contents)
    const hash = hasSkill ? hashSkill(installed) : null
    return {
      path,
      symlink: lstatSafe(path)?.isSymbolicLink() ?? false,
      conflict,
      version: skillVersion(installed),
      hash,
      current: !conflict && expectedHash !== null && hash === expectedHash,
    }
  }
  const canonicalPath = join(root, CANONICAL_SKILL_DIRECTORY)
  const claudePath = join(root, CLAUDE_SKILL_DIRECTORY)
  const canonical = inspect(canonicalPath, occupant(project, canonicalPath) === 'foreign')
  const claudeConflict = lstatSafe(claudePath)?.isSymbolicLink()
    ? canonical.conflict || !linksTo(claudePath, canonicalPath)
    : occupant(project, claudePath) === 'foreign'
  return { expectedHash, canonical, claude: inspect(claudePath, claudeConflict) }
}

/** Writes into an empty or Genie-owned directory; anything else is reported, never overwritten. */
function placeSkillDirectory(
  project: Project,
  directory: string,
  files: SkillFiles,
  dryRun: boolean,
  link?: SkillLink,
): SkillArtifact[] {
  if (occupant(project, directory) === 'foreign') return [conflictArtifact(directory, link)]
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
  if (dryRun || artifacts.every(({ status }) => status === 'already')) return artifacts
  mkdirSync(directory, { recursive: true })
  const real = realpathSync(directory)
  if (!isInside(project.real, real)) return [conflictArtifact(directory, link)]
  files.forEach(([name, contents], index) => {
    if (artifacts[index]?.status === 'applied') replaceFile(real, name, contents)
  })
  return artifacts
}

function mirrorSkill(
  project: Project,
  path: string,
  canonical: string,
  canonicalOwned: boolean,
  files: SkillFiles,
  dryRun: boolean,
): SkillArtifact[] {
  const entry = lstatSafe(path)
  if (entry?.isSymbolicLink()) {
    return [
      canonicalOwned && linksTo(path, canonical)
        ? { kind: 'agent_skill', path, status: 'already', link: 'symlink' }
        : conflictArtifact(path, 'symlink'),
    ]
  }
  if (entry || !canonicalOwned) return placeSkillDirectory(project, path, files, dryRun, 'copy')
  if (escapesProject(project, dirname(path))) return [conflictArtifact(path, 'symlink')]
  if (dryRun) return [{ kind: 'agent_skill', path, status: 'planned', link: 'symlink' }]
  mkdirSync(dirname(path), { recursive: true })
  if (trySymlink(relative(dirname(path), canonical), path)) {
    return [{ kind: 'agent_skill', path, status: 'applied', link: 'symlink' }]
  }
  return placeSkillDirectory(project, path, files, false, 'copy')
}

function conflictArtifact(path: string, link?: SkillLink): SkillArtifact {
  return {
    kind: 'agent_skill',
    path,
    status: 'manual',
    reason: SKILL_PATH_CONFLICT,
    ...(link ? { link } : {}),
  }
}

/** `foreign`: a symlinked or non-directory path or skill file, a parent leaving the project, or another skill. */
function occupant(project: Project, directory: string): 'empty' | 'genie' | 'foreign' {
  if (escapesProject(project, dirname(directory))) return 'foreign'
  const entry = lstatSafe(directory)
  if (!entry) return 'empty'
  if (!entry.isDirectory()) return 'foreign'
  const skillFiles = SKILL_FILE_NAMES.map((name) => lstatSafe(join(directory, name)))
  if (skillFiles.some((file) => file && !file.isFile())) return 'foreign'
  if (isGenieSkill(readFileSafe(join(directory, 'SKILL.md')))) return 'genie'
  return readdirSync(directory).length === 0 ? 'empty' : 'foreign'
}

/** True when an existing component between the project and `path` is a file, or a symlink that dangles or leaves the project. */
function escapesProject(project: Project, path: string): boolean {
  let current = project.cwd
  for (const segment of relative(project.cwd, path).split(sep).filter(Boolean)) {
    current = join(current, segment)
    const entry = lstatSafe(current)
    if (!entry) return false
    if (entry.isSymbolicLink()) {
      const target = realpathSafe(current)
      if (!target || !isInside(project.real, target)) return true
    } else if (!entry.isDirectory()) {
      return true
    }
  }
  return false
}

function isInside(root: string, path: string): boolean {
  return path === root || path.startsWith(`${root}${sep}`)
}

/** Exclusive-create then rename, so an existing entry is replaced and never followed. */
function replaceFile(directory: string, name: string, contents: string): void {
  const temporary = join(directory, `.${name}.${randomUUID()}.tmp`)
  try {
    writeFileSync(temporary, contents, { flag: 'wx' })
    renameSync(temporary, join(directory, name))
  } catch (error) {
    rmSync(temporary, { force: true })
    throw error
  }
}

function isGenieSkill(markdown: string): boolean {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1] ?? ''
  return (
    /^name:\s*["']?genie["']?\s*$/m.test(frontmatter) &&
    /^\s*package:\s*["']?@genie-react\/cli["']?\s*$/m.test(frontmatter)
  )
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
