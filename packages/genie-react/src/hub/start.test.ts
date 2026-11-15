import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GENIE_DISCOVERY_FILE } from '../protocol'
import { agentTokenFile, readAgentToken, readAgentTokenFile } from './agent-token'
import { type StartHubResult, startGenieHub } from './start'

describe('startGenieHub multi-session behavior', () => {
  let dirA: string
  let dirB: string
  const open: (() => Promise<void>)[] = []

  beforeEach(async () => {
    dirA = await mkdtemp(join(tmpdir(), 'genie-hub-a-'))
    dirB = await mkdtemp(join(tmpdir(), 'genie-hub-b-'))
  })

  afterEach(async () => {
    for (const close of open.splice(0)) await close()
    await rm(dirA, { recursive: true, force: true })
    await rm(dirB, { recursive: true, force: true })
  })

  function track(result: StartHubResult): StartHubResult {
    if (result.status === 'started') open.push(() => result.handle.close())
    return result
  }

  async function discoveredPort(dir: string): Promise<number> {
    const discovery = JSON.parse(await readFile(join(dir, GENIE_DISCOVERY_FILE), 'utf8'))
    return discovery.port
  }

  it('starts on the preferred port when it is free', async () => {
    const port = await freePortRun(1)
    const result = track(await startGenieHub({ rootDir: dirA, port }))
    expect(result.status).toBe('started')
    expect(result.port).toBe(port)
    expect(await discoveredPort(dirA)).toBe(port)
  })

  it('publishes the agent token privately, never in the web-served discovery file', async () => {
    const port = await freePortRun(1)
    const result = track(await startGenieHub({ rootDir: dirA, port }))
    if (result.status !== 'started') throw new Error('expected a fresh hub')
    const discovery = await readFile(join(dirA, GENIE_DISCOVERY_FILE), 'utf8')

    expect(discovery).not.toContain(result.handle.bridge.agentToken)
    expect(await readAgentToken(dirA)).toBe(result.handle.bridge.agentToken)
    if (process.platform !== 'win32') {
      expect((await stat(join(dirA, '.genie'))).mode & 0o777).toBe(0o700)
    }
  })

  it('reuses a hub that already serves the same app root instead of starting a second one', async () => {
    const port = await freePortRun(1)
    const first = track(await startGenieHub({ rootDir: dirA, port }))
    const published = await readFile(join(dirA, GENIE_DISCOVERY_FILE), 'utf8')
    const second = await startGenieHub({ rootDir: dirA, port })

    expect(first.status).toBe('started')
    expect(second.status).toBe('reused')
    expect(second.port).toBe(port)
    expect(await readFile(join(dirA, GENIE_DISCOVERY_FILE), 'utf8')).toBe(published)
  })

  it('reuses a live hub of the same root even when it listens on a different port', async () => {
    const port = await freePortRun(2)
    const first = track(await startGenieHub({ rootDir: dirA, port }))
    const published = await readFile(join(dirA, GENIE_DISCOVERY_FILE), 'utf8')
    const second = track(await startGenieHub({ rootDir: dirA, port: port + 1 }))

    expect(first.status).toBe('started')
    expect(second).toMatchObject({ status: 'reused', port })
    expect(await readFile(join(dirA, GENIE_DISCOVERY_FILE), 'utf8')).toBe(published)
  })

  it('records the private token path in the discovery file', async () => {
    const port = await freePortRun(1)
    const result = track(await startGenieHub({ rootDir: dirA, port }))
    if (result.status !== 'started') throw new Error('expected a fresh hub')
    const discovery = JSON.parse(await readFile(join(dirA, GENIE_DISCOVERY_FILE), 'utf8'))

    expect(discovery.tokenFile).toBe(await agentTokenFile(dirA))
    expect(await readAgentTokenFile(discovery.tokenFile)).toBe(result.handle.bridge.agentToken)
  })

  it('reports an exhausted port range as a typed port_busy error', async () => {
    const port = await freePortRun(1)
    track(await startGenieHub({ rootDir: dirA, port }))
    await expect(startGenieHub({ rootDir: dirB, port, strictPort: true })).rejects.toMatchObject({
      name: 'HubPortBusyError',
      code: 'port_busy',
    })
  })

  it("walks to the next port when another app's hub owns the preferred one", async () => {
    const port = await freePortRun(2)
    const appA = track(await startGenieHub({ rootDir: dirA, port }))
    const appB = track(await startGenieHub({ rootDir: dirB, port }))

    expect(appA.port).toBe(port)
    expect(appB.status).toBe('started')
    expect(appB.port).toBe(port + 1)
    expect(await discoveredPort(dirA)).toBe(port)
    expect(await discoveredPort(dirB)).toBe(port + 1)
  })

  it('walks past a foreign non-genie process on the preferred port', async () => {
    const port = await freePortRun(2)
    const foreign = await listenForeign(port)
    open.push(() => close(foreign))

    const result = track(await startGenieHub({ rootDir: dirA, port }))
    expect(result.status).toBe('started')
    expect(result.port).toBe(port + 1)
  })

  it('fails fast with strictPort instead of walking', async () => {
    const port = await freePortRun(1)
    track(await startGenieHub({ rootDir: dirA, port }))
    await expect(startGenieHub({ rootDir: dirB, port, strictPort: true })).rejects.toThrow(
      /is busy/,
    )
  })
})

/** First of `count` consecutive ports nothing on this machine listens on, so port assertions never depend on what else runs here. */
async function freePortRun(count: number): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const probe = await listenForeign(0)
    const base = (probe.address() as AddressInfo).port
    await close(probe)
    if (await portsFree(base + 1, base + count)) return base
  }
  throw new Error(`no run of ${count} free ports found`)
}

async function portsFree(from: number, to: number): Promise<boolean> {
  for (let port = from; port < to; port++) {
    const server = await listenForeign(port).catch(() => null)
    if (!server) return false
    await close(server)
  }
  return true
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()))
}

function listenForeign(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer((_req, res) => {
      res.writeHead(200)
      res.end('not genie')
    })
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}
