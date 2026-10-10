import { afterEach, describe, expect, it } from 'vitest'
import type { WebSocket } from 'ws'
import { newId } from '../protocol'
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

interface Document {
  ws: WebSocket
  inbox: Inbox
  sessionId: string
}

describe('GenieBridge tab sessions', () => {
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
    logicalSessionId: string,
    documentGeneration: number,
    sessionName?: string,
  ): Promise<Document> => {
    const { ws, inbox } = await open(`${url}?role=app`)
    send(ws, {
      kind: 'app/hello',
      protocol: 1,
      sessionId,
      logicalSessionId,
      documentGeneration,
      sessionName,
      app: { name: sessionId, url: `http://localhost/${sessionId}` },
      capabilities: [],
      tools: [
        { name: 'whoami', title: 'Who', description: 'identity', group: 'meta' },
        {
          name: 'peek',
          title: 'Peek',
          description: 'read-only identity',
          group: 'meta',
          annotations: { readOnlyHint: true },
        },
      ],
    })
    send(ws, { kind: 'app/ready', sessionId })
    send(ws, { kind: 'app/heartbeat', sessionId })
    return { ws, inbox, sessionId }
  }

  const call = (
    agent: { ws: WebSocket; inbox: Inbox },
    sessionId?: string,
    tool = 'whoami',
  ): string => {
    const id = newId()
    send(agent.ws, { kind: 'agent/invoke', id, tool, args: {}, sessionId })
    return id
  }

  const waitReady = async (agent: { ws: WebSocket; inbox: Inbox }): Promise<Frame> => {
    const id = newId()
    send(agent.ws, {
      kind: 'agent/invoke',
      id,
      tool: 'devtools_wait',
      args: { condition: 'ready', timeoutMs: 2_000 },
    })
    return agent.inbox.wait(isResult(id))
  }

  const sessionIds = (): string[] =>
    handle.bridge.getStatus().sessions.map((session) => session.sessionId)

  const pin = async (agent: { ws: WebSocket; inbox: Inbox }, document: Document) => {
    const id = call(agent)
    await respond(document, id)
    await agent.inbox.wait(isResult(id))
  }

  const respond = async (document: Document, id: string): Promise<void> => {
    const request = await document.inbox.wait(
      (frame) => frame.kind === 'bridge/request' && frame.id === id,
    )
    send(document.ws, {
      kind: 'app/response',
      id: request.id,
      ok: true,
      result: { from: document.sessionId },
    })
  }

  it('collapses a navigation storm of frozen documents to the newest generation at once', async () => {
    await start({ supersededLivenessMs: 200, supersedeSilenceMs: 0 })
    const agent = await open(`${url}?role=agent`)
    const documents: Document[] = []
    // Frozen back/forward-cached documents never close their sockets or beat again.
    for (let generation = 1; generation <= 10; generation++) {
      documents.push(await openDocument(`doc-${generation}`, 'storm-tab', generation, 'storm'))
    }
    const newest = documents.at(-1)
    if (!newest) throw new Error('unreachable')
    await expect.poll(() => handle.bridge.getStatus().sessionId).toBe('doc-10')

    const status = handle.bridge.getStatus()
    expect(status.sessions).toHaveLength(1)
    expect(status.warnings).toEqual([])
    expect(status.sessions[0]).toMatchObject({
      sessionId: 'doc-10',
      logicalSessionId: 'storm-tab',
      documentGeneration: 10,
      predecessorSessionId: 'doc-9',
      current: true,
    })

    for (const target of [undefined, 'storm', 'storm-tab', 'doc-1']) {
      const id = call(agent, target)
      await respond(newest, id)
      const result = await agent.inbox.wait(isResult(id))
      expect(result).toMatchObject({
        ok: true,
        result: { from: 'doc-10' },
        session: { sessionId: 'doc-10', logicalSessionId: 'storm-tab', sessionName: 'storm' },
      })
    }

    await expect
      .poll(() => documents.slice(0, -1).every((document) => document.ws.readyState === 3))
      .toBe(true)
    expect(newest.ws.readyState).toBe(newest.ws.OPEN)
  })

  it('fails calls pending on a superseded document immediately instead of reporting busy', async () => {
    await start({ busyProbeMs: 50, busyHeartbeatGapMs: 100, supersedeSilenceMs: 0 })
    const agent = await open(`${url}?role=agent`)
    const first = await openDocument('nav-1', 'nav-tab', 1)
    const mutatingId = call(agent)
    const readOnlyId = call(agent, undefined, 'peek')
    await first.inbox.wait((frame) => frame.kind === 'bridge/request' && frame.id === readOnlyId)

    const second = await openDocument('nav-2', 'nav-tab', 2)
    const mutating = await agent.inbox.wait(isResult(mutatingId))
    expect(mutating).toMatchObject({
      ok: false,
      errorCode: 'not-connected',
      errorDetails: { hubCode: 'SESSION_SUPERSEDED', mayHaveCompleted: true },
      session: { sessionId: 'nav-1' },
    })
    expect(mutating.error).toContain('replaced by a newer page load')
    expect(mutating.error).toContain('may have completed')
    const readOnly = await agent.inbox.wait(isResult(readOnlyId))
    expect(readOnly.errorDetails).toEqual({ hubCode: 'SESSION_SUPERSEDED' })
    expect(readOnly.error).toContain('retry the call')

    const retryId = call(agent)
    await respond(second, retryId)
    expect(await agent.inbox.wait(isResult(retryId))).toMatchObject({
      ok: true,
      result: { from: 'nav-2' },
    })
  })

  it('keeps the tab identity on a recently live document whose duplicate opened, and forks the duplicate', async () => {
    await start({ supersededLivenessMs: 300 })
    const agent = await open(`${url}?role=agent`)
    const original = await openDocument('original', 'cloned-tab', 4)
    const pendingId = call(agent)
    await original.inbox.wait((frame) => frame.kind === 'bridge/request' && frame.id === pendingId)
    const clone = await openDocument('duplicate', 'cloned-tab', 5)

    const routedId = call(agent, 'cloned-tab')
    await respond(original, routedId)
    expect((await agent.inbox.wait(isResult(routedId))).result.from).toBe('original')
    send(original.ws, { kind: 'app/heartbeat', sessionId: 'original' })
    const fork = await clone.inbox.wait((frame: Frame) => frame.kind === 'bridge/session-fork')
    expect(fork).toMatchObject({
      expectedLogicalSessionId: 'cloned-tab',
      collisionWithSessionIds: ['original'],
    })
    await respond(original, pendingId)
    expect((await agent.inbox.wait(isResult(pendingId))).ok).toBe(true)

    const status = handle.bridge.getStatus()
    expect(status.sessionId).toBe('original')
    expect(status.sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sessionId: 'original', logicalSessionId: 'cloned-tab' }),
        expect.objectContaining({
          sessionId: 'duplicate',
          logicalSessionId: fork.logicalSessionId,
          forkedFromLogicalSessionId: 'cloned-tab',
        }),
      ]),
    )
    expect(status.sessions.find((session) => session.sessionId === 'duplicate')).not.toHaveProperty(
      'predecessorSessionId',
    )
  })

  it('hands a racing reload the tab identity once the unloading document closes', async () => {
    await start({ supersededLivenessMs: 300 })
    const agent = await open(`${url}?role=agent`)
    const unloading = await openDocument('race-1', 'race-tab', 1)
    const reloaded = await openDocument('race-2', 'race-tab', 2)
    await expect.poll(sessionIds).toHaveLength(2)
    unloading.ws.close()

    await expect.poll(sessionIds).toEqual(['race-2'])
    const id = call(agent, 'race-tab')
    await respond(reloaded, id)
    expect((await agent.inbox.wait(isResult(id))).result.from).toBe('race-2')
    await delay(400)
    expect(handle.bridge.getStatus().sessions).toEqual([
      expect.objectContaining({
        sessionId: 'race-2',
        logicalSessionId: 'race-tab',
        predecessorSessionId: 'race-1',
      }),
    ])
  })

  it('supersedes a recently live document that falls silent once its tab loaded a newer one', async () => {
    await start({ supersededLivenessMs: 200 })
    const frozen = await openDocument('frozen-1', 'frozen-tab', 1)
    const newer = await openDocument('frozen-2', 'frozen-tab', 2)
    await expect.poll(sessionIds).toHaveLength(2)

    await expect.poll(sessionIds).toEqual(['frozen-2'])
    expect(handle.bridge.getStatus().sessions[0]).toMatchObject({
      sessionId: 'frozen-2',
      logicalSessionId: 'frozen-tab',
      predecessorSessionId: 'frozen-1',
    })
    await expect.poll(() => frozen.ws.readyState).toBe(frozen.ws.CLOSED)
    expect(newer.ws.readyState).toBe(newer.ws.OPEN)
  })

  it('routes a restored back/forward-cache document and its successor id to the restored document', async () => {
    await start()
    const agent = await open(`${url}?role=agent`)
    const first = await openDocument('bf-1', 'bf-tab', 1)
    first.ws.close()
    await expect.poll(() => handle.bridge.getStatus().sessions.length).toBe(0)
    const second = await openDocument('bf-2', 'bf-tab', 2)
    second.ws.close()
    await expect.poll(() => handle.bridge.getStatus().sessions.length).toBe(0)
    const restored = await openDocument('bf-1', 'bf-tab', 3)

    for (const target of ['bf-1', 'bf-2', 'bf-tab']) {
      const id = call(agent, target)
      await respond(restored, id)
      expect((await agent.inbox.wait(isResult(id))).result.from).toBe('bf-1')
    }
    expect(handle.bridge.getStatus().sessions[0]).not.toHaveProperty('successorSessionId')
  })

  it('keeps the default on a reloading tab while a tab that was already open answers meanwhile', async () => {
    await start({ targetReloadGraceMs: 2_000 })
    const agent = await open(`${url}?role=agent`)
    const tabA = await openDocument('a-1', 'tab-a', 1, 'alpha')
    await pin(agent, tabA)
    const tabB = await openDocument('b-1', 'tab-b', 1, 'beta')
    await expect.poll(() => handle.bridge.getStatus().sessions.length).toBe(2)
    const stickyId = call(agent)
    await respond(tabA, stickyId)
    expect(await agent.inbox.wait(isResult(stickyId))).toMatchObject({
      result: { from: 'a-1' },
      session: { sessionId: 'a-1', sessionName: 'alpha' },
    })
    expect((await agent.inbox.wait(isResult(stickyId))).retargeted).toBeUndefined()

    tabA.ws.close()
    await expect.poll(() => handle.bridge.getStatus().sessions.length).toBe(1)
    const started = Date.now()
    expect((await waitReady(agent)).result.ok).toBe(true)
    expect(Date.now() - started).toBeLessThan(500)
    const meanwhileId = call(agent)
    await respond(tabB, meanwhileId)
    expect(await agent.inbox.wait(isResult(meanwhileId))).toMatchObject({
      result: { from: 'b-1' },
      retargeted: true,
    })

    const reloaded = await openDocument('a-2', 'tab-a', 2, 'alpha')
    const afterReloadId = call(agent)
    await respond(reloaded, afterReloadId)
    const afterReload = await agent.inbox.wait(isResult(afterReloadId))
    expect(afterReload.result.from).toBe('a-2')
    expect(afterReload.retargeted).toBeUndefined()
  })

  it('makes a tab that connects after the default left the new default at once', async () => {
    await start({ targetReloadGraceMs: 5_000 })
    const agent = await open(`${url}?role=agent`)
    const metro = await openDocument('rn-1', 'rn-runtime-1', 1)
    await pin(agent, metro)
    metro.ws.close()
    await expect.poll(() => handle.bridge.getStatus().sessions.length).toBe(0)

    const reloadedRuntime = await openDocument('rn-2', 'rn-runtime-2', 1)
    const started = Date.now()
    expect((await waitReady(agent)).result.ok).toBe(true)
    const firstId = call(agent)
    await respond(reloadedRuntime, firstId)
    expect(await agent.inbox.wait(isResult(firstId))).toMatchObject({
      result: { from: 'rn-2' },
      retargeted: true,
    })
    expect(Date.now() - started).toBeLessThan(500)

    await openDocument('other-1', 'other-tab', 1)
    await expect.poll(() => handle.bridge.getStatus().sessions.length).toBe(2)
    const stickyId = call(agent)
    await respond(reloadedRuntime, stickyId)
    const sticky = await agent.inbox.wait(isResult(stickyId))
    expect(sticky.result.from).toBe('rn-2')
    expect(sticky.retargeted).toBeUndefined()
  })

  it('asks for a retry while the default reloads with several other tabs open', async () => {
    await start({ targetReloadGraceMs: 300 })
    const agent = await open(`${url}?role=agent`)
    const tabA = await openDocument('a-1', 'tab-a', 1)
    await pin(agent, tabA)
    await openDocument('b-1', 'tab-b', 1)
    await openDocument('c-1', 'tab-c', 1)
    await expect.poll(sessionIds).toHaveLength(3)
    tabA.ws.close()
    await expect.poll(sessionIds).toHaveLength(2)

    const reloadingId = call(agent)
    expect(await agent.inbox.wait(isResult(reloadingId))).toMatchObject({
      ok: false,
      errorCode: 'not-connected',
      errorDetails: { hubCode: 'SESSION_RELOADING' },
      retryInMs: expect.any(Number),
    })
    await delay(350)
    const expiredId = call(agent)
    expect(await agent.inbox.wait(isResult(expiredId))).toMatchObject({
      ok: false,
      errorCode: 'unknown-session',
      errorDetails: { hubCode: 'SESSION_AMBIGUOUS' },
    })
  })

  it('hands the default to the remaining tab once a closed target outlives the reload grace', async () => {
    await start({ targetReloadGraceMs: 100 })
    const agent = await open(`${url}?role=agent`)
    const tabA = await openDocument('a-1', 'tab-a', 1)
    await pin(agent, tabA)
    const tabB = await openDocument('b-1', 'tab-b', 1)
    await expect.poll(() => handle.bridge.getStatus().sessions.length).toBe(2)
    tabA.ws.close()
    await expect.poll(() => handle.bridge.getStatus().sessions.length).toBe(1)
    await delay(150)

    const id = call(agent)
    await respond(tabB, id)
    expect(await agent.inbox.wait(isResult(id))).toMatchObject({
      session: { sessionId: 'b-1' },
      retargeted: true,
    })
    const pinnedId = call(agent)
    await respond(tabB, pinnedId)
    expect((await agent.inbox.wait(isResult(pinnedId))).retargeted).toBeUndefined()
  })

  it('reports a session name shared by two tabs as ambiguous', async () => {
    await start()
    const agent = await open(`${url}?role=agent`)
    await openDocument('a-1', 'tab-a', 1, 'shared')
    await openDocument('b-1', 'tab-b', 1, 'shared')
    await expect.poll(() => handle.bridge.getStatus().sessions.length).toBe(2)

    const id = call(agent, 'shared')
    const failed = await agent.inbox.wait(isResult(id))
    expect(failed).toMatchObject({
      ok: false,
      errorCode: 'unknown-session',
      errorDetails: { hubCode: 'SESSION_AMBIGUOUS' },
    })
    expect(failed.error).toContain('shared [tab-a]')
    expect(failed.error).toContain('shared [tab-b]')
  })

  it('reports readiness but fails the routed call when the default target is ambiguous', async () => {
    await start()
    const agent = await open(`${url}?role=agent`)
    await openDocument('a-1', 'tab-a', 1, 'alpha')
    await openDocument('b-1', 'tab-b', 1, 'beta')
    await expect.poll(() => handle.bridge.getStatus().sessions.length).toBe(2)

    const waitId = newId()
    send(agent.ws, {
      kind: 'agent/invoke',
      id: waitId,
      tool: 'devtools_wait',
      args: { condition: 'ready', timeoutMs: 2_000 },
    })
    expect((await agent.inbox.wait(isResult(waitId))).result.ok).toBe(true)

    const routedWaitId = newId()
    send(agent.ws, {
      kind: 'agent/invoke',
      id: routedWaitId,
      tool: 'devtools_wait',
      args: { condition: 'navigation', timeoutMs: 2_000 },
    })
    const routedWait = await agent.inbox.wait(isResult(routedWaitId), 1_000)
    expect(routedWait).toMatchObject({ ok: false, errorCode: 'unknown-session' })
    expect(routedWait.error).toContain('alpha [tab-a] at http://localhost/a-1')
  })
})
