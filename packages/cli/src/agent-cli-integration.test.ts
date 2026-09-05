import { createStandaloneBridge } from 'genie-react/hub'
import { decodeFrame, encodeMessage } from 'genie-react/protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebSocket } from 'ws'
import { runBatch, runCall, runStatus, runTools } from './agent'

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function waitUntil(predicate: () => boolean, timeoutMs = 4_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await delay(10)
  }
  throw new Error('waitUntil timed out')
}

describe('agent CLI integration', () => {
  const cleanups: Array<() => void | Promise<void>> = []

  afterEach(async () => {
    vi.restoreAllMocks()
    for (const cleanup of cleanups.reverse()) await cleanup()
    cleanups.length = 0
  })

  async function fixture(sessionId = 'json-session') {
    const bridge = createStandaloneBridge()
    cleanups.push(() => bridge.close())
    const { url } = await bridge.listen()
    const app = new WebSocket(`${url}?role=app`)
    cleanups.push(() => app.close())
    await new Promise<void>((resolve, reject) => {
      app.once('open', resolve)
      app.once('error', reject)
    })
    app.on('message', (data) => {
      const message = decodeFrame(data.toString()) as {
        kind?: string
        id?: string
        args?: { empty?: boolean; large?: boolean; fail?: boolean; secretKeys?: boolean }
      }
      if (message.kind !== 'bridge/request') return
      app.send(
        encodeMessage(
          message.args?.fail
            ? {
                kind: 'app/response',
                id: message.id,
                ok: false,
                errorCode: 'invalid-args',
                error: 'secret-token: run $(steal-secret)',
              }
            : {
                kind: 'app/response',
                id: message.id,
                ok: true,
                result: message.args?.secretKeys
                  ? { 'secret-upstream-$(steal-secret)': true }
                  : {
                      rows: message.args?.empty
                        ? []
                        : [
                            {
                              id: 7,
                              name: 'counter',
                              detail: message.args?.large ? '界'.repeat(100_000) : 'ready',
                            },
                          ],
                    },
              },
        ),
      )
    })
    app.send(
      encodeMessage({
        kind: 'app/hello',
        protocol: 1,
        sessionId,
        app: { name: 'JSON fixture' },
        capabilities: ['query'],
        tools: [
          { name: 'query_rows', title: 'Rows', description: 'Returns rows.', group: 'query' },
        ],
      }),
    )
    app.send(encodeMessage({ kind: 'app/ready', sessionId }))
    await waitUntil(() => bridge.bridge.getStatus().ready)
    return { url }
  }

  it('preserves raw call and tool discovery shapes without --json and emits JSON status', async () => {
    const { url } = await fixture()
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    for (const command of [
      (json?: boolean) => runCall('query_rows', '{}', { url, json }),
      (json?: boolean) => runTools('query_rows', { url, json }),
      (json?: boolean) => runTools('query', { url, json }),
      (json?: boolean) => runTools(undefined, { url, json }),
      (json?: boolean) => runTools(undefined, { url, json, all: true }),
    ]) {
      expect(await command()).toBe(0)
      const defaultOutput = stdout.mock.calls.flat().join('')
      expect(() => JSON.parse(defaultOutput)).not.toThrow()
      stdout.mockClear()
      expect(await command(true)).toBe(0)
      expect(stdout.mock.calls.flat().join('')).toBe(defaultOutput)
      stdout.mockClear()
    }
    expect(await runStatus({ url })).toBe(0)
    expect(JSON.parse(stdout.mock.calls.flat().join(''))).toMatchObject({
      connected: true,
      ready: true,
      sessionId: 'json-session',
    })
    expect(stderr.mock.calls.flat().join('')).toBe('')
  })

  it('streams batch records by default and preserves the explicit --json array', async () => {
    const { url } = await fixture()
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const input = '[{"tool":"query_rows"},{"tool":"query_rows","args":{"empty":true}}]'
    expect(await runBatch(input, { url })).toBe(0)
    const rows = stdout.mock.calls
      .flat()
      .join('')
      .trimEnd()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(rows).toEqual([
      {
        schemaVersion: '1.0',
        tool: 'query_rows',
        ok: true,
        status: 'ok',
        result: { rows: [{ id: 7, name: 'counter', detail: 'ready' }] },
      },
      { schemaVersion: '1.0', tool: 'query_rows', ok: true, status: 'ok', result: { rows: [] } },
    ])
    stdout.mockClear()
    expect(await runBatch(input, { url, json: true })).toBe(0)
    expect(JSON.parse(stdout.mock.calls.flat().join(''))).toEqual(rows)
    stdout.mockClear()
    expect(await runBatch('[]', { url })).toBe(0)
    expect(stdout.mock.calls).toHaveLength(0)
    expect(await runBatch('[]', { url, json: true })).toBe(0)
    expect(stdout.mock.calls.flat().join('')).toBe('[]\n')
  })

  it('emits exactly zero bytes for an empty field projection and bounded JSON for oversized results', async () => {
    const { url } = await fixture()
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    expect(await runCall('query_rows', '{"empty":true}', { url, fields: ['id'] })).toBe(0)
    expect(stdout.mock.calls).toHaveLength(0)
    expect(await runCall('query_rows', '{}', { url, fields: ['id'] })).toBe(0)
    expect(stdout.mock.calls.flat().join('')).toBe('{"id":7}\n')
    stdout.mockClear()
    expect(await runCall('query_rows', '{"large":true}', { url })).toBe(0)
    const output = stdout.mock.calls.flat().join('')
    expect(Buffer.byteLength(output)).toBeLessThanOrEqual(262_144)
    expect(JSON.parse(output)).toMatchObject({
      status: 'truncated',
      reason: 'max-bytes',
      maxBytes: 262_144,
    })
  })

  it('keeps upstream instructions and unsafe session values out of trusted errors and diagnostics', async () => {
    const session = 'secret-session-$(steal-secret)'
    const { url } = await fixture(session)
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    expect(await runCall('query_rows', '{"fail":true}', { url, session, verbose: true })).toBe(1)
    const output = stdout.mock.calls.flat().join('')
    expect(JSON.parse(output)).toMatchObject({
      status: 'error',
      reason: 'invalid-args',
      userActionRequired: true,
      next: {
        command: 'genie-react tools query_rows',
        argv: ['genie-react', 'tools', 'query_rows'],
      },
    })
    expect(output).not.toContain('secret')
    const diagnostics = stderr.mock.calls.flat().join('')
    expect(diagnostics).not.toContain(session)
    expect(diagnostics).not.toContain(url)
    expect(
      diagnostics
        .trimEnd()
        .split('\n')
        .map((line) => JSON.parse(line)),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'diagnostic', reason: 'bridge-connect' }),
      ]),
    )
  })

  it.each([
    undefined,
    true,
  ])('returns a schema-versioned JSON failure for an unknown tool with json=%s', async (json) => {
    const bridge = createStandaloneBridge()
    cleanups.push(() => bridge.close())
    const { url } = await bridge.listen()

    const app = new WebSocket(`${url}?role=app`)
    cleanups.push(() => app.close())
    await new Promise<void>((resolve, reject) => {
      app.once('open', () => resolve())
      app.once('error', reject)
    })
    app.send(
      encodeMessage({
        kind: 'app/hello',
        protocol: 1,
        sessionId: 'session-1',
        app: { name: 'demo' },
        capabilities: ['query'],
        tools: [
          {
            name: 'query_list',
            title: 'List queries',
            description: 'List Query cache entries.',
            group: 'query',
          },
        ],
      }),
    )
    app.send(encodeMessage({ kind: 'app/ready', sessionId: 'session-1' }))
    await waitUntil(() => bridge.bridge.getStatus().ready)

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const exitCode = await runTools('secret-selector-$(steal-secret)', { url, json, waitMs: 1_000 })

    expect(exitCode).toBe(1)
    expect(stderr.mock.calls.flat().join('')).toBe('')
    expect(JSON.parse(stdout.mock.calls.flat().join(''))).toEqual({
      schemaVersion: '1.0',
      status: 'error',
      reason: 'invalid_input',
      message:
        'The tool or group is unavailable. Run genie-react tools to inspect available groups.',
      userActionRequired: true,
      next: {
        command: 'genie-react tools',
        argv: ['genie-react', 'tools'],
      },
    })
    expect(stdout.mock.calls.flat().join('')).not.toContain('secret')
  })

  it.each([
    undefined,
    true,
  ])('keeps projection input and app keys out of trusted recovery with json=%s', async (json) => {
    const { url } = await fixture()
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const secret = 'secret-selection-$(steal-secret)'
    const cases = [
      {
        run: () => runCall('query_rows', '{}', { url, json, fields: [secret] }),
        tool: 'query_rows',
      },
      {
        run: () => runCall('query_rows', '{"secretKeys":true}', { url, json, fields: ['missing'] }),
        tool: 'query_rows',
      },
      {
        run: () =>
          runCall('query_rows', '{"secretKeys":true}', { url, json, select: `/${secret}` }),
        tool: 'query_rows',
      },
      { run: () => runStatus({ url, json, fields: [secret] }), tool: 'devtools_status' },
      { run: () => runStatus({ url, json, select: `/${secret}` }), tool: 'devtools_status' },
      {
        run: () => runTools('query_rows', { url, json, select: `/${secret}` }),
        tool: 'query_rows',
      },
    ]
    for (const { run, tool } of cases) {
      expect(await run()).toBe(1)
      const output = stdout.mock.calls.flat().join('')
      expect(output).not.toContain('secret')
      expect(JSON.parse(output)).toMatchObject({
        schemaVersion: '1.0',
        status: 'error',
        reason: 'invalid_input',
        userActionRequired: true,
        next: { command: `genie-react tools ${tool}`, argv: ['genie-react', 'tools', tool] },
      })
      expect(stderr.mock.calls.flat().join('')).toBe('')
      stdout.mockClear()
    }
  })

  it.each([
    undefined,
    true,
  ])('rejects unknown batch keys without echoing them with json=%s', async (json) => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    expect(
      await runBatch('[{"tool":"query_rows","secret-key-$(steal-secret)":true}]', { json }),
    ).toBe(1)
    const output = stdout.mock.calls.flat().join('')
    expect(output).not.toContain('secret')
    expect(JSON.parse(output)).toMatchObject({
      schemaVersion: '1.0',
      status: 'error',
      reason: 'invalid_input',
      userActionRequired: true,
      next: { command: 'genie-react batch --help', argv: ['genie-react', 'batch', '--help'] },
    })
    expect(stderr.mock.calls.flat().join('')).toBe('')
  })

  it.each([
    undefined,
    true,
  ])('keeps batch selection errors safe and actionable with json=%s', async (json) => {
    const { url } = await fixture()
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    expect(
      await runBatch('[{"tool":"query_rows","args":{"secretKeys":true}}]', {
        url,
        json,
        select: '/secret-selection-$(steal-secret)',
      }),
    ).toBe(1)
    const output = stdout.mock.calls.flat().join('')
    expect(output).not.toContain('secret')
    const parsed = JSON.parse(output)
    expect(json ? parsed[0] : parsed).toMatchObject({
      schemaVersion: '1.0',
      tool: 'query_rows',
      ok: false,
      status: 'error',
      reason: 'invalid_input',
      userActionRequired: true,
      next: {
        command: 'genie-react tools query_rows',
        argv: ['genie-react', 'tools', 'query_rows'],
      },
    })
    expect(stderr.mock.calls.flat().join('')).toBe('')
  })

  it('applies nested projection to tool discovery and every successful batch item', async () => {
    const bridge = createStandaloneBridge()
    cleanups.push(() => bridge.close())
    const { url } = await bridge.listen()
    const app = new WebSocket(`${url}?role=app`)
    cleanups.push(() => app.close())
    await new Promise<void>((resolve, reject) => {
      app.once('open', () => resolve())
      app.once('error', reject)
    })
    app.on('message', (data) => {
      const message = decodeFrame(data.toString()) as {
        kind?: string
        id?: string
        tool?: string
      }
      if (message.kind !== 'bridge/request' || message.tool !== 'query_nested') return
      app.send(
        encodeMessage({
          kind: 'app/response',
          id: message.id,
          ok: true,
          result: { nested: { value: 42 }, discarded: { large: 'x'.repeat(1_000) } },
        }),
      )
    })
    app.send(
      encodeMessage({
        kind: 'app/hello',
        protocol: 1,
        sessionId: 'projection-session',
        app: { name: 'projection demo' },
        capabilities: ['query'],
        tools: [
          {
            name: 'query_nested',
            title: 'Nested query result',
            description: 'Returns nested output.',
            group: 'query',
          },
        ],
      }),
    )
    app.send(encodeMessage({ kind: 'app/ready', sessionId: 'projection-session' }))
    await waitUntil(() => bridge.bridge.getStatus().ready)

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    expect(
      await runTools('query', {
        url,
        select: '[*].name',
        waitMs: 1_000,
      }),
    ).toBe(0)
    const toolProjection = JSON.parse(stdout.mock.calls.flat().join(''))
    expect(toolProjection).toMatchObject({
      status: 'ok',
      selection: { matchedPathCount: 1 },
      result: 'query_nested',
    })

    stdout.mockClear()
    expect(
      await runBatch('[{"tool":"query_nested","args":{}}]', {
        url,
        json: true,
        select: '/nested/value',
        maxBytes: 2_000,
        waitMs: 1_000,
      }),
    ).toBe(0)
    const batch = JSON.parse(stdout.mock.calls.flat().join(''))
    expect(batch[0]).toMatchObject({
      tool: 'query_nested',
      ok: true,
      result: {
        status: 'ok',
        selection: { matchedPathCount: 1, omittedPathCount: 1 },
        result: 42,
      },
    })

    stdout.mockClear()
    expect(
      await runBatch('[{"tool":"query_nested"},{"tool":"query_nested"},{"tool":"query_nested"}]', {
        url,
        ndjson: true,
        maxBytes: 512,
        waitMs: 1_000,
      }),
    ).toBe(0)
    const boundedBatch = stdout.mock.calls.flat().join('')
    expect(Buffer.byteLength(boundedBatch, 'utf8')).toBeLessThanOrEqual(512)
    expect(JSON.parse(boundedBatch)).toMatchObject({
      status: 'truncated',
      reason: 'max-bytes',
      maxBytes: 512,
    })
    expect(stderr.mock.calls.flat().join('')).toBe('')
  })

  it('can make an unmet wait result fail the process contract', async () => {
    const bridge = createStandaloneBridge()
    cleanups.push(() => bridge.close())
    const { url } = await bridge.listen()
    const app = new WebSocket(`${url}?role=app`)
    cleanups.push(() => app.close())
    await new Promise<void>((resolve, reject) => {
      app.once('open', () => resolve())
      app.once('error', reject)
    })
    app.on('message', (data) => {
      const message = decodeFrame(data.toString()) as {
        kind?: string
        id?: string
        tool?: string
      }
      if (message.kind !== 'bridge/request' || message.tool !== 'react_find_components') return
      app.send(
        encodeMessage({
          kind: 'app/response',
          id: message.id,
          ok: true,
          result: { matches: [] },
        }),
      )
    })
    app.send(
      encodeMessage({
        kind: 'app/hello',
        protocol: 1,
        sessionId: 'wait-session',
        app: { name: 'wait demo' },
        capabilities: ['react'],
        tools: [
          {
            name: 'react_find_components',
            title: 'Find components',
            description: 'Find components.',
            group: 'react.tree',
          },
        ],
      }),
    )
    app.send(encodeMessage({ kind: 'app/ready', sessionId: 'wait-session' }))
    await waitUntil(() => bridge.bridge.getStatus().ready)
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    const exitCode = await runCall(
      'devtools_wait',
      JSON.stringify({ condition: 'component', name: 'Missing', timeoutMs: 100 }),
      { url, json: true, failOnResultError: true },
    )

    expect(exitCode).toBe(1)
    expect(JSON.parse(stdout.mock.calls.flat().join(''))).toMatchObject({
      ok: false,
      condition: 'component',
      reason: 'timeout',
      validConditions: expect.arrayContaining(['react-quiet', 'settled']),
      lastObserved: { matches: 0 },
    })
  })
})
