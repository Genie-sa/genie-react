import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GENIE_DISCOVERY_FILE } from '../protocol'
import { type StartHubResult, startGenieHub } from './start'

const BASE_PORT = 4600 + Math.floor(Math.random() * 300)

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
    const result = track(await startGenieHub({ rootDir: dirA, port: BASE_PORT }))
    expect(result.status).toBe('started')
    expect(result.port).toBe(BASE_PORT)
    expect(await discoveredPort(dirA)).toBe(BASE_PORT)
  })

  it('reuses a hub that already serves the same app root instead of starting a second one', async () => {
    const first = track(await startGenieHub({ rootDir: dirA, port: BASE_PORT + 10 }))
    const second = await startGenieHub({ rootDir: dirA, port: BASE_PORT + 10 })

    expect(first.status).toBe('started')
    expect(second.status).toBe('reused')
    expect(second.port).toBe(BASE_PORT + 10)
  })

  it("walks to the next port when another app's hub owns the preferred one", async () => {
    const appA = track(await startGenieHub({ rootDir: dirA, port: BASE_PORT + 20 }))
    const appB = track(await startGenieHub({ rootDir: dirB, port: BASE_PORT + 20 }))

    expect(appA.port).toBe(BASE_PORT + 20)
    expect(appB.status).toBe('started')
    expect(appB.port).toBe(BASE_PORT + 21)
    expect(await discoveredPort(dirA)).toBe(BASE_PORT + 20)
    expect(await discoveredPort(dirB)).toBe(BASE_PORT + 21)
  })

  it('walks past a foreign non-genie process on the preferred port', async () => {
    const foreign = await listenForeign(BASE_PORT + 30)
    open.push(() => new Promise((resolve) => foreign.close(() => resolve())))

    const result = track(await startGenieHub({ rootDir: dirA, port: BASE_PORT + 30 }))
    expect(result.status).toBe('started')
    expect(result.port).toBe(BASE_PORT + 31)
  })

  it('fails fast with strictPort instead of walking', async () => {
    track(await startGenieHub({ rootDir: dirA, port: BASE_PORT + 40 }))
    await expect(
      startGenieHub({ rootDir: dirB, port: BASE_PORT + 40, strictPort: true }),
    ).rejects.toThrow(/is busy/)
  })
})

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
