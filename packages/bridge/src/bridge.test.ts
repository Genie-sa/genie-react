import { decodeFrame, encodeMessage, newId } from '@genie-react/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { createStandaloneBridge, type StandaloneBridgeHandle } from './standalone'

// biome-ignore lint/suspicious/noExplicitAny: test harness deals in decoded wire frames
type Frame = any

function connect(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

// Attaches the inbox listener before `open` so the bridge's immediate status push is never missed.
async function open(url: string): Promise<{ ws: WebSocket; inbox: Inbox }> {
  const ws = new WebSocket(url)
  const inbox = new Inbox(ws)
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve())
    ws.once('error', reject)
  })
  return { ws, inbox }
}

class Inbox {
  private readonly received: Frame[] = []
  private readonly waiters: Array<{
    match: (m: Frame) => boolean
    resolve: (m: Frame) => void
    timer: ReturnType<typeof setTimeout>
  }> = []

  constructor(socket: WebSocket) {
    socket.on('message', (data) => {
      const message = decodeFrame(data.toString()) as Frame
      this.received.push(message)
      for (const waiter of [...this.waiters]) {
        if (waiter.match(message)) {
          clearTimeout(waiter.timer)
          this.waiters.splice(this.waiters.indexOf(waiter), 1)
          waiter.resolve(message)
        }
      }
    })
  }

  wait(match: (m: Frame) => boolean, timeoutMs = 3000): Promise<Frame> {
    const existing = this.received.find(match)
    if (existing) return Promise.resolve(existing)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for message')), timeoutMs)
      this.waiters.push({ match, resolve, timer })
    })
  }
}

const send = (socket: WebSocket, message: unknown) => socket.send(encodeMessage(message))
const isResult = (id: string) => (m: Frame) => m.kind === 'bridge/result' && m.id === id

describe('GenieBridge', () => {
  let handle: StandaloneBridgeHandle
  let url: string

  beforeEach(async () => {
    handle = createStandaloneBridge()
    url = (await handle.listen()).url
  })

  afterEach(async () => {
    await handle.close()
  })

  it('round-trips status, wait-for-connection, and a forwarded tool', async () => {
    const { ws: agent, inbox: agentInbox } = await open(`${url}?role=agent`)

    const initialStatus = await agentInbox.wait((m) => m.kind === 'bridge/status')
    expect(initialStatus.connected).toBe(false)

    const statusId = newId()
    send(agent, { kind: 'agent/invoke', id: statusId, tool: 'devtools_status', args: {} })
    const statusBefore = await agentInbox.wait(isResult(statusId))
    expect(statusBefore.ok).toBe(true)
    expect(statusBefore.result.connected).toBe(false)

    const waitId = newId()
    send(agent, {
      kind: 'agent/invoke',
      id: waitId,
      tool: 'devtools_wait',
      args: { condition: 'connected', timeoutMs: 4000 },
    })
    const pendingWait = agentInbox.wait(isResult(waitId), 5000)

    const app = await connect(`${url}?role=app`)
    app.on('message', (data) => {
      const message = decodeFrame(data.toString()) as Frame
      if (message.kind === 'bridge/request' && message.tool === 'echo') {
        send(app, {
          kind: 'app/response',
          id: message.id,
          ok: true,
          result: { echoed: message.args },
        })
      }
    })
    send(app, {
      kind: 'app/hello',
      protocol: 1,
      sessionId: 's-1',
      app: { name: 'demo', reactVersion: '19.0.0', tanstack: { query: '5.101.2' } },
      capabilities: ['react', 'query'],
      tools: [{ name: 'echo', title: 'Echo', description: 'echoes args', group: 'meta' }],
    })

    const waitResult = await pendingWait
    expect(waitResult.ok).toBe(true)
    expect(waitResult.result.ok).toBe(true)

    const echoId = newId()
    send(agent, { kind: 'agent/invoke', id: echoId, tool: 'echo', args: { hello: 'world' } })
    const echoResult = await agentInbox.wait(isResult(echoId))
    expect(echoResult.ok).toBe(true)
    expect(echoResult.result.echoed).toEqual({ hello: 'world' })

    const statusId2 = newId()
    send(agent, { kind: 'agent/invoke', id: statusId2, tool: 'devtools_status', args: {} })
    const statusAfter = await agentInbox.wait(isResult(statusId2))
    expect(statusAfter.result.connected).toBe(true)
    expect(statusAfter.result.app.name).toBe('demo')
    expect(statusAfter.result.toolCount).toBe(3) // 1 app tool + 2 meta tools (devtools_status/wait)
  })

  it('errors when forwarding a tool with no app connected', async () => {
    const { ws: agent, inbox } = await open(`${url}?role=agent`)
    await inbox.wait((m) => m.kind === 'bridge/status')

    const id = newId()
    send(agent, { kind: 'agent/invoke', id, tool: 'react_get_tree', args: {} })
    const result = await inbox.wait(isResult(id))
    expect(result.ok).toBe(false)
    expect(result.error).toContain('No app connected')
  })

  it('times out a forwarded tool when the app never responds', async () => {
    const fastHandle = createStandaloneBridge({ requestTimeoutMs: 150 })
    const fastUrl = (await fastHandle.listen()).url
    try {
      const app = await connect(`${fastUrl}?role=app`)
      send(app, {
        kind: 'app/hello',
        protocol: 1,
        sessionId: 's-2',
        app: { name: 'silent' },
        capabilities: [],
        tools: [],
      })
      const { ws: agent, inbox } = await open(`${fastUrl}?role=agent`)
      const id = newId()
      send(agent, { kind: 'agent/invoke', id, tool: 'never_responds', args: {} })
      const result = await inbox.wait(isResult(id))
      expect(result.ok).toBe(false)
      expect(result.error).toContain('timed out')
    } finally {
      await fastHandle.close()
    }
  })
})
