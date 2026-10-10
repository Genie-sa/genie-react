import { chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  agentTokenDirectory,
  agentTokenFile,
  readAgentToken,
  removeAgentToken,
  writeAgentToken,
} from './agent-token'

const posix = process.platform !== 'win32'

describe('agent token store', () => {
  let runtime: string
  let root: string

  beforeEach(async () => {
    runtime = await mkdtemp(join(tmpdir(), 'genie-token-runtime-'))
    root = await mkdtemp(join(tmpdir(), 'genie-token-root-'))
    vi.stubEnv('XDG_RUNTIME_DIR', runtime)
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(runtime, { recursive: true, force: true })
    await rm(root, { recursive: true, force: true })
  })

  it('stores the token outside the app root in a private per-user directory', async () => {
    const file = await writeAgentToken(root, 'secret')

    expect(file.startsWith(agentTokenDirectory())).toBe(true)
    expect(file.startsWith(root)).toBe(false)
    expect(await readAgentToken(root)).toBe('secret')
    if (posix) {
      expect((await stat(agentTokenDirectory())).mode & 0o777).toBe(0o700)
      expect((await stat(file)).mode & 0o777).toBe(0o600)
    }
  })

  it('keys the file by the realpath, so a symlinked root finds the same token', async () => {
    const alias = join(runtime, 'alias')
    await symlink(root, alias)
    await writeAgentToken(alias, 'secret')

    expect(await agentTokenFile(alias)).toBe(await agentTokenFile(root))
    expect(await readAgentToken(root)).toBe('secret')
  })

  it('replaces a stale token and removes it on shutdown', async () => {
    await writeAgentToken(root, 'old')
    await writeAgentToken(root, 'new')
    expect(await readAgentToken(root)).toBe('new')

    await removeAgentToken(root)
    expect(await readAgentToken(root)).toBeUndefined()
  })

  it.runIf(posix)(
    'replaces a planted temp-file symlink instead of writing through it',
    async () => {
      const victim = join(runtime, 'victim')
      await writeFile(victim, 'untouched')
      await writeAgentToken(root, 'first')
      await symlink(victim, `${await agentTokenFile(root)}.${process.pid}.tmp`)

      await writeAgentToken(root, 'second')

      expect(await readFile(victim, 'utf8')).toBe('untouched')
      expect(await readAgentToken(root)).toBe('second')
    },
  )

  it.runIf(posix)('refuses a token directory that is a symlink', async () => {
    const elsewhere = await mkdtemp(join(tmpdir(), 'genie-token-elsewhere-'))
    try {
      await symlink(elsewhere, agentTokenDirectory())
      await expect(writeAgentToken(root, 'secret')).rejects.toThrow(/refusing to use/)
    } finally {
      await rm(elsewhere, { recursive: true, force: true })
    }
  })

  it.runIf(posix)('tightens a loosened directory back to 0700', async () => {
    await mkdir(agentTokenDirectory(), { mode: 0o755 })
    await chmod(agentTokenDirectory(), 0o755)
    await writeAgentToken(root, 'secret')

    expect((await stat(agentTokenDirectory())).mode & 0o777).toBe(0o700)
  })

  it.runIf(posix)('ignores token files that are symlinks or readable by others', async () => {
    const file = await writeAgentToken(root, 'secret')
    await chmod(file, 0o644)
    expect(await readAgentToken(root)).toBeUndefined()

    const decoy = join(runtime, 'decoy.json')
    await writeFile(decoy, JSON.stringify({ token: 'planted' }), { mode: 0o600 })
    await rm(file)
    await symlink(decoy, file)
    expect(await readAgentToken(root)).toBeUndefined()
  })

  it('reads nothing for a root that never published a token', async () => {
    expect(await readAgentToken(root)).toBeUndefined()
    expect(await readAgentToken(join(root, 'missing'))).toBeUndefined()
  })
})
