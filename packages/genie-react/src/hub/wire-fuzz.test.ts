import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  agentMessageSchema,
  appMessageSchema,
  decodeFrame,
  encodeMessage,
  GENIE_REACT_VERSION,
  newId,
} from '../protocol'
import { createTestBridge, type Frame, isResult, open, send } from './bridge-test-harness'
import type { StandaloneBridgeHandle } from './standalone'

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

const VALID_FRAMES: unknown[] = [
  {
    kind: 'app/hello',
    protocol: 1,
    runtimeVersion: GENIE_REACT_VERSION,
    sessionId: 'fuzz-session',
    logicalSessionId: 'fuzz-tab',
    documentGeneration: 1,
    sessionName: 'fuzz',
    app: { name: 'fuzz', url: 'http://localhost/' },
    capabilities: ['react'],
    tools: [{ name: 'peek', title: 'Peek', description: '', group: 'app' }],
  },
  { kind: 'app/ready', sessionId: 'fuzz-session' },
  { kind: 'app/heartbeat', sessionId: 'fuzz-session' },
  {
    kind: 'app/response',
    id: 'request-1',
    ok: false,
    error: 'boom',
    errorCode: 'tool-error',
    errorDetails: { hubCode: 'SESSION_SUPERSEDED', mayHaveCompleted: true },
  },
  { kind: 'agent/invoke', id: 'call-1', tool: 'devtools_status', args: {}, timeoutMs: 1_000 },
  { kind: 'agent/ping', id: 'ping-1' },
]

const HOSTILE_VALUES: unknown[] = [
  null,
  -1,
  Number.MAX_SAFE_INTEGER,
  '',
  '\u0000\u001b[31m',
  'x'.repeat(10_000),
  [],
  {},
  { __proto__: { polluted: true } },
  Array.from({ length: 2_000 }, (_, index) => index),
]

const RAW_ATTACKS = [
  '',
  'not json',
  '{',
  'null',
  '[]',
  '{"json":{"kind":"app/hello"},"meta":{"values":{"__proto__.polluted":["undefined"]}}}',
  '{"json":{"a":1},"meta":{"referentialEqualities":{"a":["__proto__.polluted"]}}}',
  '{"json":{"kind":"app/response","id":"x","ok":true,"result":{"__proto__":{"polluted":1}}}}',
  '{"json":{"constructor":{"prototype":{"polluted":1}}}}',
  `{"json":${'['.repeat(5_000)}${']'.repeat(5_000)}}`,
]

function mutate(value: unknown, random: () => number, depth = 0): unknown {
  if (depth > 4 || random() < 0.15) {
    return HOSTILE_VALUES[Math.floor(random() * HOSTILE_VALUES.length)]
  }
  if (Array.isArray(value)) return value.map((item) => mutate(item, random, depth + 1))
  if (typeof value !== 'object' || value === null) return value
  const entries = Object.entries(value).filter(() => random() > 0.1)
  if (random() < 0.2) entries.push([`extra${Math.floor(random() * 10)}`, 'unexpected'])
  return Object.fromEntries(
    entries.map(([key, entry]) => [key, random() < 0.3 ? mutate(entry, random, depth + 1) : entry]),
  )
}

function* fuzzFrames(seed: number, count: number): Generator<string> {
  const random = mulberry32(seed)
  yield* RAW_ATTACKS
  for (let index = 0; index < count; index += 1) {
    const base = VALID_FRAMES[Math.floor(random() * VALID_FRAMES.length)]
    const encoded = encodeMessage(mutate(base, random))
    if (random() < 0.2) {
      const cut = Math.floor(random() * encoded.length)
      yield `${encoded.slice(0, cut)}${String.fromCharCode(Math.floor(random() * 128))}${encoded.slice(cut + 1)}`
    } else yield encoded
  }
}

describe('wire decoding under hostile input', () => {
  it('rejects or accepts every fuzzed frame quickly and never pollutes prototypes', () => {
    for (const raw of fuzzFrames(42, 3_000)) {
      const started = performance.now()
      for (const schema of [appMessageSchema, agentMessageSchema]) {
        try {
          schema.safeParse(decodeFrame(raw))
        } catch (error) {
          expect(error).toBeInstanceOf(Error)
        }
      }
      expect(performance.now() - started).toBeLessThan(250)
      expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    }
  })

  it('never lets an app frame carry hub-only failure details', () => {
    const parsed = appMessageSchema.parse(
      decodeFrame(encodeMessage(VALID_FRAMES[3])),
    ) as Extract<Frame, { kind: 'app/response' }>
    expect(parsed.errorDetails).toEqual({})
  })
})

describe('hub under hostile frames', () => {
  let handle: StandaloneBridgeHandle
  let url: string

  beforeEach(async () => {
    handle = createTestBridge()
    url = (await handle.listen()).url
  })

  afterEach(async () => {
    await handle.close()
  })

  async function status(agent: Awaited<ReturnType<typeof open>>): Promise<Frame> {
    const id = newId()
    send(agent.ws, { kind: 'agent/invoke', id, tool: 'devtools_status', args: {} })
    return agent.inbox.wait(isResult(id))
  }

  it('keeps routing for well-formed peers after fuzzed app and agent traffic', async () => {
    const hostileApp = await open(`${url}?role=app`)
    const hostileAgent = await open(`${url}?role=agent`)
    for (const raw of fuzzFrames(7, 600)) {
      hostileApp.ws.send(raw)
      hostileAgent.ws.send(raw)
    }
    const agent = await open(`${url}?role=agent`)
    const answered = await status(agent)
    expect(answered.ok).toBe(true)
    expect(answered.result.sessions.length).toBeLessThanOrEqual(1)
  })

  it('closes a socket that sends a frame above the size limit and stays up', async () => {
    const hostileApp = await open(`${url}?role=app`)
    const closed = new Promise<number>((resolve) => hostileApp.ws.once('close', resolve))
    hostileApp.ws.send('x'.repeat(65 * 1024 * 1024))
    expect(await closed).toBe(1009)
    const agent = await open(`${url}?role=agent`)
    expect((await status(agent)).ok).toBe(true)
  })
})
