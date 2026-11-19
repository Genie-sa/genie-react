import { createServer, type Server } from 'node:http'
import type { AddressInfo, Socket } from 'node:net'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { CollectorContext, GenieCollector } from '../client'
import type { RequestWatchReport } from '../protocol'
import { genieFetch } from './genie-fetch'
import { requestWatchCollector } from './request-watch'

let server: Server
let base = ''
const sockets = new Set<Socket>()

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://fixture')
    if (url.pathname === '/headers-then-stall') {
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.write('partial')
      return
    }
    setTimeout(
      () => {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ range: url.searchParams.get('range') }))
      },
      Number(url.searchParams.get('ms') ?? 0),
    )
  })
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  for (const socket of sockets) socket.destroy()
  await new Promise((resolve) => server.close(resolve))
})

const context: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}

let collector: GenieCollector
let stopCollector: (() => void) | undefined

function started(): GenieCollector {
  collector = requestWatchCollector()
  const cleanup = collector.start?.(context)
  stopCollector = typeof cleanup === 'function' ? cleanup : undefined
  return collector
}

async function call(tool: string, args: unknown = {}): Promise<RequestWatchReport> {
  const found = collector.tools?.find((candidate) => candidate.contract.name === tool)
  if (!found) throw new Error(`${tool} is not registered`)
  return (await found.handler(args as never, context)) as RequestWatchReport
}

afterEach(() => {
  stopCollector?.()
  stopCollector = undefined
  vi.useRealTimers()
})

describe('request watch', () => {
  it('counts only requests started after it opened, until the app has read each body', async () => {
    started()
    const before = fetch(`${base}/api/before?ms=200`)
    const { watchId } = await call('request_watch_start')
    const pending = fetch(`${base}/api/reports/throughput?range=90d&ms=200`)

    const inFlight = await call('request_watch_read', { watchId })
    expect(inFlight).toMatchObject({ state: 'watching', started: 1, inFlight: 1 })
    expect(inFlight.requests).toEqual([
      expect.objectContaining({
        initiatorType: 'fetch',
        method: 'GET',
        url: `${base}/api/reports/throughput`,
      }),
    ])

    await (await before).json()
    expect(await (await pending).json()).toEqual({ range: '90d' })
    expect(await call('request_watch_read', { watchId })).toMatchObject({
      started: 1,
      inFlight: 0,
      requests: [],
    })
  })

  it('keeps a response in flight while the app is still reading its body', async () => {
    started()
    const { watchId } = await call('request_watch_start')
    const abort = new AbortController()
    const response = await fetch(`${base}/headers-then-stall`, { signal: abort.signal })
    const body = response.text()

    expect(await call('request_watch_read', { watchId })).toMatchObject({ inFlight: 1 })
    abort.abort()
    await expect(body).rejects.toThrow()
    expect(await call('request_watch_read', { watchId })).toMatchObject({ inFlight: 0 })
  })

  it("leaves Genie's own requests out", async () => {
    started()
    const { watchId } = await call('request_watch_start')
    await (await genieFetch(`${base}/source-map?ms=0`)).text()

    expect(await call('request_watch_read', { watchId })).toMatchObject({ started: 0 })
  })

  it('freezes its report at the stop and ignores later requests', async () => {
    started()
    const { watchId } = await call('request_watch_start')
    const pending = fetch(`${base}/api/slow?ms=200`)
    const stopped = await call('request_watch_stop', { watchId })
    await (await fetch(`${base}/api/after?ms=0`)).json()
    await (await pending).json()

    expect(stopped).toMatchObject({ state: 'stopped', stopReason: 'manual', inFlight: 1 })
    expect(await call('request_watch_stop', { watchId })).toMatchObject({
      started: 1,
      inFlight: 1,
    })
  })

  it('stops by itself after its maximum duration', async () => {
    vi.useFakeTimers()
    started()
    const { watchId } = await call('request_watch_start', { maxDurationMs: 1_000 })
    vi.advanceTimersByTime(1_000)

    expect(await call('request_watch_read', { watchId })).toMatchObject({
      state: 'stopped',
      stopReason: 'max-duration',
    })
  })

  it('names an unknown watch instead of reporting nothing in flight', async () => {
    started()

    await expect(
      call('request_watch_read', { watchId: 'requests-00000000-0000-4000-8000-000000000000' }),
    ).rejects.toThrow('Unknown or evicted request watch')
  })
})
