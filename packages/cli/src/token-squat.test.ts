import { mkdtemp, rm } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type StartHubResult, startGenieHub } from 'genie-react/hub'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runStatus } from './agent'

async function listenOnIpv6Loopback(server: Server, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    server.once('error', () => resolve(false))
    server.listen(port, '::1', () => resolve(true))
  })
}

// Probed once: hosts without IPv6 loopback cannot host the squatter, so the scenario does not apply.
const probe = createServer()
const ipv6Loopback = await listenOnIpv6Loopback(probe, 0)
probe.close()

describe.runIf(ipv6Loopback)('agent token versus a [::1] squatter on the hub port', () => {
  let root: string
  let hub: StartHubResult
  let squatter: Server
  const received: string[] = []

  beforeEach(async () => {
    vi.stubEnv('GENIE_BRIDGE_URL', '')
    vi.stubEnv('GENIE_BRIDGE_TOKEN', '')
    root = await mkdtemp(join(tmpdir(), 'genie-squat-'))
    hub = await startGenieHub({ rootDir: root, port: 0, strictPort: true })
    squatter = createServer()
    squatter.on('upgrade', (request, socket) => {
      received.push(request.headers.authorization ?? '')
      socket.destroy()
    })
    expect(await listenOnIpv6Loopback(squatter, hub.port)).toBe(true)
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    squatter.close()
    if (hub.status === 'started') await hub.handle.close()
    await rm(root, { recursive: true, force: true })
    received.length = 0
  })

  it('publishes the bound IPv4 literal, never `localhost`', () => {
    expect(hub.url).toBe(`ws://127.0.0.1:${hub.port}/__genie/ws`)
  })

  it('reaches the real hub from discovery without the squatter seeing the token', async () => {
    expect(await runStatus({ cwd: root })).toBe(0)
    expect(received).toEqual([])
  })

  it('pins a typed `localhost` url to the discovered literal', async () => {
    vi.stubEnv('GENIE_BRIDGE_URL', `ws://localhost:${hub.port}/__genie/ws`)
    expect(await runStatus({ cwd: root })).toBe(0)
    expect(await runStatus({ cwd: root, url: `ws://localhost:${hub.port}/__genie/ws` })).toBe(0)
    expect(received).toEqual([])
  })

  it('never sends an explicit token to a `localhost` name it cannot pin', async () => {
    vi.stubEnv('GENIE_BRIDGE_TOKEN', 'explicit-token')
    await runStatus({
      cwd: tmpdir(),
      url: `ws://localhost:${hub.port}/__genie/ws`,
      connectTimeoutMs: 500,
    })
    expect(received.filter((header) => header.includes('explicit-token'))).toEqual([])
  })
})
