import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { genieCommand, skillInvocation } from './package-manager'

let pnpmProject: string

beforeEach(async () => {
  pnpmProject = await mkdtemp(join(tmpdir(), 'genie-package-manager-'))
  await writeFile(join(pnpmProject, 'pnpm-lock.yaml'), '')
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(pnpmProject, { recursive: true, force: true })
})

describe('genieCommand', () => {
  it.each([
    ['npm/10.9.2 node/v22.23.4 darwin arm64 workspaces/false', ['npx']],
    ['pnpm/10.34.4 npm/? node/v22.23.4 darwin arm64', ['pnpm', 'exec']],
    ['yarn/1.22.22 npm/? node/v22.23.4 darwin arm64', ['yarn', '--silent']],
    ['yarn/4.9.1 npm/? node/v22.23.4 darwin arm64', ['yarn']],
    ['bun/1.3.0 npm/? node/v24.3.0 darwin arm64', ['bunx']],
  ])('suggests the runner that launched the CLI (%s)', (userAgent, runner) => {
    vi.stubEnv('npm_config_user_agent', userAgent)

    expect(genieCommand(['tools'], pnpmProject).argv).toEqual([...runner, 'genie-react', 'tools'])
  })

  it.each([
    ['no user agent', ''],
    ['an unknown runner', 'deno/2.4.0 npm/? deno/2.4.0 darwin aarch64'],
  ])("falls back to the project's package manager with %s", (_, userAgent) => {
    vi.stubEnv('npm_config_user_agent', userAgent)

    expect(genieCommand(['tools'], pnpmProject)).toEqual({
      command: 'pnpm exec genie-react tools',
      argv: ['pnpm', 'exec', 'genie-react', 'tools'],
    })
  })
})

describe('skillInvocation', () => {
  it("keeps the project's package manager whichever runner wrote the skill", () => {
    vi.stubEnv('npm_config_user_agent', 'npm/10.9.2 node/v22.23.4 darwin arm64 workspaces/false')

    expect(skillInvocation(pnpmProject)).toBe('pnpm exec genie-react')
  })
})
