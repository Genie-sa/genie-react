import { afterEach, describe, expect, it } from 'vitest'
import type { WebSocket } from 'ws'
import { decodeFrame } from '../protocol'
import { createTestBridge, delay, type Frame, isResult, open, send } from './bridge-test-harness'
import type { StandaloneBridgeHandle, StandaloneBridgeOptions } from './standalone'

const NO_REPLY = Symbol('no-reply')
type Reply = { ok: true; result: unknown } | { ok: false; error: string; errorCode: string }
type Handler = (
  tool: string,
  args: Frame,
  ws: WebSocket,
) => Reply | typeof NO_REPLY | Promise<Reply>

const REACT_TOOLS = ['react_clear_renders', 'react_get_renders', 'react_find_components']

let handle: StandaloneBridgeHandle | undefined

afterEach(async () => {
  await handle?.close()
  handle = undefined
})

async function startBridge(options?: StandaloneBridgeOptions): Promise<string> {
  handle = createTestBridge(options)
  return (await handle.listen()).url
}

async function connectApp(
  url: string,
  tools: string[],
  handler: Handler,
  sessionId = 'robust-session',
): Promise<WebSocket> {
  const { ws } = await open(`${url}?role=app`)
  ws.on('message', async (data) => {
    const message = decodeFrame(data.toString()) as Frame
    if (message.kind !== 'bridge/request') return
    const reply = await handler(message.tool, message.args, ws)
    if (reply !== NO_REPLY) send(ws, { kind: 'app/response', id: message.id, ...reply })
  })
  send(ws, {
    kind: 'app/hello',
    protocol: 1,
    sessionId,
    app: { name: 'robust' },
    capabilities: ['react'],
    tools: tools.map((name) => ({ name, title: name, description: name, group: 'react' })),
  })
  send(ws, { kind: 'app/ready', sessionId })
  return ws
}

async function connectAgent(url: string) {
  const agent = await open(`${url}?role=agent`)
  await agent.inbox.wait((message) => message.kind === 'bridge/status' && message.connected)
  return agent
}

const ok = (result: unknown): Reply => ({ ok: true, result })

describe('GenieBridge robustness', () => {
  it('answers the agent with tool-error instead of crashing when a hub-side handler throws', async () => {
    const url = await startBridge()
    await connectApp(url, REACT_TOOLS, (tool) =>
      tool === 'react_clear_renders'
        ? ok({ documentCommitId: 1, observation: { id: 'o1' } })
        : ok({}),
    )
    const { ws, inbox } = await connectAgent(url)
    const bridge = handle?.bridge as unknown as { interactions: { invoke: () => Promise<never> } }
    bridge.interactions.invoke = () => Promise.reject(new Error('boom'))

    send(ws, {
      kind: 'agent/invoke',
      id: 'begin',
      tool: 'devtools_interaction_begin',
      args: { name: 'robust' },
    })
    const result = await inbox.wait(isResult('begin'))

    expect(result).toMatchObject({ ok: false, errorCode: 'tool-error' })
    expect(result.error).toContain('boom')
  })

  it('names the recording interaction that blocks a new one on the same tab', async () => {
    const url = await startBridge()
    await connectApp(url, REACT_TOOLS, (tool) =>
      tool === 'react_clear_renders'
        ? ok({ documentCommitId: 1, observation: { id: 'o1' } })
        : ok({}),
    )
    const { ws, inbox } = await connectAgent(url)
    send(ws, {
      kind: 'agent/invoke',
      id: 'first',
      tool: 'devtools_interaction_begin',
      args: { name: 'robust' },
    })
    const first = await inbox.wait(isResult('first'))
    send(ws, {
      kind: 'agent/invoke',
      id: 'second',
      tool: 'devtools_interaction_begin',
      args: { name: 'robust' },
    })
    const second = await inbox.wait(isResult('second'))

    expect(second.errorDetails).toEqual({
      hubCode: 'INTERACTION_ACTIVE',
      interactionId: first.result.interactionId,
    })
  })

  it('keeps the disconnect code when the tab closes while an interaction begins', async () => {
    const url = await startBridge()
    await connectApp(url, REACT_TOOLS, (_tool, _args, ws) => {
      ws.close()
      return NO_REPLY
    })
    const { ws, inbox } = await connectAgent(url)
    send(ws, {
      kind: 'agent/invoke',
      id: 'begin',
      tool: 'devtools_interaction_begin',
      args: { name: 'robust' },
    })
    const result = await inbox.wait(isResult('begin'))

    expect(result).toMatchObject({ ok: false, errorCode: 'not-connected' })
    expect(result.errorDetails?.hubCode).toBe('SESSION_DISCONNECTED')
  })

  it('keeps the disconnect code when the tab closes during a capture', async () => {
    const url = await startBridge()
    await connectApp(url, ['react_get_renders'], (_tool, _args, ws) => {
      ws.close()
      return NO_REPLY
    })
    const { ws, inbox } = await connectAgent(url)
    send(ws, {
      kind: 'agent/invoke',
      id: 'capture',
      tool: 'devtools_capture_create',
      args: { name: 'x', include: ['react'] },
    })
    const result = await inbox.wait(isResult('capture'))

    expect(result).toMatchObject({ ok: false, errorCode: 'not-connected' })
  })

  it('bounds every devtools_wait probe by the wait timeout', async () => {
    const url = await startBridge({ requestTimeoutMs: 4_000 })
    await connectApp(url, REACT_TOOLS, () => NO_REPLY)
    const { ws, inbox } = await connectAgent(url)
    const started = Date.now()
    send(ws, {
      kind: 'agent/invoke',
      id: 'wait',
      tool: 'devtools_wait',
      args: { condition: 'component', name: 'Missing', timeoutMs: 500 },
    })
    await inbox.wait(isResult('wait'), 6_000)

    expect(Date.now() - started).toBeLessThan(2_000)
  })

  it('fails a wait at once when its probe tool errors instead of polling to the timeout', async () => {
    const url = await startBridge()
    await connectApp(url, REACT_TOOLS, (tool) => ({
      ok: false,
      errorCode: 'tool-error',
      error: `Unknown tool "${tool}"`,
    }))
    const { ws, inbox } = await connectAgent(url)
    const started = Date.now()
    send(ws, {
      kind: 'agent/invoke',
      id: 'wait',
      tool: 'devtools_wait',
      args: { condition: 'navigation', name: '/x', timeoutMs: 5_000 },
    })
    const result = await inbox.wait(isResult('wait'), 6_000)

    expect(result.result).toMatchObject({ ok: false })
    expect(result.result.reason).toContain('Unknown tool "router_get_state"')
    expect(Date.now() - started).toBeLessThan(1_000)
  })

  it('keeps waiting for a query that is not cached yet', async () => {
    const url = await startBridge()
    let polls = 0
    await connectApp(url, ['query_get'], () => {
      polls += 1
      return polls < 3
        ? { ok: false, errorCode: 'tool-error', error: 'Query not found for ["todo",2].' }
        : ok({ queryHash: '["todo",2]', queryKey: ['todo', 2], fetchStatus: 'idle' })
    })
    const { ws, inbox } = await connectAgent(url)
    send(ws, {
      kind: 'agent/invoke',
      id: 'wait',
      tool: 'devtools_wait',
      args: { condition: 'query-settled', queryKey: ['todo', 2], timeoutMs: 3_000 },
    })
    const result = await inbox.wait(isResult('wait'), 5_000)

    expect(result.result).toMatchObject({ ok: true })
    expect(polls).toBe(3)
  })

  it('lists the connected targets when a wait names a session that never appears', async () => {
    const url = await startBridge()
    await connectApp(url, REACT_TOOLS, () => ok({ matches: [{}] }), 'real-session')
    const { ws, inbox } = await connectAgent(url)
    send(ws, {
      kind: 'agent/invoke',
      id: 'wait',
      tool: 'devtools_wait',
      sessionId: 'typo-session',
      args: { condition: 'component', name: 'X', timeoutMs: 300 },
    })
    const result = await inbox.wait(isResult('wait'))

    expect(result).toMatchObject({ ok: false, errorCode: 'unknown-session' })
    expect(result.error).toContain('real-session')
  })

  it('routes each reply to its own agent when two agents reuse a request id', async () => {
    const url = await startBridge()
    await connectApp(url, ['echo'], async (_tool, args) => {
      await delay(args.wait)
      return ok({ answeredFor: args.who })
    })
    const first = await connectAgent(url)
    const second = await connectAgent(url)
    send(first.ws, { kind: 'agent/invoke', id: '1', tool: 'echo', args: { who: 'A', wait: 50 } })
    await delay(10)
    send(second.ws, { kind: 'agent/invoke', id: '1', tool: 'echo', args: { who: 'B', wait: 150 } })

    expect((await first.inbox.wait(isResult('1'))).result).toEqual({ answeredFor: 'A' })
    expect((await second.inbox.wait(isResult('1'))).result).toEqual({ answeredFor: 'B' })
  })
})
