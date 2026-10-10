import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type ClientOptions, WebSocket } from 'ws'
import { encodeMessage } from '../protocol'
import { createTestBridge, Inbox, TEST_AGENT_TOKEN } from './bridge-test-harness'
import type { StandaloneBridgeHandle } from './standalone'

type Attempt =
  | { kind: 'open'; ws: WebSocket; inbox: Inbox }
  | { kind: 'rejected'; status: number; body: string }

function attempt(url: string, options: ClientOptions = {}): Promise<Attempt> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, options)
    const inbox = new Inbox(ws)
    ws.once('open', () => resolve({ kind: 'open', ws, inbox }))
    ws.once('unexpected-response', (request, response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk: string) => {
        body += chunk
      })
      response.on('end', () => {
        request.destroy()
        resolve({ kind: 'rejected', status: response.statusCode ?? 0, body })
      })
    })
    ws.once('error', (error) => {
      if (ws.readyState !== WebSocket.CLOSED) reject(error)
    })
  })
}

const bearer = (token: string): ClientOptions => ({
  headers: { authorization: `Bearer ${token}` },
})

describe('hub upgrade authentication', () => {
  let handle: StandaloneBridgeHandle
  let url: string
  const sockets: WebSocket[] = []

  beforeEach(async () => {
    handle = createTestBridge()
    url = (await handle.listen()).url
  })

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.terminate()
    await handle.close()
  })

  async function expectRejected(target: string, options: ClientOptions, status: number) {
    const result = await attempt(target, options)
    if (result.kind === 'open') sockets.push(result.ws)
    expect(result).toMatchObject({ kind: 'rejected', status })
    return result.kind === 'rejected' ? result.body : ''
  }

  it('accepts an agent presenting the hub token and pushes status', async () => {
    const result = await attempt(`${url}?role=agent`, bearer(TEST_AGENT_TOKEN))
    expect(result.kind).toBe('open')
    if (result.kind !== 'open') return
    sockets.push(result.ws)
    expect(await result.inbox.wait((message) => message.kind === 'bridge/status')).toBeTruthy()
  })

  it('rejects agents with a missing or wrong token', async () => {
    expect(await expectRejected(`${url}?role=agent`, {}, 401)).toContain('missing agent token')
    expect(await expectRejected(`${url}?role=agent`, bearer('stale-token'), 401)).toContain(
      'agent token mismatch',
    )
  })

  it('rejects a browser page posing as an agent even with the right token', async () => {
    await expectRejected(
      `${url}?role=agent`,
      { ...bearer(TEST_AGENT_TOKEN), origin: 'http://localhost:5173' },
      403,
    )
  })

  it('rejects a cross-site page registering a fake app session', async () => {
    const body = await expectRejected(`${url}?role=app`, { origin: 'https://evil.example' }, 403)
    expect(body).toContain('allowedOrigins')
    expect(handle.bridge.getStatus().sessions).toEqual([])
  })

  it('rejects role-less upgrades instead of inferring a role from the first frame', async () => {
    await expectRejected(url, {}, 400)
  })

  it('accepts an origin-less (React Native style) app and a loopback page app', async () => {
    for (const options of [{}, { origin: 'http://localhost:3000' }]) {
      const result = await attempt(`${url}?role=app`, options)
      expect(result.kind).toBe('open')
      if (result.kind !== 'open') continue
      sockets.push(result.ws)
      result.ws.send(
        encodeMessage({
          kind: 'app/hello',
          protocol: 1,
          sessionId: `s-${sockets.length}`,
          app: { name: 'demo' },
          capabilities: [],
          tools: [],
        }),
      )
    }
    await expect.poll(() => handle.bridge.getStatus().sessions.length, { timeout: 2_000 }).toBe(2)
  })
})
