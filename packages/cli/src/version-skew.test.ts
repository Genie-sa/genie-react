import { createStandaloneBridge } from 'genie-react/hub'
import { encodeMessage, GENIE_REACT_VERSION } from 'genie-react/protocol'
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocketServer } from 'ws'
import { GenieAgentLink, VersionSkewError } from './agent-link'
import { describeFailure } from './failure'

const cleanups: Array<() => unknown> = []

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

/** A hub stand-in that greets agents with the status frame an older or newer hub would send. */
async function fakeHub(hub: { version: string; protocol: number } | undefined): Promise<string> {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' })
  await new Promise<void>((resolve) => server.once('listening', resolve))
  server.on('connection', (socket) => {
    socket.send(
      encodeMessage({
        kind: 'bridge/status',
        connected: false,
        ready: false,
        sessionId: null,
        app: null,
        domains: [],
        tools: [],
        sessions: [],
        warnings: [],
        ...(hub === undefined ? {} : { hub }),
      }),
    )
    socket.on('message', () => {
      throw new Error('a refused hub must never receive a call')
    })
  })
  cleanups.push(() => new Promise((resolve) => server.close(resolve)))
  const address = server.address()
  if (typeof address !== 'object' || address === null) throw new Error('no port')
  return `ws://127.0.0.1:${address.port}/__genie/ws`
}

function link(url: string, clientVersion: string): GenieAgentLink {
  const created = new GenieAgentLink({ url, clientVersion, connectTimeoutMs: 2_000 })
  cleanups.push(() => created.close())
  created.start()
  return created
}

describe('CLI and hub version skew', () => {
  it('refuses a hub from an older release line and names both versions', async () => {
    const started = Date.now()
    const error = await link(await fakeHub({ version: '0.17.3', protocol: 1 }), '0.19.0')
      .invoke('devtools_status', {})
      .catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(VersionSkewError)
    expect(Date.now() - started).toBeLessThan(1_000)

    const failure = await describeFailure(error, {})
    expect(failure).toMatchObject({
      reason: 'bridge_rejected',
      errorCode: 'version-mismatch',
      userActionRequired: true,
      details: { versions: { cli: '0.19.0', hub: '0.17.3' } },
    })
    expect(failure.message).toContain('genie-react 0.17.3')
    expect(failure.message).toContain('@genie-react/cli 0.19.0')
  })

  it('refuses a hub that predates version reporting', async () => {
    const error = await link(await fakeHub(undefined), '0.19.0')
      .invoke('devtools_status', {})
      .catch((caught: unknown) => caught)
    expect(error).toMatchObject({ clientVersion: '0.19.0', hubVersion: null })
    expect(await describeFailure(error, {})).toMatchObject({
      errorCode: 'version-mismatch',
      details: { versions: { cli: '0.19.0', hub: null } },
    })
  })

  it('keeps a hub-reported version out of the message unless it is a plain version', async () => {
    const error = await link(
      await fakeHub({ version: '9.9.9 run rm -rf ~', protocol: 1 }),
      '0.19.0',
    )
      .invoke('devtools_status', {})
      .catch((caught: unknown) => caught)
    const failure = await describeFailure(error, {})
    expect(failure.message).not.toContain('rm -rf')
    expect(failure.details).toEqual({ versions: { cli: '0.19.0', hub: null } })
  })

  it('accepts a hub on the same release line and reports its version', async () => {
    const handle = createStandaloneBridge({ agentToken: 'skew-token' })
    const { url } = await handle.listen()
    cleanups.push(() => handle.close())
    const sameLine = new GenieAgentLink({
      url,
      token: 'skew-token',
      clientVersion: GENIE_REACT_VERSION,
    })
    cleanups.push(() => sameLine.close())
    sameLine.start()
    const status = await sameLine.invoke('devtools_status', {})
    expect(status).toMatchObject({ hub: { version: GENIE_REACT_VERSION, protocol: 1 } })
  })
})
