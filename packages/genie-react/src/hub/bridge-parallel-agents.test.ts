import { afterEach, describe, expect, it } from 'vitest'
import type { WebSocket } from 'ws'
import { decodeFrame, GENIE_REACT_VERSION, newId } from '../protocol'
import {
  createTestBridge,
  type Frame,
  type Inbox,
  isResult,
  open,
  send,
} from './bridge-test-harness'
import type { StandaloneBridgeHandle } from './standalone'

interface Peer {
  ws: WebSocket
  inbox: Inbox
}

const readOnly = { readOnlyHint: true }
const TOOLS = [
  { name: 'react_clear_renders', annotations: { idempotentHint: false } },
  { name: 'react_profile_start', annotations: { idempotentHint: false } },
  { name: 'react_profile_stop', annotations: { idempotentHint: true } },
  { name: 'react_get_renders', annotations: readOnly },
  { name: 'react_profile_report', annotations: readOnly },
  { name: 'react_measure' },
  { name: 'react_override_props', annotations: { destructiveHint: true } },
  { name: 'react_list_overrides', annotations: readOnly },
  { name: 'react_reset_overrides', annotations: { destructiveHint: true } },
  { name: 'query_get', annotations: readOnly },
  { name: 'query_simulate_state', annotations: { destructiveHint: true } },
  { name: 'query_restore_state', annotations: { idempotentHint: true } },
  { name: 'timeline_start', annotations: readOnly },
  { name: 'timeline_stop', annotations: readOnly },
  { name: 'timeline_read', annotations: readOnly },
].map((tool) => ({ title: tool.name, description: tool.name, group: 'react', ...tool }))

/** The per-document state the real collectors keep: one render window, one override set, Query simulations and one retained timeline. */
class FakeDocument {
  epoch = 0
  overrides = 0
  readonly simulated = new Set<string>()
  timeline: { id: string; state: 'recording' | 'stopped' } | null = null

  constructor(
    readonly sessionId: string,
    readonly peer: Peer,
  ) {
    peer.ws.on('message', (data) => {
      const frame = decodeFrame(data.toString()) as Frame
      if (frame.kind !== 'bridge/request') return
      const reply = (ok: boolean, result?: unknown, error?: string) =>
        send(peer.ws, { kind: 'app/response', id: frame.id, ok, result, error })
      try {
        reply(true, this.run(frame.tool, frame.args ?? {}))
      } catch (error) {
        reply(false, undefined, error instanceof Error ? error.message : String(error))
      }
    })
  }

  /** A window reset the hub cannot see, such as app code clearing renders. */
  resetBehindTheHub(): void {
    this.epoch += 1
  }

  private observation() {
    return this.epoch === 0
      ? null
      : { id: `observation:${this.epoch}`, epoch: this.epoch, startedAfterDocumentCommitId: 0 }
  }

  private run(tool: string, args: Record<string, unknown>): unknown {
    switch (tool) {
      case 'react_clear_renders':
      case 'react_profile_start':
        this.epoch += 1
        return { ok: true, tracking: true, documentCommitId: 0, observation: this.observation() }
      case 'react_profile_stop':
        return { ok: true, tracking: false, commits: 0 }
      case 'react_get_renders':
        return {
          components: [],
          documentCommitId: 0,
          renderCollection: 'available',
          observation: this.observation(),
          from: this.sessionId,
        }
      case 'react_profile_report':
        return { components: [] }
      case 'react_measure':
        return { handle: 'span:1' }
      case 'react_override_props':
        this.overrides += 1
        return { ok: true }
      case 'react_list_overrides':
        return { overrides: [], total: this.overrides }
      case 'react_reset_overrides':
        this.overrides = 0
        return { ok: true, cleared: [], remaining: 0 }
      case 'query_get':
        return { queryHash: String(args.queryHash) }
      case 'query_simulate_state': {
        const queryHash = JSON.stringify(args.queryKey)
        this.simulated.add(queryHash)
        return { ok: true, queryHash, simulatedState: args.state, originalStatus: 'success' }
      }
      case 'query_restore_state': {
        const hashes = args.all === true ? [...this.simulated] : [JSON.stringify(args.queryKey)]
        for (const queryHash of hashes) this.simulated.delete(queryHash)
        return {
          ok: true,
          restored: hashes.length,
          outcomes: hashes.map((queryHash) => ({
            queryHash,
            outcome: 'restored',
            refetched: false,
          })),
        }
      }
      case 'timeline_start':
        if (this.timeline?.state === 'recording')
          throw new Error(
            'A timeline recording is already active. Stop it before starting another.',
          )
        this.timeline = { id: `timeline-${newId()}`, state: 'recording' }
        return { id: this.timeline.id, state: 'recording', maxDurationMs: 30_000 }
      case 'timeline_stop':
      case 'timeline_read': {
        const timeline = this.timeline
        if (timeline === null || timeline.id !== args.id)
          throw new Error(`Unknown or expired timeline recording: ${String(args.id)}.`)
        if (tool === 'timeline_stop') timeline.state = 'stopped'
        return { id: timeline.id, state: timeline.state, events: [] }
      }
      default:
        throw new Error(`unknown tool ${tool}`)
    }
  }
}

describe('GenieBridge with several agents on one hub', () => {
  let handle: StandaloneBridgeHandle
  let url: string

  afterEach(async () => {
    await handle.close()
  })

  const start = async () => {
    handle = createTestBridge()
    url = (await handle.listen()).url
  }

  const openTab = async (
    sessionId: string,
    sessionName?: string,
    logicalSessionId = `tab-${sessionId}`,
    documentGeneration = 1,
  ): Promise<FakeDocument> => {
    const peer = await open(`${url}?role=app`)
    send(peer.ws, {
      kind: 'app/hello',
      protocol: 1,
      runtimeVersion: GENIE_REACT_VERSION,
      sessionId,
      logicalSessionId,
      documentGeneration,
      ...(sessionName === undefined ? {} : { sessionName }),
      app: { name: sessionId },
      capabilities: ['react'],
      tools: TOOLS,
    })
    send(peer.ws, { kind: 'app/ready', sessionId })
    const document = new FakeDocument(sessionId, peer)
    await expect
      .poll(() => handle.bridge.getStatus().sessions.some((s) => s.sessionId === sessionId))
      .toBe(true)
    return document
  }

  /** One agent: every CLI process it runs sends the same caller identity; `undefined` is a caller that sends none. */
  const agent = async (caller: string | undefined) => {
    const peer = await open(`${url}?role=agent`)
    return async (tool: string, args: unknown = {}, sessionId?: string): Promise<Frame> => {
      const id = newId()
      send(peer.ws, {
        kind: 'agent/invoke',
        id,
        tool,
        args,
        ...(sessionId === undefined ? {} : { sessionId }),
        ...(caller === undefined ? {} : { caller }),
      })
      return peer.inbox.wait(isResult(id), 5_000)
    }
  }

  const supersededBy = (cause: string, tool?: string) => ({
    ok: false,
    errorCode: 'conflict',
    errorDetails: {
      hubCode: 'OBSERVATION_SUPERSEDED',
      ownership: { resource: 'render-window', cause, ...(tool === undefined ? {} : { tool }) },
    },
  })

  describe('render windows', () => {
    it('fails the first agent read once a second agent restarted the window, and tells the second', async () => {
      await start()
      await openTab('tab')
      const first = await agent('agent-a')
      const second = await agent('agent-b')

      expect((await first('react_clear_renders', {}, 'tab')).ok).toBe(true)
      expect(await second('react_clear_renders', {}, 'tab')).toMatchObject({
        ok: true,
        displaced: { resource: 'render-window', otherCallers: 1 },
        sharedWith: 1,
      })

      expect(await first('react_get_renders', {}, 'tab')).toMatchObject(
        supersededBy('restarted', 'react_clear_renders'),
      )
      expect(await second('react_get_renders', {}, 'tab')).toMatchObject({
        ok: true,
        result: { observation: { id: 'observation:2' } },
      })
    })

    it('keeps failing the superseded reader until it starts its own window again', async () => {
      await start()
      await openTab('tab')
      const first = await agent('agent-a')
      const second = await agent('agent-b')
      await first('react_clear_renders', {}, 'tab')
      await second('react_profile_start', {}, 'tab')

      expect((await first('react_get_renders', {}, 'tab')).ok).toBe(false)
      expect((await first('react_profile_report', {}, 'tab')).ok).toBe(false)
      await first('react_clear_renders', {}, 'tab')
      expect(await first('react_get_renders', {}, 'tab')).toMatchObject({
        ok: true,
        result: { observation: { id: 'observation:3' } },
      })
    })

    it('fails the window owner after another agent pauses profiling or changes app state inside it', async () => {
      await start()
      await openTab('tab')
      const owner = await agent('owner')
      const other = await agent('other')

      await owner('react_clear_renders', {}, 'tab')
      await other('react_profile_stop', {}, 'tab')
      expect(await owner('react_get_renders', {}, 'tab')).toMatchObject(
        supersededBy('paused', 'react_profile_stop'),
      )

      await owner('react_clear_renders', {}, 'tab')
      expect((await other('react_override_props', { id: 1, props: {} }, 'tab')).displaced).toEqual({
        resource: 'render-window',
        otherCallers: 1,
      })
      expect(await owner('react_get_renders', {}, 'tab')).toMatchObject(
        supersededBy('changed-state', 'react_override_props'),
      )
    })

    it('does not fail an agent for its own resets, reads by others, or instrumentation-only calls', async () => {
      await start()
      await openTab('tab')
      const owner = await agent('owner')
      const reader = await agent('reader')

      await owner('react_clear_renders', {}, 'tab')
      await owner('react_profile_stop', {}, 'tab')
      await owner('react_clear_renders', {}, 'tab')
      await reader('react_get_renders', {}, 'tab')
      await reader('react_measure', { label: 'span' }, 'tab')
      await reader('query_get', { queryHash: 'q' }, 'tab')

      expect(await owner('react_get_renders', {}, 'tab')).toMatchObject({
        ok: true,
        result: { observation: { id: 'observation:2' } },
      })
      expect(await reader('react_get_renders', {}, 'tab')).toMatchObject({ ok: true })
    })

    it('fails a read whose observation differs from the caller window even when the hub did not see the reset', async () => {
      await start()
      const tab = await openTab('tab')
      const owner = await agent('owner')
      await owner('react_clear_renders', {}, 'tab')
      tab.resetBehindTheHub()

      const read = await owner('react_get_renders', {}, 'tab')
      expect(read).toMatchObject(supersededBy('restarted'))
      expect(read.errorDetails.ownership.tool).toBeUndefined()
    })

    it('separates a caller that sends no identity from one that does', async () => {
      await start()
      await openTab('tab')
      const legacy = await agent(undefined)
      const named = await agent('named')
      await legacy('react_clear_renders', {}, 'tab')
      await named('react_clear_renders', {}, 'tab')

      expect((await legacy('react_get_renders', {}, 'tab')).errorDetails?.hubCode).toBe(
        'OBSERVATION_SUPERSEDED',
      )
    })

    it('fails a read after the tab reloaded instead of returning the new document window', async () => {
      await start()
      await openTab('first-load')
      const owner = await agent('owner')
      const other = await agent('other')
      await owner('react_clear_renders', {}, 'tab-first-load')
      const reloaded = await openTab('second-load', undefined, 'tab-first-load', 2)
      await other('react_clear_renders', {}, 'tab-first-load')
      expect(reloaded.epoch).toBe(1)

      expect(await owner('react_get_renders', {}, 'tab-first-load')).toMatchObject(
        supersededBy('reloaded'),
      )
    })

    it('keeps windows on different tabs independent', async () => {
      await start()
      await openTab('left')
      await openTab('right')
      const first = await agent('agent-a')
      const second = await agent('agent-b')
      await first('react_clear_renders', {}, 'left')
      await second('react_clear_renders', {}, 'right')
      await second('react_override_props', { id: 1, props: {} }, 'right')

      expect(await first('react_get_renders', {}, 'left')).toMatchObject({
        ok: true,
        result: { from: 'left', observation: { id: 'observation:1' } },
      })
    })

    it('fails an interaction stop when another agent reset its window, but a capture by an uninvolved agent still works', async () => {
      await start()
      await openTab('tab')
      const owner = await agent('owner')
      const other = await agent('other')
      const begun = await owner('devtools_interaction_begin', { name: 'typing' }, 'tab')
      expect(begun.ok).toBe(true)
      await other('react_clear_renders', {}, 'tab')

      expect(
        await owner(
          'devtools_interaction_stop',
          { interactionId: begun.result.interactionId, quietMs: 100, timeoutMs: 1_000 },
          'tab',
        ),
      ).toMatchObject(supersededBy('restarted', 'react_clear_renders'))
      expect(
        await owner('devtools_capture_create', { name: 'after', include: ['react'] }, 'tab'),
      ).toMatchObject(supersededBy('restarted', 'react_clear_renders'))
    })
  })

  describe('applied state', () => {
    it('refuses to reset overrides another agent applied until that agent resets them', async () => {
      await start()
      const tab = await openTab('tab')
      const applier = await agent('applier')
      const resetter = await agent('resetter')
      await applier('react_override_props', { id: 1, props: {} }, 'tab')

      expect(await resetter('react_reset_overrides', {}, 'tab')).toMatchObject({
        ok: false,
        errorCode: 'conflict',
        errorDetails: {
          hubCode: 'STATE_HELD',
          ownership: { resource: 'overrides', cause: 'held', otherCallers: 1 },
        },
      })
      expect(tab.overrides).toBe(1)

      expect((await applier('react_reset_overrides', {}, 'tab')).ok).toBe(true)
      expect((await resetter('react_reset_overrides', {}, 'tab')).ok).toBe(true)
    })

    it('admits a reset once the app reports no override left, even if the holder never reset', async () => {
      await start()
      const tab = await openTab('tab')
      const applier = await agent('applier')
      const resetter = await agent('resetter')
      await applier('react_override_props', { id: 1, props: {} }, 'tab')
      tab.overrides = 0

      expect((await resetter('react_reset_overrides', {}, 'tab')).ok).toBe(true)
    })

    it('refuses to restore or re-simulate a Query another agent simulates, and allows other queries', async () => {
      await start()
      const tab = await openTab('tab')
      const simulator = await agent('simulator')
      const other = await agent('other')
      await simulator('query_simulate_state', { queryKey: ['todos'], state: 'error' }, 'tab')

      for (const args of [{ all: true }, { queryKey: ['todos'] }]) {
        expect((await other('query_restore_state', args, 'tab')).errorDetails).toMatchObject({
          hubCode: 'STATE_HELD',
          ownership: { resource: 'query-simulation' },
        })
      }
      expect(
        (await other('query_simulate_state', { queryKey: ['todos'], state: 'pending' }, 'tab'))
          .errorDetails?.hubCode,
      ).toBe('STATE_HELD')
      expect(tab.simulated).toEqual(new Set([JSON.stringify(['todos'])]))

      expect(
        (await other('query_simulate_state', { queryKey: ['user'], state: 'pending' }, 'tab')).ok,
      ).toBe(true)
      expect((await simulator('query_restore_state', { queryKey: ['todos'] }, 'tab')).ok).toBe(true)
      expect((await other('query_restore_state', { all: true }, 'tab')).ok).toBe(true)
    })
  })

  describe('timeline recordings', () => {
    it('refuses a second agent start while the first records, then reports the replaced recording to its owner', async () => {
      await start()
      await openTab('tab')
      const first = await agent('first')
      const second = await agent('second')
      const recording = await first('timeline_start', { name: 'one' }, 'tab')

      expect(await second('timeline_start', { name: 'two' }, 'tab')).toMatchObject({
        ok: false,
        errorDetails: { hubCode: 'STATE_HELD', ownership: { resource: 'timeline' } },
      })
      await first('timeline_stop', { id: recording.result.id }, 'tab')
      expect((await second('timeline_start', { name: 'two' }, 'tab')).ok).toBe(true)

      expect(await first('timeline_read', { id: recording.result.id }, 'tab')).toMatchObject({
        ok: false,
        errorCode: 'conflict',
        errorDetails: {
          hubCode: 'OBSERVATION_SUPERSEDED',
          ownership: { resource: 'timeline', cause: 'restarted', tool: 'timeline_start' },
        },
      })
    })

    it('lets one agent replace its own stopped recording without a conflict', async () => {
      await start()
      await openTab('tab')
      const only = await agent('only')
      const one = await only('timeline_start', { name: 'one' }, 'tab')
      await only('timeline_stop', { id: one.result.id }, 'tab')
      await only('timeline_start', { name: 'two' }, 'tab')

      const read = await only('timeline_read', { id: one.result.id }, 'tab')
      expect(read.ok).toBe(false)
      expect(read.errorCode).not.toBe('conflict')
    })
  })

  describe('default tab', () => {
    it('keeps each agent on its own first tab instead of one hub-wide default', async () => {
      await start()
      await openTab('first-tab')
      const early = await agent('early')
      expect((await early('react_get_renders')).result.from).toBe('first-tab')
      await openTab('second-tab')
      const late = await agent('late')

      expect((await late('react_get_renders')).result.from).toBe('second-tab')
      expect((await early('react_get_renders')).result.from).toBe('first-tab')
    })

    it('refuses an untargeted call when the only tab is in use by another agent, and allows an explicit share', async () => {
      await start()
      await openTab('busy-tab', 'checkout')
      const owner = await agent('owner')
      await owner('react_get_renders', {}, 'checkout')
      const stranger = await agent('stranger')

      expect(await stranger('react_get_renders')).toMatchObject({
        ok: false,
        errorCode: 'unknown-session',
        errorDetails: {
          hubCode: 'SESSION_CLAIMED',
          ownership: { resource: 'tab', cause: 'claimed', otherCallers: 1 },
        },
      })
      expect(await stranger('react_get_renders', {}, 'checkout')).toMatchObject({
        ok: true,
        sharedWith: 1,
      })
      expect((await stranger('react_get_renders')).ok).toBe(true)
    })

    it('marks a tab another agent claimed in the status each agent reads, and not for the agents that used it', async () => {
      await start()
      await openTab('busy-tab', 'checkout')
      await openTab('free-tab')
      const owner = await agent('owner')
      await owner('react_get_renders', {}, 'checkout')
      const stranger = await agent('stranger')
      const claimed = async (ask: Awaited<ReturnType<typeof agent>>) =>
        Object.fromEntries(
          (await ask('devtools_status', {})).result.sessions.map(
            (session: { sessionId: string; claimedByOthers?: true }) => [
              session.sessionId,
              session.claimedByOthers ?? false,
            ],
          ),
        )

      expect(await claimed(stranger)).toEqual({ 'busy-tab': true, 'free-tab': false })
      expect(await claimed(owner)).toEqual({ 'busy-tab': false, 'free-tab': false })
      await stranger('react_get_renders', {}, 'checkout')
      expect(await claimed(stranger)).toEqual({ 'busy-tab': false, 'free-tab': false })
    })

    it('reports the app ready to an agent whose only tab another agent claimed, so its own targeted call can run', async () => {
      await start()
      await openTab('busy-tab', 'checkout')
      const owner = await agent('owner')
      await owner('react_get_renders', {}, 'checkout')
      const newcomer = await agent('newcomer')

      expect(
        await newcomer('devtools_wait', { condition: 'ready', timeoutMs: 1_000 }),
      ).toMatchObject({ ok: true, result: { ok: true } })
    })

    it('keeps single-agent untargeted use unchanged', async () => {
      await start()
      await openTab('solo')
      const solo = await agent('solo-agent')
      const first = await solo('react_get_renders')
      expect(first.ok).toBe(true)
      expect(first.sharedWith).toBeUndefined()
      expect((await solo('react_clear_renders')).displaced).toBeUndefined()
      expect((await solo('react_get_renders')).ok).toBe(true)
    })

    it('treats a malformed caller identity as no identity instead of dropping the call', async () => {
      await start()
      await openTab('tab')
      const malformed = await agent('has spaces and $')
      expect((await malformed('react_get_renders')).ok).toBe(true)
    })
  })
})
