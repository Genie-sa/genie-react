import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { describeQuery, observeRequests, type RequestRecord } from './requests'

let server: Server
let base = ''
const sockets = new Set<import('node:net').Socket>()

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://fixture')
    const delay = Number(url.searchParams.get('ms') ?? 0)
    if (url.pathname === '/headers-then-stall') {
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.write('partial')
      return
    }
    setTimeout(() => {
      response.writeHead(url.pathname === '/missing' ? 404 : 200, {
        'content-type': 'application/json',
      })
      response.end(JSON.stringify({ range: url.searchParams.get('range') }))
    }, delay)
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

function observe(): { records: RequestRecord[]; stop: () => void } {
  const records: RequestRecord[] = []
  return { records, stop: observeRequests((record) => records.push(record)) }
}

describe('observeRequests with a real fetch', () => {
  it('records method, status and when the app finished reading the body', async () => {
    const { records, stop } = observe()
    try {
      const response = await fetch(`${base}/api/report?range=7d`, { method: 'delete' })
      expect(records[0]).toMatchObject({ method: 'DELETE', outcome: 'response', bodyReadAt: null })
      expect(await response.json()).toEqual({ range: '7d' })
      expect(records[0]).toMatchObject({ status: 200, href: `${base}/api/report?range=7d` })
      expect(records[0]?.bodyReadAt).toBeGreaterThanOrEqual(records[0]?.headersAt ?? Infinity)
    } finally {
      stop()
    }
  })

  it('tells an abort after the response headers from one before any response', async () => {
    const { records, stop } = observe()
    try {
      const early = new AbortController()
      const beforeHeaders = fetch(`${base}/api/slow?ms=500`, { signal: early.signal })
      early.abort()
      await expect(beforeHeaders).rejects.toThrow()

      const late = new AbortController()
      const response = await fetch(`${base}/headers-then-stall`, { signal: late.signal })
      const body = response.text()
      late.abort()
      await expect(body).rejects.toThrow()

      expect(records.map((record) => record.outcome)).toEqual(['aborted', 'aborted-after-response'])
      expect(records[1]?.status).toBe(200)
    } finally {
      stop()
    }
  })

  it('leaves a request that has not answered in flight', async () => {
    const { records, stop } = observe()
    const pending = fetch(`${base}/api/slow?ms=300`)
    try {
      expect(records[0]).toMatchObject({ outcome: 'in-flight', endedAt: null, headersAt: null })
    } finally {
      stop()
      await (await pending).text()
    }
  })

  it('stops observing and hands fetch back once stopped', async () => {
    const original = globalThis.fetch
    const { records, stop } = observe()
    expect(globalThis.fetch).not.toBe(original)
    stop()
    expect(globalThis.fetch).toBe(original)
    await (await fetch(`${base}/api/report`)).text()
    expect(records).toEqual([])
  })

  it('passes through when another script wrapped fetch over it before it stopped', async () => {
    const { records, stop } = observe()
    const genieFetch = globalThis.fetch
    const outer = (...args: Parameters<typeof fetch>) => genieFetch(...args)
    globalThis.fetch = outer
    stop()
    try {
      expect(globalThis.fetch).toBe(outer)
      await (await fetch(`${base}/api/report`)).text()
      expect(records).toEqual([])
    } finally {
      globalThis.fetch = genieFetch
    }
  })
})

describe('describeQuery', () => {
  it('tells ?q= from ?q=webhook and 7d from 90d without showing the values', () => {
    const empty = describeQuery('https://app.test/search?q=', 'hashed', 512)
    const webhook = describeQuery('https://app.test/search?q=webhook', 'hashed', 512)
    const week = describeQuery('https://app.test/report?range=7d', 'hashed', 512)
    const quarter = describeQuery('https://app.test/report?range=90d', 'hashed', 512)

    expect(empty).toBe('?q=')
    expect(webhook).toMatch(/^\?q=~[0-9a-f]{10}$/)
    expect(week).toMatch(/^\?range=~[0-9a-f]{10}$/)
    expect(quarter).toMatch(/^\?range=~[0-9a-f]{10}$/)
    expect(week).not.toBe(quarter)
    expect(describeQuery('https://app.test/report?range=7d', 'hashed', 512)).toBe(week)
  })

  it('shows plain values on request but keeps credential-named parameters hashed', () => {
    const query = describeQuery(
      'https://app.test/api?q=webhook+retry&access_token=abc123&X-Amz-Signature=f00d&flag',
      'plain',
      512,
    )
    expect(query).toMatch(
      /^\?q=webhook retry&access_token=~[0-9a-f]{10}&X-Amz-Signature=~[0-9a-f]{10}&flag$/,
    )
    expect(query).not.toMatch(/abc123|f00d/)
  })

  it('reports no query as null and drops the fragment', () => {
    expect(describeQuery('https://app.test/orders', 'hashed', 512)).toBeNull()
    expect(describeQuery('https://app.test/orders?status=open#row-4', 'plain', 512)).toBe(
      '?status=open',
    )
  })
})
