import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decodeFrame, encodeMessage } from 'genie-react/protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebSocketServer } from 'ws'
import { runBatch, runCall, runStatus, runTools } from './agent'

interface Greeting {
  connected: boolean
  ready: boolean
}

interface ScriptedHub {
  url: string
  upgrades: URLSearchParams[]
  invoked: Array<{ tool: string; sessionId?: string; args: unknown }>
}

const cleanups: Array<() => unknown> = []

afterEach(async () => {
  vi.restoreAllMocks()
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

/** A hub stand-in that greets with `greeting`, records every upgrade and invoke, answers `devtools_wait` with `waitOk`, and any tool in `answers` with its entry. */
async function scriptedHub(
  greeting: Greeting,
  waitOk = true,
  answers: Record<string, unknown> = {},
): Promise<ScriptedHub> {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' })
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const hub: Omit<ScriptedHub, 'url'> = { upgrades: [], invoked: [] }
  const status = {
    ...greeting,
    sessionId: greeting.ready ? 'tab-1' : null,
    app: null,
    domains: [],
    tools: [],
    sessions: [],
    warnings: [],
  }
  server.on('connection', (socket, request) => {
    hub.upgrades.push(new URL(request.url ?? '/', 'http://hub').searchParams)
    socket.send(encodeMessage({ kind: 'bridge/status', ...status }))
    socket.on('message', (data) => {
      const message = decodeFrame(data.toString()) as {
        id: string
        tool: string
        sessionId?: string
        args: unknown
      }
      hub.invoked.push({ tool: message.tool, sessionId: message.sessionId, args: message.args })
      const result =
        message.tool in answers
          ? answers[message.tool]
          : message.tool === 'devtools_wait'
            ? { ok: waitOk, condition: 'ready', waitedMs: 1, validConditions: ['ready'] }
            : message.tool === 'devtools_status'
              ? { ...status, toolCount: 0 }
              : { value: 'answered' }
      socket.send(encodeMessage({ kind: 'bridge/result', id: message.id, ok: true, result }))
    })
  })
  cleanups.push(() => new Promise((resolve) => server.close(resolve)))
  const address = server.address()
  if (typeof address !== 'object' || address === null) throw new Error('no port')
  return { ...hub, url: `ws://127.0.0.1:${address.port}/__genie/ws` }
}

function options(hub: ScriptedHub) {
  const cwd = mkdtempSync(join(tmpdir(), 'genie-connection-'))
  cleanups.push(() => rmSync(cwd, { recursive: true, force: true }))
  return { cwd, url: hub.url, token: 'scripted-token', waitMs: 2_000, connectTimeoutMs: 2_000 }
}

function captureStdout(): () => string {
  const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  return () => write.mock.calls.map(([chunk]) => String(chunk)).join('')
}

describe('call --fail-on-result-error', () => {
  const compare = (overall: string) => ({
    overall,
    violations:
      overall === 'fail'
        ? [{ metric: 'react.selfTimeMs', reasons: ['candidate median 46.2 exceeds maxValue 8'] }]
        : [],
  })
  const args = '{"baselineCaptureIds":["cap_a"],"candidateCaptureIds":["cap_b"]}'

  it.each([
    ['fail', true, 1],
    ['fail', false, 0],
    ['pass', true, 0],
    ['inconclusive', true, 0],
  ])(
    'exits on a compare reporting overall %s with the flag %s as %i',
    async (overall, failOnResultError, expected) => {
      const hub = await scriptedHub({ connected: true, ready: true }, true, {
        devtools_capture_compare: compare(overall),
      })
      const stdout = captureStdout()

      const code = await runCall('devtools_capture_compare', args, {
        ...options(hub),
        json: true,
        failOnResultError,
      })

      expect(code).toBe(expected)
      expect(JSON.parse(stdout())).toMatchObject({ overall })
    },
  )
})

describe('one-shot commands and the hub greeting', () => {
  it('calls a tool without a readiness round trip when the greeting reports a ready tab', async () => {
    const hub = await scriptedHub({ connected: true, ready: true })
    const stdout = captureStdout()

    const code = await runCall('app_echo', '{"n":1}', options(hub))

    expect(code).toBe(0)
    expect(hub.invoked).toEqual([{ tool: 'app_echo', args: { n: 1 } }])
    expect(stdout()).toContain('answered')
  })

  it.each([
    { connected: false, ready: false },
    { connected: true, ready: false },
    { connected: false, ready: true },
  ])('waits for a ready app first when the greeting reports %o', async (greeting) => {
    const hub = await scriptedHub(greeting)
    captureStdout()

    const code = await runCall('app_echo', '{}', options(hub))

    expect(code).toBe(0)
    expect(hub.invoked.map(({ tool }) => tool)).toEqual(['devtools_wait', 'app_echo'])
    expect(hub.invoked[0]).toEqual({
      tool: 'devtools_wait',
      args: { condition: 'ready', timeoutMs: 2_000 },
    })
  })

  it('still reports not_connected when the readiness wait fails', async () => {
    const hub = await scriptedHub({ connected: false, ready: false }, false)
    const stdout = captureStdout()

    const code = await runCall('app_echo', '{}', options(hub))

    expect(code).toBe(1)
    expect(hub.invoked.map(({ tool }) => tool)).toEqual(['devtools_wait'])
    expect(JSON.parse(stdout())).toMatchObject({ status: 'error', reason: 'not_connected' })
  })

  it('runs a batch over one connection without a readiness round trip', async () => {
    const hub = await scriptedHub({ connected: true, ready: true })
    captureStdout()

    const code = await runBatch('[{"tool":"app_a"},{"tool":"app_b","args":{"x":1}}]', options(hub))

    expect(code).toBe(0)
    expect(hub.upgrades).toHaveLength(1)
    expect(hub.invoked.map(({ tool }) => tool)).toEqual(['app_a', 'app_b'])
  })

  it.each([
    ['status', (opts: ReturnType<typeof options>) => runStatus(opts)],
    ['call', (opts: ReturnType<typeof options>) => runCall('app_echo', '{}', opts)],
    ['batch', (opts: ReturnType<typeof options>) => runBatch('[{"tool":"app_echo"}]', opts)],
  ])('%s asks the hub to leave the tool catalog out of status frames', async (_, run) => {
    const hub = await scriptedHub({ connected: true, ready: true })
    captureStdout()

    await run(options(hub))

    expect(hub.upgrades.map((query) => Object.fromEntries(query))).toEqual([
      { role: 'agent', tools: 'none' },
    ])
  })

  it('tools keeps the catalog in status frames, since it lists them', async () => {
    const hub = await scriptedHub({ connected: true, ready: true })
    captureStdout()

    await runTools(undefined, { ...options(hub), waitMs: 200 })

    expect(hub.upgrades.map((query) => Object.fromEntries(query))).toEqual([{ role: 'agent' }])
  })

  it('tools gives up after --wait even while the hub never finishes the handshake', async () => {
    const silent = createServer((socket) => socket.resume())
    await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve))
    cleanups.push(() => new Promise((resolve) => silent.close(resolve)))
    const address = silent.address()
    if (typeof address !== 'object' || address === null) throw new Error('no port')
    const stdout = captureStdout()
    const started = Date.now()

    const code = await runTools(undefined, {
      ...options({ url: `ws://127.0.0.1:${address.port}/__genie/ws`, upgrades: [], invoked: [] }),
      waitMs: 200,
      connectTimeoutMs: 5_000,
    })

    expect(code).toBe(1)
    expect(Date.now() - started).toBeLessThan(2_000)
    expect(JSON.parse(stdout())).toMatchObject({ reason: 'not_connected' })
  })
})
