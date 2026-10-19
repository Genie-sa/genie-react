import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GENIE_DISCOVERY_FILE } from '../protocol'
import { agentTokenFile, readAgentToken } from './agent-token'
import { bridgeUrlFor, removeDiscoveryFile, writeDiscoveryFile } from './discovery'

describe('bridgeUrlFor', () => {
  it.each([
    ['127.0.0.1', 'ws://127.0.0.1:5173/__genie/ws'],
    ['::1', 'ws://[::1]:5173/__genie/ws'],
    ['0.0.0.0', 'ws://127.0.0.1:5173/__genie/ws'],
    ['::', 'ws://127.0.0.1:5173/__genie/ws'],
    ['192.168.1.20', 'ws://192.168.1.20:5173/__genie/ws'],
  ])('publishes %s as an IP literal', (address, url) => {
    expect(bridgeUrlFor(address, 5173)).toBe(url)
  })
})

describe('removeDiscoveryFile', () => {
  let runtime: string
  let root: string

  beforeEach(async () => {
    runtime = await mkdtemp(join(tmpdir(), 'genie-discovery-runtime-'))
    root = await mkdtemp(join(tmpdir(), 'genie-discovery-root-'))
    vi.stubEnv('XDG_RUNTIME_DIR', runtime)
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(runtime, { recursive: true, force: true })
    await rm(root, { recursive: true, force: true })
  })

  const info = { url: 'ws://127.0.0.1:4390/__genie/ws', port: 4390, token: 'secret' }

  it('removes the discovery and token files this process published', async () => {
    await writeDiscoveryFile(root, info)
    await removeDiscoveryFile(root)

    await expect(readFile(join(root, GENIE_DISCOVERY_FILE))).rejects.toMatchObject({
      code: 'ENOENT',
    })
    expect(await readAgentToken(root)).toBeUndefined()
  })

  it('does not take over a root another live process publishes', async () => {
    await writeDiscoveryFile(root, info)
    const livePid = process.ppid
    const discovery = JSON.parse(await readFile(join(root, GENIE_DISCOVERY_FILE), 'utf8'))
    const owned = JSON.stringify({ ...discovery, pid: livePid })
    await writeFile(join(root, GENIE_DISCOVERY_FILE), owned)

    const result = await writeDiscoveryFile(root, { ...info, port: 4391, token: 'second' })

    expect(result).toBeNull()
    expect(await readFile(join(root, GENIE_DISCOVERY_FILE), 'utf8')).toBe(owned)
    expect(await readAgentToken(root)).toBe('secret')
  })

  it('replaces a discovery file whose process is gone', async () => {
    await writeDiscoveryFile(root, info)
    const discovery = JSON.parse(await readFile(join(root, GENIE_DISCOVERY_FILE), 'utf8'))
    await writeFile(
      join(root, GENIE_DISCOVERY_FILE),
      JSON.stringify({ ...discovery, pid: 2 ** 22 + 7 }),
    )

    expect(await writeDiscoveryFile(root, { ...info, token: 'second' })).not.toBeNull()
    expect(JSON.parse(await readFile(join(root, GENIE_DISCOVERY_FILE), 'utf8')).pid).toBe(
      process.pid,
    )
  })

  it('leaves files another hub took over in place', async () => {
    await writeDiscoveryFile(root, info)
    const foreignPid = process.ppid
    const discovery = JSON.parse(await readFile(join(root, GENIE_DISCOVERY_FILE), 'utf8'))
    await writeFile(
      join(root, GENIE_DISCOVERY_FILE),
      JSON.stringify({ ...discovery, pid: foreignPid }),
    )
    await writeFile(
      await agentTokenFile(root),
      JSON.stringify({ token: 'newer', pid: foreignPid }),
      { mode: 0o600 },
    )

    await removeDiscoveryFile(root)

    expect(JSON.parse(await readFile(join(root, GENIE_DISCOVERY_FILE), 'utf8')).pid).toBe(
      foreignPid,
    )
    expect(await readAgentToken(root)).toBe('newer')
  })
})
