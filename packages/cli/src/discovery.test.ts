import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { removeAgentToken, writeAgentToken } from 'genie-react/hub'
import { GENIE_DISCOVERY_FILE, GENIE_WS_PATH } from 'genie-react/protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BridgeConfigError,
  isPidAlive,
  isTokenTransportSafe,
  normalizeBridgeUrl,
  resolveBridge,
  resolveBridgeUrl,
  resolveExplicitBridge,
} from './discovery'

const ENV_KEYS = ['GENIE_BRIDGE_URL', 'GENIE_BRIDGE_PORT', 'GENIE_BRIDGE_TOKEN'] as const

describe('resolveBridgeUrl', () => {
  let cwd: string
  const saved = new Map<string, string | undefined>()

  beforeEach(async () => {
    for (const key of ENV_KEYS) {
      saved.set(key, process.env[key])
      delete process.env[key]
    }
    cwd = await mkdtemp(join(tmpdir(), 'genie-discovery-'))
  })

  afterEach(async () => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    saved.clear()
    await rm(cwd, { recursive: true, force: true })
  })

  const writeDiscovery = async (contents: string) => {
    const file = join(cwd, GENIE_DISCOVERY_FILE)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, contents, 'utf8')
  }

  it('lets the env override win over a discovery file and the default', async () => {
    process.env.GENIE_BRIDGE_URL = 'ws://override.example/socket'
    await writeDiscovery(JSON.stringify({ url: 'ws://from-file/__genie/ws' }))
    expect(await resolveBridgeUrl(cwd)).toBe('ws://override.example/socket')
  })

  it('reads the bridge url from a discovery file in the given cwd', async () => {
    await writeDiscovery(JSON.stringify({ url: 'ws://127.0.0.1:4321/__genie/ws', port: 4321 }))
    expect(await resolveBridgeUrl(cwd)).toBe('ws://127.0.0.1:4321/__genie/ws')
  })

  it('walks up to find a discovery file in a parent directory (nested cwd / monorepo root)', async () => {
    await writeDiscovery(JSON.stringify({ url: 'ws://127.0.0.1:4321/__genie/ws', port: 4321 }))
    const nested = join(cwd, 'packages', 'app', 'src')
    await mkdir(nested, { recursive: true })
    expect(await resolveBridgeUrl(nested)).toBe('ws://127.0.0.1:4321/__genie/ws')
  })

  it('falls through to the loopback default when the discovery file is malformed', async () => {
    await writeDiscovery('{ not json')
    expect(await resolveBridgeUrl(cwd)).toBe(`ws://127.0.0.1:4390${GENIE_WS_PATH}`)
  })

  it('falls through to the default when no discovery file exists', async () => {
    expect(await resolveBridgeUrl(cwd)).toBe(`ws://127.0.0.1:4390${GENIE_WS_PATH}`)
  })

  it("defaults to Vite's dev server port when the app has a Vite config", async () => {
    await writeFile(join(cwd, 'vite.config.ts'), 'export default {}\n')
    expect(await resolveBridgeUrl(cwd)).toBe(`ws://127.0.0.1:5173${GENIE_WS_PATH}`)
  })

  it('honors GENIE_BRIDGE_PORT and GENIE_WS_PATH in the default', async () => {
    process.env.GENIE_BRIDGE_PORT = '6100'
    expect(await resolveBridgeUrl(cwd)).toBe(`ws://127.0.0.1:6100${GENIE_WS_PATH}`)
  })

  it('falls through to the default when the discovery file lacks a url', async () => {
    await writeDiscovery(JSON.stringify({ port: 4321 }))
    expect(await resolveBridgeUrl(cwd)).toBe(`ws://127.0.0.1:4390${GENIE_WS_PATH}`)
  })

  it('removes a stale discovery file (dead pid) and falls through to the default', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    await writeDiscovery(
      JSON.stringify({ url: 'ws://127.0.0.1:4321/__genie/ws', port: 4321, pid: 999_999 }),
    )
    expect(await resolveBridgeUrl(cwd)).toBe(`ws://127.0.0.1:4390${GENIE_WS_PATH}`)
    expect(existsSync(join(cwd, GENIE_DISCOVERY_FILE))).toBe(false)
    expect(JSON.parse(stderrSpy.mock.calls.flat().join(''))).toMatchObject({
      status: 'diagnostic',
      reason: 'stale_discovery',
      data: { pid: 999999 },
    })
    stderrSpy.mockRestore()
  })

  it('keeps a discovery file whose pid is alive', async () => {
    await writeDiscovery(
      JSON.stringify({ url: 'ws://127.0.0.1:4321/__genie/ws', port: 4321, pid: process.pid }),
    )
    expect(await resolveBridgeUrl(cwd)).toBe('ws://127.0.0.1:4321/__genie/ws')
    expect(existsSync(join(cwd, GENIE_DISCOVERY_FILE))).toBe(true)
  })

  it('trusts a discovery file that carries no pid at all', async () => {
    await writeDiscovery(JSON.stringify({ url: 'ws://127.0.0.1:4321/__genie/ws', port: 4321 }))
    expect(await resolveBridgeUrl(cwd)).toBe('ws://127.0.0.1:4321/__genie/ws')
  })

  it('labels the env override, the discovery file, and the default guess by source', async () => {
    process.env.GENIE_BRIDGE_URL = 'ws://override.example/socket'
    expect((await resolveBridge(cwd)).source).toBe('env')
    delete process.env.GENIE_BRIDGE_URL

    await writeDiscovery(JSON.stringify({ url: 'ws://127.0.0.1:4321/__genie/ws', port: 4321 }))
    expect(await resolveBridge(cwd)).toEqual({
      url: 'ws://127.0.0.1:4321/__genie/ws',
      source: 'file',
    })

    await rm(join(cwd, GENIE_DISCOVERY_FILE), { force: true })
    expect((await resolveBridge(cwd)).source).toBe('fallback')
  })

  it("pairs a discovered url with its own root's private token, never GENIE_BRIDGE_TOKEN", async () => {
    await writeDiscovery(JSON.stringify({ url: 'ws://localhost:4321/__genie/ws', port: 4321 }))
    await writeAgentToken(cwd, 'file-token')
    process.env.GENIE_BRIDGE_TOKEN = 'env-token'

    expect(await resolveBridge(cwd)).toEqual({
      url: 'ws://localhost:4321/__genie/ws',
      token: 'file-token',
      source: 'file',
    })
    await removeAgentToken(cwd)
    expect((await resolveBridge(cwd)).token).toBeUndefined()
  })

  it('pairs an explicit url with GENIE_BRIDGE_TOKEN first, else the hub publishing that endpoint', async () => {
    await writeDiscovery(JSON.stringify({ url: 'ws://127.0.0.1:4321/__genie/ws', port: 4321 }))
    await writeAgentToken(cwd, 'file-token')
    expect(await resolveExplicitBridge('ws://localhost:4321/__genie/ws', cwd)).toEqual({
      url: 'ws://127.0.0.1:4321/__genie/ws',
      token: 'file-token',
    })
    expect(
      (await resolveExplicitBridge('ws://localhost:9999/__genie/ws', cwd)).token,
    ).toBeUndefined()
    expect(
      (await resolveExplicitBridge('ws://remote.example:4321/__genie/ws', cwd)).token,
    ).toBeUndefined()

    process.env.GENIE_BRIDGE_URL = 'ws://localhost:4321/__genie/ws'
    expect(await resolveBridge(cwd)).toEqual({
      url: 'ws://127.0.0.1:4321/__genie/ws',
      token: 'file-token',
      source: 'env',
    })
    process.env.GENIE_BRIDGE_TOKEN = 'env-token'
    expect((await resolveBridge(cwd)).token).toBe('env-token')
    expect(await resolveExplicitBridge('ws://remote.example:4321/__genie/ws', cwd)).toEqual({
      url: 'ws://remote.example:4321/__genie/ws',
      token: 'env-token',
    })
  })

  it('pairs an explicit url with a matching descendant bridge token from a monorepo root', async () => {
    await mkdir(join(cwd, '.git'))
    for (const [name, port] of [
      ['admin', 4321],
      ['shop', 4322],
    ] as const) {
      const appRoot = join(cwd, 'apps', name)
      const file = join(appRoot, GENIE_DISCOVERY_FILE)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(
        file,
        JSON.stringify({ url: `ws://localhost:${port}/__genie/ws`, pid: process.pid }),
      )
      await writeAgentToken(appRoot, `${name}-token`)
    }

    expect((await resolveExplicitBridge('ws://localhost:4322/__genie/ws', cwd)).token).toBe(
      'shop-token',
    )
  })

  it('discovers one live descendant bridge when invoked from a monorepo root', async () => {
    await mkdir(join(cwd, '.git'))
    const appRoot = join(cwd, 'apps', 'shop')
    const appFile = join(appRoot, GENIE_DISCOVERY_FILE)
    await mkdir(dirname(appFile), { recursive: true })
    await writeFile(
      appFile,
      JSON.stringify({ url: 'ws://127.0.0.1:4321/__genie/ws', pid: process.pid }),
    )
    await writeAgentToken(appRoot, 'shop-token')

    expect(await resolveBridge(cwd)).toEqual({
      url: 'ws://127.0.0.1:4321/__genie/ws',
      token: 'shop-token',
      source: 'workspace',
    })
  })

  it('ignores a token left in the web-served discovery file', async () => {
    await writeDiscovery(
      JSON.stringify({ url: 'ws://localhost:4321/__genie/ws', token: 'legacy-token' }),
    )
    expect((await resolveBridge(cwd)).token).toBeUndefined()
  })

  it('fails with every choice when multiple descendant bridges are live', async () => {
    await mkdir(join(cwd, '.git'))
    for (const [name, port] of [
      ['admin', 4321],
      ['shop', 4322],
    ] as const) {
      const file = join(cwd, 'apps', name, GENIE_DISCOVERY_FILE)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(
        file,
        JSON.stringify({ url: `ws://127.0.0.1:${port}/__genie/ws`, pid: process.pid }),
      )
    }

    await expect(resolveBridge(cwd)).rejects.toThrow(
      /Multiple live Genie bridges[\s\S]*apps\/admin[\s\S]*apps\/shop[\s\S]*--url/,
    )
    await expect(resolveBridge(cwd)).rejects.toBeInstanceOf(BridgeConfigError)
  })

  it('reads the token from the path the hub recorded, even under another TMPDIR', async () => {
    const hubRuntime = await mkdtemp(join(tmpdir(), 'genie-hub-runtime-'))
    const cliRuntime = await mkdtemp(join(tmpdir(), 'genie-cli-runtime-'))
    const savedRuntime = process.env.XDG_RUNTIME_DIR
    try {
      process.env.XDG_RUNTIME_DIR = hubRuntime
      const tokenFile = await writeAgentToken(cwd, 'hub-token')
      await writeDiscovery(
        JSON.stringify({ url: 'ws://127.0.0.1:4321/__genie/ws', pid: process.pid, tokenFile }),
      )
      process.env.XDG_RUNTIME_DIR = cliRuntime

      expect((await resolveBridge(cwd)).token).toBe('hub-token')
    } finally {
      process.env.XDG_RUNTIME_DIR = savedRuntime
      await rm(hubRuntime, { recursive: true, force: true })
      await rm(cliRuntime, { recursive: true, force: true })
    }
  })

  it('refuses a recorded token path that belongs to another app root', async () => {
    const otherRoot = await mkdtemp(join(tmpdir(), 'genie-other-root-'))
    try {
      const tokenFile = await writeAgentToken(otherRoot, 'other-token')
      await writeDiscovery(
        JSON.stringify({ url: 'ws://127.0.0.1:4321/__genie/ws', pid: process.pid, tokenFile }),
      )
      expect((await resolveBridge(cwd)).token).toBeUndefined()
    } finally {
      await removeAgentToken(otherRoot)
      await rm(otherRoot, { recursive: true, force: true })
    }
  })

  it.each(['abc', '0', '70000', '12.5'])(
    'rejects GENIE_BRIDGE_PORT=%s as a configuration error',
    async (port) => {
      process.env.GENIE_BRIDGE_PORT = port
      const error = await resolveBridge(cwd).catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(BridgeConfigError)
      expect(error).toHaveProperty(
        'message',
        'GENIE_BRIDGE_PORT must be an integer from 1 to 65535.',
      )
    },
  )

  it('names GENIE_BRIDGE_URL when its value is malformed', async () => {
    process.env.GENIE_BRIDGE_URL = 'http://127.0.0.1:4390'
    await expect(resolveBridge(cwd)).rejects.toThrow('GENIE_BRIDGE_URL must use ws:// or wss://.')
  })

  it('reports a stale descendant discovery file relative to the searched directory', async () => {
    await mkdir(join(cwd, '.git'))
    const file = join(cwd, 'apps', 'shop', GENIE_DISCOVERY_FILE)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify({ url: 'ws://127.0.0.1:4321/__genie/ws', pid: 999_999 }))
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    try {
      await resolveBridge(cwd)
      expect(JSON.parse(String(stderr.mock.calls[0]?.[0]))).toMatchObject({
        reason: 'stale_discovery',
        data: { file: join('apps', 'shop', GENIE_DISCOVERY_FILE) },
      })
    } finally {
      stderr.mockRestore()
    }
  })

  it('does not search downward from an arbitrary nested directory', async () => {
    const appFile = join(cwd, 'sibling-app', GENIE_DISCOVERY_FILE)
    await mkdir(dirname(appFile), { recursive: true })
    await writeFile(
      appFile,
      JSON.stringify({ url: 'ws://127.0.0.1:4321/__genie/ws', pid: process.pid }),
    )

    expect(await resolveBridge(cwd)).toEqual({
      url: `ws://127.0.0.1:4390${GENIE_WS_PATH}`,
      source: 'fallback',
    })
  })
})

describe('isPidAlive', () => {
  it('reports the current process as alive and a bogus pid as gone', () => {
    expect(isPidAlive(process.pid)).toBe(true)
    expect(isPidAlive(999_999)).toBe(false)
  })
})

describe('normalizeBridgeUrl', () => {
  it('accepts ws/wss URLs and rejects unsafe or ambiguous command input', () => {
    expect(normalizeBridgeUrl('ws://localhost:4390/__genie/ws')).toBe(
      'ws://localhost:4390/__genie/ws',
    )
    expect(() => normalizeBridgeUrl('https://example.com')).toThrow(/ws:\/\/ or wss:\/\//)
    expect(() => normalizeBridgeUrl('ws://user:secret@localhost/socket')).toThrow(/credentials/)
    expect(() => normalizeBridgeUrl('ws://localhost/socket?role=app')).toThrow(/query or fragment/)
  })
})

describe('isTokenTransportSafe', () => {
  it('allows the token over wss:// anywhere and over ws:// only to loopback IP literals', () => {
    for (const url of [
      'ws://127.0.0.1:4390/__genie/ws',
      'ws://127.1.2.3:4390/__genie/ws',
      'ws://[::1]:4390/__genie/ws',
      'wss://dev.example.test/__genie/ws',
    ]) {
      expect(isTokenTransportSafe(url)).toBe(true)
    }
    for (const url of [
      'ws://192.168.1.20:5173/__genie/ws',
      'ws://dev.example.test/__genie/ws',
      'ws://localhost.evil.example/__genie/ws',
      'ws://localhost:5173/__genie/ws',
      'ws://app.localhost:5173/__genie/ws',
    ]) {
      expect(isTokenTransportSafe(url)).toBe(false)
    }
  })
})
