import { afterEach, describe, expect, it } from 'vitest'
import type { WebSocket } from 'ws'
import { GENIE_REACT_VERSION, newId } from '../protocol'
import {
  createTestBridge,
  delay,
  type Frame,
  type Inbox,
  isResult,
  open,
  send,
} from './bridge-test-harness'
import type { StandaloneBridgeHandle, StandaloneBridgeOptions } from './standalone'

interface Peer {
  ws: WebSocket
  inbox: Inbox
}

interface Document extends Peer {
  sessionId: string
}

const TOOLS = [
  { name: 'mutate', title: 'Mutate', description: 'changes app state', group: 'app' },
  {
    name: 'peek',
    title: 'Peek',
    description: 'read-only',
    group: 'app',
    annotations: { readOnlyHint: true },
  },
]

describe('GenieBridge routing hardening', () => {
  let handle: StandaloneBridgeHandle
  let url: string

  const start = async (options: StandaloneBridgeOptions = {}) => {
    handle = createTestBridge(options)
    url = (await handle.listen()).url
  }

  afterEach(async () => {
    await handle.close()
  })

  const openDocument = async (
    sessionId: string,
    runtimeVersion: string | null = GENIE_REACT_VERSION,
  ): Promise<Document> => {
    const { ws, inbox } = await open(`${url}?role=app`)
    send(ws, {
      kind: 'app/hello',
      protocol: 1,
      ...(runtimeVersion === null ? {} : { runtimeVersion }),
      sessionId,
      logicalSessionId: `tab-${sessionId}`,
      documentGeneration: 1,
      app: { name: sessionId },
      capabilities: [],
      tools: TOOLS,
    })
    send(ws, { kind: 'app/ready', sessionId })
    send(ws, { kind: 'app/heartbeat', sessionId })
    return { ws, inbox, sessionId }
  }

  const call = (agent: Peer, tool: string, sessionId?: string): string => {
    const id = newId()
    send(agent.ws, { kind: 'agent/invoke', id, tool, args: {}, sessionId })
    return id
  }

  const requestOn = (document: Document, id: string): Promise<Frame> =>
    document.inbox.wait((frame) => frame.kind === 'bridge/request' && frame.id === id)

  const answer = (document: Document, id: string): void =>
    send(document.ws, {
      kind: 'app/response',
      id,
      ok: true,
      result: { from: document.sessionId },
    })

  it('ignores a response for a request that was sent to another document', async () => {
    await start()
    const agent = await open(`${url}?role=agent`)
    const victim = await openDocument('victim')
    const forger = await openDocument('forger')
    await expect.poll(() => handle.bridge.getStatus().sessions.length).toBe(2)

    const id = call(agent, 'peek', 'victim')
    await requestOn(victim, id)
    send(forger.ws, { kind: 'app/response', id, ok: true, result: { from: 'forger' } })
    await delay(100)
    answer(victim, id)

    expect(await agent.inbox.wait(isResult(id))).toMatchObject({
      ok: true,
      result: { from: 'victim' },
      session: { sessionId: 'victim' },
    })
  })

  it('never runs a mutation on another tab while the default tab is silent', async () => {
    await start({ sessionStaleMs: 150 })
    const agent = await open(`${url}?role=agent`)
    const pinned = await openDocument('pinned')
    const pinId = call(agent, 'peek')
    answer(pinned, (await requestOn(pinned, pinId)).id)
    await agent.inbox.wait(isResult(pinId))
    const other = await openDocument('other')
    await expect.poll(() => handle.bridge.getStatus().sessions.length).toBe(2)

    const keepAlive = setInterval(
      () => send(other.ws, { kind: 'app/heartbeat', sessionId: 'other' }),
      50,
    )
    try {
      await delay(250)
      const mutationId = call(agent, 'mutate')
      const mutation = await agent.inbox.wait(isResult(mutationId))
      expect(mutation).toMatchObject({ ok: false, errorCode: 'busy' })
      expect(mutation.error).toContain('mutate')

      const readId = call(agent, 'peek')
      answer(other, (await requestOn(other, readId)).id)
      expect(await agent.inbox.wait(isResult(readId))).toMatchObject({
        ok: true,
        result: { from: 'other' },
        retargeted: true,
      })
      await delay(50)
      expect(
        other.inbox.wait(
          (frame) => frame.kind === 'bridge/request' && frame.id === mutationId,
          100,
        ),
      ).rejects.toThrow()
    } finally {
      clearInterval(keepAlive)
    }
  })

  it('reports each runtime version and warns about a runtime from another release line', async () => {
    await start()
    await openDocument('current')
    await openDocument('older', '0.17.3')
    await openDocument('unversioned', null)
    await expect.poll(() => handle.bridge.getStatus().sessions.length).toBe(3)
    const status = handle.bridge.getStatus()
    expect(status.hub).toEqual({ version: GENIE_REACT_VERSION, protocol: 1 })
    expect(status.sessions.find((session) => session.sessionId === 'older')?.runtimeVersion).toBe(
      '0.17.3',
    )
    const skewed = status.warnings.filter((warning) => warning.includes('the hub is genie-react'))
    expect(skewed).toHaveLength(2)
    expect(skewed.join('\n')).toContain('"older" runs genie-react runtime "0.17.3"')
    expect(skewed.join('\n')).toContain('"unversioned" runs a genie-react runtime that predates')
  })
})
