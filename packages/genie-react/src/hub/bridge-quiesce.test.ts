import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { decodeFrame, newId, reactQuiesceContract } from '../protocol'
import { createTestBridge, type Frame, isResult, open, send } from './bridge-test-harness'
import type { StandaloneBridgeHandle } from './standalone'

describe('react_quiesce', () => {
  let handle: StandaloneBridgeHandle
  let url: string
  beforeEach(async () => {
    handle = createTestBridge()
    url = (await handle.listen()).url
  })
  afterEach(async () => {
    await handle.close()
  })

  async function app(
    sample: (index: number) => {
      commit?: number
      collection?: string
      fail?: boolean
      silent?: boolean
      replace?: boolean
      refresh?: boolean
    },
  ) {
    const { ws } = await open(`${url}?role=app`)
    let checks = 0
    const hello = (generation = 1) =>
      send(ws, {
        kind: 'app/hello',
        protocol: 1,
        sessionId: 'quiesce-app',
        documentGeneration: generation,
        app: { name: 'test' },
        capabilities: ['react'],
        tools: [{ name: 'react_get_renders', title: 'renders', description: '', group: 'react' }],
      })
    ws.on('message', (data) => {
      const request = decodeFrame(data.toString()) as Frame
      if (request.kind !== 'bridge/request') return
      expect(request.tool).toBe('react_get_renders')
      expect(request.args.includeCursor).toBe(false)
      const value = sample(++checks)
      if (value.replace) hello(2)
      if (value.refresh) hello()
      if (value.silent) return
      send(ws, {
        kind: 'app/response',
        id: request.id,
        ok: !value.fail,
        result: {
          documentCommitId: value.commit ?? 10,
          renderCollection: value.collection ?? 'available',
        },
      })
    })
    hello()
    return () => checks
  }

  async function invoke(args: unknown) {
    const { ws, inbox } = await open(`${url}?role=agent`)
    const id = newId()
    send(ws, { kind: 'agent/invoke', id, tool: 'react_quiesce', args })
    return inbox.wait(isResult(id))
  }

  it('counts commits between samples and reaches idle after the last change', async () => {
    await app((index) => ({ commit: index === 1 ? 10 : 13 }))
    const response = await invoke({ idleMs: 100, timeoutMs: 1500 })
    expect(response.ok).toBe(true)
    const result = reactQuiesceContract.output.parse(response.result)
    expect(result).toMatchObject({
      ok: true,
      outcome: 'idle',
      observedCommits: 3,
      documentCommitId: 13,
      pendingWork: null,
    })
    expect(result.elapsedMs).toBeGreaterThanOrEqual(250)
  })

  it('reports timed-out while commits keep arriving', async () => {
    await app((index) => ({ commit: index }))
    const response = await invoke({ idleMs: 100, timeoutMs: 350 })
    expect(response.result).toMatchObject({ ok: false, outcome: 'timed-out', observedCommits: 2 })
    expect(response.result.elapsedMs).toBeLessThan(1000)
  })

  it('bounds an unresponsive app request by the quiesce deadline', async () => {
    await app(() => ({ silent: true }))
    const response = await invoke({ idleMs: 100, timeoutMs: 150 })
    expect(response.result).toMatchObject({
      ok: false,
      outcome: 'timed-out',
      observedCommits: 0,
      documentCommitId: null,
    })
    expect(response.result.elapsedMs).toBeLessThan(1000)
  })

  it('does not count a failed sample as quiet time', async () => {
    const checks = await app((index) => ({ fail: index === 2 }))
    const response = await invoke({ idleMs: 200, timeoutMs: 1500 })
    expect(response.result.outcome).toBe('idle')
    expect(checks()).toBeGreaterThanOrEqual(5)
  })

  it.each(['unavailable (hook missing)', 'unexpected'])(
    'rejects unsupported collection %s',
    async (collection) => {
      await app(() => ({ collection }))
      expect((await invoke({ idleMs: 100 })).result).toMatchObject({
        ok: false,
        outcome: 'unavailable',
        renderCollection: collection,
      })
    },
  )

  it('retains historical degradation while proving a fresh idle window', async () => {
    const collection = 'degraded (hook installed late)'
    await app(() => ({ collection }))
    expect((await invoke({ idleMs: 100 })).result).toMatchObject({
      outcome: 'idle',
      renderCollection: collection,
      observedCommits: 0,
    })
  })

  it('rejects a reset document counter instead of subtracting across epochs', async () => {
    await app((index) => ({ commit: index === 1 ? 10 : 1 }))
    expect((await invoke({ idleMs: 100 })).result).toMatchObject({
      outcome: 'unavailable',
      observedCommits: 0,
    })
  })

  it('accepts a same-document catalog refresh while sampling', async () => {
    await app((index) => ({ refresh: index === 2 }))
    expect((await invoke({ idleMs: 100 })).result).toMatchObject({ outcome: 'idle' })
  })

  it('rejects a changed app document while sampling', async () => {
    await app((index) => ({ replace: index === 2 }))
    expect((await invoke({ idleMs: 100 })).result).toMatchObject({ outcome: 'unavailable' })
  })

  it('reports unavailable without a connected document', async () => {
    expect((await invoke({})).result).toMatchObject({
      outcome: 'unavailable',
      documentCommitId: null,
      sessionId: null,
    })
  })

  it.each([{ idleMs: 0 }, { timeoutMs: 0 }, { timeoutMs: 60001 }, { quietMs: 500 }])(
    'rejects invalid input %j',
    async (args) => {
      expect(await invoke(args)).toMatchObject({ ok: false, errorCode: 'invalid-args' })
    },
  )
})

describe('react_quiesce pending React work', () => {
  let handle: StandaloneBridgeHandle
  let url: string
  beforeEach(async () => {
    handle = createTestBridge()
    url = (await handle.listen()).url
  })
  afterEach(async () => {
    await handle.close()
  })

  const idleWork = {
    scheduledRoots: 0,
    suspendedBoundaries: 0,
    boundaries: [],
    scanTruncated: false,
  }

  async function app(
    pendingWork: (index: number) => unknown,
    commit: () => number = () => 10,
    answers: (tool: string) => boolean = () => true,
  ) {
    const { ws } = await open(`${url}?role=app`)
    let probes = 0
    ws.on('message', (data) => {
      const request = decodeFrame(data.toString()) as Frame
      if (request.kind !== 'bridge/request') return
      if (!answers(request.tool)) return
      const work = request.tool === 'react_pending_work' ? pendingWork(++probes) : undefined
      send(ws, {
        kind: 'app/response',
        id: request.id,
        ok: work !== 'fail',
        result:
          request.tool === 'react_pending_work'
            ? work
            : { documentCommitId: commit(), renderCollection: 'available' },
      })
    })
    send(ws, {
      kind: 'app/hello',
      protocol: 1,
      sessionId: 'pending-app',
      app: { name: 'test' },
      capabilities: ['react'],
      tools: [
        { name: 'react_get_renders', title: 'renders', description: '', group: 'react' },
        { name: 'react_pending_work', title: 'pending', description: '', group: 'react' },
      ],
    })
    return () => probes
  }

  async function invoke(args: unknown) {
    const { ws, inbox } = await open(`${url}?role=agent`)
    const id = newId()
    send(ws, { kind: 'agent/invoke', id, tool: 'react_quiesce', args })
    return reactQuiesceContract.output.parse((await inbox.wait(isResult(id))).result)
  }

  it('waits for a pending transition to clear before reporting idle', async () => {
    const probes = await app((index) => ({
      ...idleWork,
      documentCommitId: 10,
      scheduledRoots: index < 3 ? 1 : 0,
    }))
    const result = await invoke({ idleMs: 100, timeoutMs: 3_000 })
    expect(result).toMatchObject({ outcome: 'idle', pendingWork: { scheduledRoots: 0 } })
    expect(probes()).toBeGreaterThanOrEqual(3)
  })

  it('restarts the quiet window when a commit lands while pending work is read', async () => {
    let commit = 10
    await app(
      (index) => {
        if (index === 1) commit = 11
        return { ...idleWork, documentCommitId: commit }
      },
      () => commit,
    )
    const started = Date.now()
    const result = await invoke({ idleMs: 300, timeoutMs: 3_000 })
    expect(result).toMatchObject({ outcome: 'idle', documentCommitId: 11 })
    expect(Date.now() - started).toBeGreaterThanOrEqual(600)
  })

  it('never reports idle while pending work cannot be read', async () => {
    await app(() => 'fail')
    const result = await invoke({ idleMs: 100, timeoutMs: 600 })
    expect(result).toMatchObject({ ok: false, outcome: 'timed-out', pendingWork: null })
    expect(result.reason).toContain('Pending React work could not be read')
  })

  it('names the blocking boundaries when pending work outlasts the timeout', async () => {
    await app(() => ({
      ...idleWork,
      documentCommitId: 10,
      suspendedBoundaries: 2,
      boundaries: [
        { boundaryId: 1, boundaryName: 'ProductList' },
        { boundaryId: 2, boundaryName: 'Reviews\u001b[2J' },
      ],
    }))
    const result = await invoke({ idleMs: 100, timeoutMs: 600 })
    expect(result).toMatchObject({ outcome: 'timed-out', pendingWork: { suspendedBoundaries: 2 } })
    expect(result.reason).toContain(
      '2 Suspense boundaries show a fallback (ProductList, Reviews?[2J)',
    )
  })

  it.each(['react_get_renders', 'react_pending_work'])(
    'keeps naming the boundary when the deadline cuts off a %s probe after it was seen',
    async (cutOff) => {
      let blockerSeen = false
      await app(
        () => {
          blockerSeen = true
          return {
            ...idleWork,
            documentCommitId: 10,
            suspendedBoundaries: 1,
            boundaries: [{ boundaryId: 1, boundaryName: 'ProductList' }],
          }
        },
        () => 10,
        (tool) => !(blockerSeen && tool === cutOff),
      )
      const result = await invoke({ idleMs: 100, timeoutMs: 2_000 })
      expect(result).toMatchObject({
        outcome: 'timed-out',
        pendingWork: { suspendedBoundaries: 1 },
      })
      expect(result.reason).toBe(
        'React work is still pending: 1 Suspense boundary shows a fallback (ProductList).',
      )
    },
  )

  it('stays pending while a server-rendered boundary has not hydrated, without calling it a fallback', async () => {
    await app(() => ({
      ...idleWork,
      documentCommitId: 10,
      dehydratedBoundaries: 1,
      boundaries: [{ boundaryId: 3, boundaryName: 'Comments', state: 'dehydrated' }],
    }))
    const result = await invoke({ idleMs: 100, timeoutMs: 600 })
    expect(result).toMatchObject({
      outcome: 'timed-out',
      pendingWork: { suspendedBoundaries: 0, dehydratedBoundaries: 1 },
    })
    expect(result.reason).toContain(
      '1 server-rendered Suspense boundary has not hydrated (Comments)',
    )
    expect(result.reason).not.toContain('fallback')
  })
})
