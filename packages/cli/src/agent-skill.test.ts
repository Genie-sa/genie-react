import { symlinkSync } from 'node:fs'
import { lstat, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { inspectAgentSkill, installAgentSkill, type SkillFiles } from './agent-skill'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, symlinkSync: vi.fn(actual.symlinkSync) }
})

const FILES: SkillFiles = [
  ['SKILL.md', '---\nmetadata:\n  version: "1.0.0"\n---\nnpx genie-react status\n'],
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
