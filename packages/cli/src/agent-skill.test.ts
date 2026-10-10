import { symlinkSync } from 'node:fs'
import { lstat, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inspectAgentSkill, installAgentSkill, type SkillFiles } from './agent-skill'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, symlinkSync: vi.fn(actual.symlinkSync) }
})

const FILES: SkillFiles = [
  [
    'SKILL.md',
    '---\nname: genie\nmetadata:\n  version: "1.0.0"\n  package: "@genie-react/cli"\n---\nnpx genie-react status\n',
  ],
  ['APP_TOOLS.md', 'app tools\n'],
  ['EVIDENCE.md', 'evidence\n'],
]

let cwd: string | undefined

afterEach(async () => {
  if (cwd) await rm(cwd, { recursive: true, force: true })
})

it('copies the Claude Code skill when the filesystem refuses symlinks', async () => {
  cwd = await mkdtemp(join(tmpdir(), 'genie-skill-copy-'))
  vi.mocked(symlinkSync).mockImplementationOnce(() => {
    throw Object.assign(new Error('operation not permitted'), { code: 'EPERM' })
  })

  const artifacts = installAgentSkill(cwd, FILES, false)
  const claude = join(cwd, '.claude/skills/genie')

  expect(artifacts.filter(({ path }) => path.startsWith(claude))).toEqual(
    FILES.map(([name]) =>
      expect.objectContaining({ path: join(claude, name), status: 'applied', link: 'copy' }),
    ),
  )
  expect((await lstat(claude)).isDirectory()).toBe(true)
  expect(await readFile(join(claude, 'SKILL.md'), 'utf8')).toBe(FILES[0]?.[1])
  expect(inspectAgentSkill(cwd, FILES).claude).toMatchObject({
    symlink: false,
    version: '1.0.0',
    current: true,
  })
})

describe('paths init does not own', () => {
  const claudePath = () => join(cwd as string, '.claude/skills/genie')
  const canonicalPath = () => join(cwd as string, '.agents/skills/genie')
  const conflict = (path: string) =>
    expect.objectContaining({ path, status: 'manual', reason: 'skill_path_conflict' })
  let outside: string

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'genie-skill-guard-'))
    outside = await mkdtemp(join(tmpdir(), 'genie-skill-outside-'))
    await writeFile(join(outside, 'target.md'), 'outside\n')
  })

  afterEach(async () => {
    await rm(outside, { recursive: true, force: true })
  })

  it('leaves a foreign .claude/skills/genie directory untouched', async () => {
    await mkdir(claudePath(), { recursive: true })
    await writeFile(join(claudePath(), 'SKILL.md'), '---\nname: genie\n---\nsomeone else\n')

    expect(installAgentSkill(cwd as string, FILES, false)).toContainEqual(conflict(claudePath()))
    expect(await readFile(join(claudePath(), 'SKILL.md'), 'utf8')).toBe(
      '---\nname: genie\n---\nsomeone else\n',
    )
    expect(inspectAgentSkill(cwd as string, FILES).claude).toMatchObject({
      conflictPath: claudePath(),
      current: false,
    })
  })

  it('copies instead of linking to a foreign canonical directory', async () => {
    await mkdir(canonicalPath(), { recursive: true })
    await writeFile(join(canonicalPath(), 'notes.md'), 'mine\n')

    const artifacts = installAgentSkill(cwd as string, FILES, false)
    expect(artifacts).toContainEqual(conflict(canonicalPath()))
    expect((await lstat(claudePath())).isDirectory()).toBe(true)
    expect(await readdir(canonicalPath())).toEqual(['notes.md'])
  })

  it('installs into an existing empty directory', async () => {
    await mkdir(canonicalPath(), { recursive: true })
    installAgentSkill(cwd as string, FILES, false)
    expect(inspectAgentSkill(cwd as string, FILES).canonical.current).toBe(true)
  })

  it('never writes through a skill file symlinked outside the project', async () => {
    await mkdir(claudePath(), { recursive: true })
    const linked = join(claudePath(), 'SKILL.md')
    await symlink(join(outside, 'target.md'), linked)

    expect(installAgentSkill(cwd as string, FILES, false)).toContainEqual(conflict(linked))
    expect(await readFile(join(outside, 'target.md'), 'utf8')).toBe('outside\n')
    expect(inspectAgentSkill(cwd as string, FILES).claude.conflictPath).toBe(linked)
  })

  it('never writes through a dangling skill file symlink', async () => {
    await mkdir(claudePath(), { recursive: true })
    await symlink(join(outside, 'created.md'), join(claudePath(), 'SKILL.md'))

    expect(installAgentSkill(cwd as string, FILES, false)).toContainEqual(
      conflict(join(claudePath(), 'SKILL.md')),
    )
    expect(await readdir(outside)).toEqual(['target.md'])
  })

  it.each([
    ['.claude/skills/genie', () => claudePath()],
    ['.agents/skills/genie', () => canonicalPath()],
  ])('reports a dangling %s symlink as a conflict', async (_, path) => {
    await mkdir(dirname(path()), { recursive: true })
    await symlink(join(outside, 'missing'), path(), 'dir')

    expect(installAgentSkill(cwd as string, FILES, false)).toContainEqual(conflict(path()))
    expect(await readdir(outside)).toEqual(['target.md'])
    expect(installAgentSkill(cwd as string, FILES, true)).toContainEqual(conflict(path()))
  })

  it.each([
    ['symlinked outside the project', (path: string) => symlink(outside, path, 'dir')],
    ['a file', (path: string) => writeFile(path, 'not a directory\n')],
  ])('names a .agents parent that is %s as the path to fix', async (_, occupy) => {
    const parent = join(cwd as string, '.agents')
    await occupy(parent)

    expect(installAgentSkill(cwd as string, FILES, false)).toContainEqual(conflict(parent))
    expect(await readdir(outside)).toEqual(['target.md'])
    expect(inspectAgentSkill(cwd as string, FILES).canonical.conflictPath).toBe(parent)
  })

  it('names a .claude parent symlinked outside the project as the path to fix', async () => {
    const parent = join(cwd as string, '.claude')
    await symlink(outside, parent, 'dir')

    expect(installAgentSkill(cwd as string, FILES, false)).toContainEqual(conflict(parent))
    expect(await readdir(outside)).toEqual(['target.md'])
    expect(inspectAgentSkill(cwd as string, FILES).claude.conflictPath).toBe(parent)
  })

  it('reports a .claude/skills/genie symlink to another directory', async () => {
    await mkdir(dirname(claudePath()), { recursive: true })
    await symlink(outside, claudePath(), 'dir')

    expect(installAgentSkill(cwd as string, FILES, false)).toContainEqual(conflict(claudePath()))
    expect(inspectAgentSkill(cwd as string, FILES).claude).toMatchObject({
      symlink: true,
      conflictPath: claudePath(),
    })
  })
})
