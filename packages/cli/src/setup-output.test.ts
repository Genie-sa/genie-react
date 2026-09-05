import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { runInitCommand } from './setup-output'

let cwd: string | undefined

afterEach(async () => {
  vi.restoreAllMocks()
  if (cwd) await rm(cwd, { recursive: true, force: true })
})

it('reports planned, applied and already-present artifacts without exposing config contents', async () => {
  cwd = await mkdtemp(join(tmpdir(), 'genie-json-init-'))
  await mkdir(join(cwd, '.git'))
  await writeFile(join(cwd, 'package.json'), JSON.stringify({ dependencies: { vite: '*' } }))
  const config = '// PRIVATE_CONFIG_SENTINEL\nexport default { plugins: [] }\n'
  await writeFile(join(cwd, 'vite.config.ts'), config)
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  const receipt = () => JSON.parse(String(stdout.mock.lastCall?.[0]))
  expect(runInitCommand({ cwd, dryRun: true })).toBe(0)
  expect(receipt().data.artifacts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'vite_config', status: 'planned' }),
      expect.objectContaining({ kind: 'gitignore', status: 'planned' }),
      expect.objectContaining({
        path: join(cwd, '.agents/skills/genie/APP_TOOLS.md'),
        status: 'planned',
      }),
    ]),
  )
  expect(await readFile(join(cwd, 'vite.config.ts'), 'utf8')).toBe(config)
  expect(existsSync(join(cwd, '.gitignore'))).toBe(false)
  expect(runInitCommand({ cwd })).toBe(0)
  expect(receipt().data.artifacts).toEqual(
    expect.arrayContaining([expect.objectContaining({ kind: 'gitignore', status: 'applied' })]),
  )
  expect(await readFile(join(cwd, '.gitignore'), 'utf8')).toBe('.genie/\n')
  expect(runInitCommand({ cwd })).toBe(0)
  expect(
    receipt().data.artifacts.filter((item: { status: string }) => item.status === 'applied'),
  ).toEqual([])
  expect(stdout).toHaveBeenCalledTimes(3)
  for (const [output] of stdout.mock.calls) {
    expect(String(output).trim().split('\n')).toHaveLength(1)
    expect(String(output)).not.toContain('PRIVATE_CONFIG_SENTINEL')
  }
  expect(stderr).not.toHaveBeenCalled()
})

it('reports incomplete manual wiring with an actionable failure and no source dump', async () => {
  cwd = await mkdtemp(join(tmpdir(), 'genie-json-manual-'))
  await writeFile(join(cwd, 'package.json'), JSON.stringify({ dependencies: { vite: '*' } }))
  await writeFile(join(cwd, 'vite.config.ts'), 'export default {}')
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  expect(runInitCommand({ cwd, dryRun: true })).toBe(1)
  expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toMatchObject({
    status: 'action_required',
    reason: 'manual_setup_required',
    userActionRequired: true,
    data: {
      artifacts: expect.arrayContaining([
        expect.objectContaining({ kind: 'vite_config', status: 'manual' }),
      ]),
    },
    next: { argv: ['genie-react', 'doctor'] },
  })
})

it('reports possible partial writes when a later setup artifact cannot be written', async () => {
  cwd = await mkdtemp(join(tmpdir(), 'genie-json-partial-'))
  await writeFile(join(cwd, 'package.json'), JSON.stringify({ dependencies: { vite: '*' } }))
  await writeFile(join(cwd, 'vite.config.ts'), 'export default { plugins: [] }')
  await writeFile(join(cwd, '.agents'), 'blocked path')
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  expect(runInitCommand({ cwd })).toBe(1)
  expect(await readFile(join(cwd, 'vite.config.ts'), 'utf8')).toContain('genie()')
  expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toMatchObject({
    status: 'error',
    reason: 'setup_failed',
    data: { changesMayHaveApplied: true },
    next: { argv: ['genie-react', 'init', '--dry-run'] },
  })
  expect(stdout).toHaveBeenCalledTimes(1)
})

it('gives universal hosts hub integration data without Vite-only manual instructions', async () => {
  cwd = await mkdtemp(join(tmpdir(), 'genie-json-universal-'))
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  expect(runInitCommand({ cwd, dryRun: true })).toBe(0)
  const result = JSON.parse(String(stdout.mock.lastCall?.[0]))
  expect(result).toMatchObject({
    data: {
      framework: 'unknown',
      integration: { scriptUrl: 'http://localhost:4390/__genie/client.js', developmentOnly: true },
    },
    next: { argv: ['genie-react', 'hub'] },
  })
  expect(result.data.manualSteps).not.toContainEqual(
    expect.objectContaining({ module: 'genie-react/vite' }),
  )
})

it('reports Next layout and instrumentation plans as separate artifacts', async () => {
  cwd = await mkdtemp(join(tmpdir(), 'genie-json-next-'))
  await writeFile(join(cwd, 'package.json'), JSON.stringify({ dependencies: { next: '*' } }))
  await mkdir(join(cwd, 'app'))
  await writeFile(
    join(cwd, 'app/layout.tsx'),
    'export default function Layout({ children }) { return <html><body>{children}</body></html> }',
  )
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  expect(runInitCommand({ cwd, dryRun: true })).toBe(0)
  expect(JSON.parse(String(stdout.mock.lastCall?.[0]))).toMatchObject({
    data: {
      framework: 'nextjs',
      artifacts: expect.arrayContaining([
        expect.objectContaining({
          kind: 'next_layout',
          status: 'planned',
          path: join(cwd, 'app/layout.tsx'),
        }),
        expect.objectContaining({
          kind: 'instrumentation',
          status: 'planned',
          path: join(cwd, 'instrumentation.ts'),
        }),
      ]),
    },
  })
  expect(existsSync(join(cwd, 'instrumentation.ts'))).toBe(false)
})

it('keeps plain Vite component wiring and package-manager next steps actionable', async () => {
  cwd = await mkdtemp(join(tmpdir(), 'genie-json-vite-'))
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({ dependencies: { react: '*', vite: '*' } }),
  )
  await writeFile(join(cwd, 'vite.config.ts'), 'export default { plugins: [] }')
  await writeFile(join(cwd, 'package-lock.json'), '{}')
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  expect(runInitCommand({ cwd, dryRun: true })).toBe(0)
  const result = JSON.parse(String(stdout.mock.lastCall?.[0]))
  expect(result.userActionRequired).toBe(true)
  expect(result.data.manualSteps).toContainEqual(
    expect.objectContaining({ module: 'genie-react', export: 'Genie' }),
  )
  expect(result.data.commands.install.argv).toContain('genie-react')
  expect(result.data.commands.install.argv.slice(0, 3)).toEqual(['npm', 'install', '-D'])
  expect(result.data.commands.dev.argv).toEqual(['npm', 'run', 'dev'])
})
