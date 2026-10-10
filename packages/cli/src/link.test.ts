import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runLink } from './link'

let target: string | null = null

afterEach(async () => {
  vi.restoreAllMocks()
  if (target) await rm(target, { recursive: true, force: true })
  target = null
})

describe('runLink', () => {
  it('installs and refreshes the versioned agent skill with the linked packages', async () => {
    target = await mkdtemp(join(tmpdir(), 'genie-link-'))
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const bundled = await readFile(join(process.cwd(), 'packages/cli/skill/SKILL.md'), 'utf8')
    const bundledAppTools = await readFile(
      join(process.cwd(), 'packages/cli/skill/APP_TOOLS.md'),
      'utf8',
    )
    const activePath = join(target, '.agents/skills/genie/SKILL.md')
    const activeAppToolsPath = join(target, '.agents/skills/genie/APP_TOOLS.md')

    expect(runLink({ cwd: target, genieRoot: process.cwd() })).toBe(0)
    expect(await readFile(activePath, 'utf8')).toBe(bundled)
    expect(await readFile(activeAppToolsPath, 'utf8')).toBe(bundledAppTools)
    expect(await readFile(join(target, '.claude/skills/genie/SKILL.md'), 'utf8')).toBe(bundled)

    await writeFile(
      activePath,
      '---\nname: genie\nmetadata:\n  package: "@genie-react/cli"\n---\nstale guidance\n',
      'utf8',
    )
    await writeFile(activeAppToolsPath, 'stale reference\n', 'utf8')
    expect(runLink({ cwd: target, genieRoot: process.cwd() })).toBe(0)
    expect(await readFile(activePath, 'utf8')).toBe(bundled)
    expect(await readFile(activeAppToolsPath, 'utf8')).toBe(bundledAppTools)
  })
})

it('emits a single receipt for missing builds and puts actionable diagnostics on stderr', async () => {
  target = await mkdtemp(join(tmpdir(), 'genie-link-json-'))
  const { mkdir } = await import('node:fs/promises')
  const checkout = join(target, 'checkout')
  await mkdir(join(checkout, 'packages/genie-react'), { recursive: true })
  await writeFile(join(checkout, 'packages/genie-react/package.json'), '{}')
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  expect(runLink({ cwd: target, genieRoot: checkout })).toBe(0)
  expect(stdout).toHaveBeenCalledTimes(1)
  expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toMatchObject({
    status: 'ok',
    reason: 'packages_linked',
    userActionRequired: true,
    data: {
      buildRequired: true,
      binPath: null,
      skillPaths: [],
      packages: [expect.objectContaining({ name: 'genie-react' })],
    },
  })
  expect(stderr.mock.calls.map(([line]) => JSON.parse(String(line)).reason)).toEqual([
    'bundled_skill_missing',
    'build_required',
  ])
})

it('does not expose hostile checkout strings in recovery commands or raw filesystem errors', async () => {
  target = await mkdtemp(join(tmpdir(), 'genie-link-json-'))
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  expect(runLink({ cwd: target, genieRoot: join(target, 'PRIVATE_TOKEN;$(touch sentinel)') })).toBe(
    1,
  )
  expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toMatchObject({
    status: 'error',
    reason: 'invalid_checkout',
    userActionRequired: true,
    data: { changesMayHaveApplied: false },
    next: { argv: ['npx', 'genie-react', 'link', '<path-to-genie-react>'] },
  })
  expect(String(stdout.mock.calls[0]?.[0])).not.toContain('PRIVATE_TOKEN')
  expect(stderr).not.toHaveBeenCalled()
})

it('reports a foreign skill directory instead of overwriting it', async () => {
  target = await mkdtemp(join(tmpdir(), 'genie-link-conflict-'))
  const foreign = join(target, '.agents/skills/genie')
  await mkdir(foreign, { recursive: true })
  await writeFile(join(foreign, 'SKILL.md'), 'another skill\n')
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)

  expect(runLink({ cwd: target, genieRoot: process.cwd() })).toBe(0)
  expect(JSON.parse(String(stdout.mock.lastCall?.[0])).data.skillPaths).toEqual([])
  expect(stderr.mock.calls.map(([line]) => JSON.parse(String(line)))).toContainEqual(
    expect.objectContaining({ reason: 'skill_path_conflict', data: { path: foreign } }),
  )
  expect(await readFile(join(foreign, 'SKILL.md'), 'utf8')).toBe('another skill\n')
})
