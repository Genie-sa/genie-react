import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectorContext, GenieCollector } from '../../client'
import { type TimelineReadReport, type TimelineReport, timelineCollector } from './index'

const context: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}
const clients: QueryClient[] = []
const cleanups: Array<() => void> = []
let time = 100

function call<T>(collector: GenieCollector, name: string, input: unknown): T {
  const tool = collector.tools?.find((candidate) => candidate.contract.name === name)
  if (!tool) throw new Error(`Missing tool ${name}`)
  return tool.handler(input as never, context) as T
}
function create(options: Parameters<typeof timelineCollector>[0] = {}) {
  const collector = timelineCollector(options)
  const cleanup = collector.start?.(context)
  if (cleanup) cleanups.push(cleanup)
  return collector
}
function client() {
  const value = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  clients.push(value)
  return value
}
function start(collector: GenieCollector, options = {}): TimelineReport {
  return call(collector, 'timeline_start', { name: 'checkout', ...options })
}
function read(collector: GenieCollector, id: string, options = {}): TimelineReadReport {
  return call(collector, 'timeline_read', { id, ...options })
}
function stop(collector: GenieCollector, id: string): TimelineReport {
  return call(collector, 'timeline_stop', { id })
}

class ResourceObserver {
  static supportedEntryTypes = ['resource']
  static instances: ResourceObserver[] = []
  connected = false
  queued: PerformanceEntry[] = []
  constructor(private callback: PerformanceObserverCallback) {
    ResourceObserver.instances.push(this)
  }
  observe() {
    this.connected = true
  }
  disconnect() {
    this.connected = false
  }
  takeRecords() {
    return this.queued.splice(0)
  }
  deliver(entries: PerformanceEntry[]) {
    this.callback({ getEntries: () => entries } as PerformanceObserverEntryList, this as never)
  }
}
function observerInstance(): ResourceObserver {
  const observer = ResourceObserver.instances[0]
  if (!observer) throw new Error('Expected ResourceObserver')
  return observer
}
function resource(overrides: Partial<PerformanceResourceTiming> = {}): PerformanceEntry {
  return {
    entryType: 'resource',
    initiatorType: 'fetch',
    name: 'https://user:password@example.test/orders?token=secret#fragment',
    startTime: 110,
    duration: 10,
    requestStart: 0,
    responseStart: 0,
    responseStatus: 0,
    ...overrides,
  } as PerformanceResourceTiming
}

beforeEach(() => {
  time = 100
  vi.useFakeTimers()
  vi.stubGlobal('performance', { now: () => time })
  vi.stubGlobal('PerformanceObserver', undefined)
  ResourceObserver.instances = []
})
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  for (const value of clients.splice(0)) value.clear()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('timeline recording lifecycle and bounds', () => {
  it('stays passive until explicit start and freezes real Query lifecycle metadata at stop', async () => {
    const queryClient = client()
    const collector = create({ queryClient })
    expect(queryClient.getQueryCache().hasListeners()).toBe(false)
    queryClient.setQueryData(['before'], 'excluded')
    const recording = start(collector)
    expect(queryClient.getQueryCache().hasListeners()).toBe(true)
    time = 105
    await queryClient.fetchQuery({ queryKey: ['order', 7], queryFn: () => 'private payload' })
    time = 110
    queryClient.removeQueries({ queryKey: ['order', 7] })
    const result = read(collector, recording.id)
    expect(result.events.map((event) => [event.type, event.details.action])).toEqual([
      ['added', null],
      ['updated', 'fetch'],
      ['updated', 'success'],
      ['removed', null],
    ])
    expect(result.events.map((event) => event.atMs)).toEqual([5, 5, 5, 10])
    expect(result.events.map((event) => event.sequence)).toEqual([1, 2, 3, 4])
    expect(result.events[2]?.details).toMatchObject({ status: 'success', fetchStatus: 'idle' })
    expect(JSON.stringify(result)).not.toContain('private payload')
    expect(JSON.stringify(result.events)).not.toContain('before')
    const stopped = stop(collector, recording.id)
    expect(queryClient.getQueryCache().hasListeners()).toBe(false)
    queryClient.setQueryData(['after'], 'excluded')
    time = 200
    expect(stop(collector, recording.id)).toEqual(stopped)
    const firstEvent = result.events[0]
    if (!firstEvent) throw new Error('Expected recorded Query event')
    firstEvent.details.queryHash = 'corrupted by consumer'
    expect(read(collector, recording.id).events[0]?.details.queryHash).toBe('["order",7]')
    expect(read(collector, recording.id).eventCount).toBe(4)
  })

  it('records real Query failures without retaining error payloads or changing rejection behavior', async () => {
    const queryClient = client()
    const collector = create({ queryClient })
    const recording = start(collector)
    const failure = new Error('private failure text')
    await expect(
      queryClient.fetchQuery({
        queryKey: ['failed'],
        queryFn: () => Promise.reject(failure),
      }),
    ).rejects.toBe(failure)
    const result = read(collector, recording.id)
    expect(result.events.at(-1)?.details).toMatchObject({
      action: 'error',
      status: 'error',
      fetchStatus: 'idle',
    })
    expect(JSON.stringify(result)).not.toContain('private failure text')
  })

  it.each([
    4, 25,
  ])('counts %i ms of subscription setup against the recording deadline', (setupMs) => {
    const queryClient = client()
    const cache = queryClient.getQueryCache()
    const subscribe = cache.subscribe.bind(cache)
    vi.spyOn(cache, 'subscribe').mockImplementation((listener) => {
      time += setupMs
      return subscribe(listener)
    })
    const collector = create({ queryClient })
    const recording = start(collector, { maxDurationMs: 10 })
    if (setupMs >= 10) {
      expect(recording.state).toBe('stopped')
      expect(recording.stopReason).toBe('max-duration')
    } else {
      expect(recording.state).toBe('recording')
      time = 110
      vi.advanceTimersByTime(10 - setupMs)
    }
    expect(cache.hasListeners()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects concurrent recordings and stale IDs without losing the active recording', () => {
    const collector = create()
    const first = start(collector)
    expect(() => start(collector)).toThrow('already active')
    expect(() => stop(collector, 'missing')).toThrow('Unknown or expired')
    expect(read(collector, first.id).state).toBe('recording')
    stop(collector, first.id)
    const second = start(collector)
    expect(second.id).not.toBe(first.id)
    expect(() => read(collector, first.id)).toThrow('Unknown or expired')
  })

  it('stops exactly at the event cap and detaches the cache before later changes', () => {
    const queryClient = client()
    const collector = create({ queryClient })
    const recording = start(collector, { maxEvents: 1 })
    queryClient.setQueryData(['first'], 'value')
    queryClient.setQueryData(['second'], 'value')
    const result = read(collector, recording.id)
    expect(result).toMatchObject({
      state: 'stopped',
      stopReason: 'max-events',
      eventCount: 1,
      truncated: true,
    })
    expect(result.events[0]?.details.queryHash).toBe('["first"]')
    expect(queryClient.getQueryCache().hasListeners()).toBe(false)
  })

  it('expires on deadline and excludes updates even when its timer has not run', () => {
    const queryClient = client()
    const collector = create({ queryClient })
    const recording = start(collector, { maxDurationMs: 10 })
    time = 109
    queryClient.setQueryData(['included'], true)
    time = 110
    queryClient.setQueryData(['excluded'], true)
    expect(read(collector, recording.id)).toMatchObject({
      state: 'stopped',
      stopReason: 'max-duration',
      durationMs: 10,
      eventCount: 2,
    })
    expect(queryClient.getQueryCache().hasListeners()).toBe(false)
  })

  it('auto-stops idle recordings and collector cleanup detaches an active recording', () => {
    const queryClient = client()
    const collector = create({ queryClient })
    const first = start(collector, { maxDurationMs: 10 })
    time = 110
    vi.advanceTimersByTime(10)
    expect(read(collector, first.id).stopReason).toBe('max-duration')
    expect(queryClient.getQueryCache().hasListeners()).toBe(false)
    const second = start(collector)
    cleanups[0]?.()
    expect(read(collector, second.id).stopReason).toBe('collector-cleanup')
    expect(queryClient.getQueryCache().hasListeners()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    { maxEvents: 0 },
    { maxEvents: 10001 },
    { maxEvents: 1.5 },
    { maxDurationMs: 0 },
    { maxDurationMs: 120001 },
    { name: ' ' },
    { name: 'x'.repeat(121) },
  ])('rejects unsafe recording input before subscribing: %j', (input) => {
    const queryClient = client()
    const collector = create({ queryClient })
    expect(() => start(collector, input)).toThrow()
    expect(queryClient.getQueryCache().hasListeners()).toBe(false)
  })

  it('captures late-supplied clients only on the next recording and bounds retained query identity', () => {
    const options: Parameters<typeof timelineCollector>[0] = {}
    const collector = create(options)
    const first = start(collector)
    const queryClient = client()
    options.queryClient = queryClient
    expect(read(collector, first.id).coverage.query.status).toBe('unavailable')
    expect(queryClient.getQueryCache().hasListeners()).toBe(false)
    stop(collector, first.id)
    const second = start(collector, { maxEvents: 10000, maxDurationMs: 120000 })
    queryClient.setQueryData(['x'.repeat(10000)], true)
    expect(read(collector, second.id).events[0]?.details.queryHash).toHaveLength(512)
  })
})

describe('resource timing correlation', () => {
  function browser() {
    vi.stubGlobal('window', {})
    vi.stubGlobal('PerformanceObserver', ResourceObserver)
  }

  it('flushes queued completion timings, excludes old/unrelated entries and ignores late delivery', () => {
    browser()
    const collector = create()
    expect(ResourceObserver.instances).toHaveLength(0)
    const recording = start(collector)
    const observer = observerInstance()
    observer.queued.push(
      resource({ startTime: 90, duration: 5 }),
      resource({ initiatorType: 'img' }),
      resource({ startTime: 95, duration: 15 }),
      resource(),
      resource({ startTime: 120, duration: 20 }),
    )
    time = 130
    stop(collector, recording.id)
    const result = read(collector, recording.id)
    expect(result.events).toHaveLength(2)
    expect(result.events.map((event) => event.atMs)).toEqual([30, 30])
    expect(result.events[0]?.details).toMatchObject({
      startMs: -5,
      endMs: 10,
      startedBeforeRecording: true,
    })
    expect(result.events[1]?.details).toEqual({
      url: 'https://example.test/orders',
      initiatorType: 'fetch',
      startMs: 10,
      endMs: 20,
      durationMs: 10,
      startedBeforeRecording: false,
      detailedTimingAvailable: false,
      responseStatus: null,
    })
    expect(observer.connected).toBe(false)
    observer.deliver([resource()])
    expect(read(collector, recording.id)).toEqual(result)
  })

  it('keeps pagination append-only when resource completion is delivered after later Query updates', () => {
    browser()
    const queryClient = client()
    const collector = create({ queryClient })
    const recording = start(collector)
    time = 125
    queryClient.setQueryData(['order'], true)
    const first = read(collector, recording.id, { limit: 1 })
    time = 130
    observerInstance().deliver([resource()])
    const second = read(collector, recording.id, { offset: first.nextOffset, limit: 2 })
    expect(first.events[0]?.sequence).toBe(1)
    expect(second.events.map((event) => event.sequence)).toEqual([2, 3])
    expect(second.events[1]?.details.endMs).toBe(20)
    expect(second.events[1]?.atMs).toBe(30)
    const filtered = read(collector, recording.id, { domains: ['request'], limit: 1 })
    expect(filtered.matchedEventCount).toBe(1)
    expect(filtered.events[0]?.domain).toBe('request')
    expect(read(collector, recording.id, { offset: 99 }).events).toEqual([])
    expect(() => read(collector, recording.id, { limit: 1001 })).toThrow()
    expect(() => read(collector, recording.id, { offset: -1 })).toThrow()
  })

  it('rolls back observer and Query listeners after Router setup fails and allows retry', () => {
    browser()
    const queryClient = client()
    const options: Parameters<typeof timelineCollector>[0] = { queryClient }
    const collector = create(options)
    const first = start(collector)
    stop(collector, first.id)
    options.router = {
      subscribe: () => {
        throw new Error('provider setup failed')
      },
    }
    expect(() => start(collector)).toThrow('provider setup failed')
    expect(ResourceObserver.instances.every((observer) => !observer.connected)).toBe(true)
    expect(queryClient.getQueryCache().hasListeners()).toBe(false)
    expect(read(collector, first.id).state).toBe('stopped')
    options.router = undefined
    const second = start(collector)
    queryClient.setQueryData(['retry'], true)
    expect(read(collector, second.id).eventCount).toBe(2)
  })

  it('releases resources after a QueryClient getter throws during recording setup', () => {
    browser()
    const collector = create({
      queryClient: {
        getQueryCache: () => {
          throw new Error('cache unavailable')
        },
      },
    })
    expect(() => start(collector)).toThrow('cache unavailable')
    expect(observerInstance().connected).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('releases already-acquired Router listeners when a later subscription fails', () => {
    browser()
    const queryClient = client()
    const liveSubscriptions = new Set<string>()
    const collector = create({
      queryClient,
      router: {
        subscribe: (eventType) => {
          if (eventType === 'onLoad') throw new Error('late subscribe failure')
          liveSubscriptions.add(eventType)
          return () => {
            liveSubscriptions.delete(eventType)
          }
        },
      },
    })
    expect(() => start(collector)).toThrow('late subscribe failure')
    expect(liveSubscriptions.size).toBe(0)
    expect(queryClient.getQueryCache().hasListeners()).toBe(false)
    expect(observerInstance().connected).toBe(false)
  })

  it('bounds queued resources at stop and excludes completion after the deadline', () => {
    browser()
    const collector = create()
    const recording = start(collector, { maxDurationMs: 25, maxEvents: 2 })
    const observer = observerInstance()
    observer.queued.push(resource(), resource({ duration: 15 }), resource({ duration: 16 }))
    time = 200
    const report = read(collector, recording.id)
    expect(report).toMatchObject({
      state: 'stopped',
      stopReason: 'max-duration',
      eventCount: 2,
      durationMs: 25,
    })
    expect(report.events.map((event) => event.details.endMs)).toEqual([20, 25])
    expect(report.events.map((event) => event.atMs)).toEqual([25, 25])
  })

  it('finishes cleanup despite a failed resource flush and makes the coverage gap visible', () => {
    browser()
    const queryClient = client()
    const collector = create({ queryClient })
    const recording = start(collector)
    observerInstance().takeRecords = () => {
      throw new Error('observer disposed')
    }
    const report = stop(collector, recording.id)
    expect(report.state).toBe('stopped')
    expect(report.coverage.request.detail).toContain('flush failed')
    expect(queryClient.getQueryCache().hasListeners()).toBe(false)
    expect(observerInstance().connected).toBe(false)
  })

  it('reports truncation when a manual-stop flush reaches capacity', () => {
    browser()
    const collector = create()
    const recording = start(collector, { maxEvents: 2 })
    observerInstance().queued.push(resource(), resource(), resource())
    time = 130
    expect(stop(collector, recording.id)).toMatchObject({
      eventCount: 2,
      truncated: true,
      stopReason: 'manual',
    })
    expect(read(collector, recording.id).events).toHaveLength(2)
  })

  it('retains an overdue delivered batch completed inside the window when the timer was starved', () => {
    browser()
    const collector = create()
    const recording = start(collector, { maxDurationMs: 25 })
    time = 200
    observerInstance().deliver([resource(), resource({ duration: 20 })])
    const result = read(collector, recording.id)
    expect(result).toMatchObject({
      state: 'stopped',
      stopReason: 'max-duration',
      eventCount: 1,
      durationMs: 25,
    })
    expect(result.events[0]).toMatchObject({ atMs: 25, details: { endMs: 20 } })
    expect(observerInstance().connected).toBe(false)
  })

  it('reports native requests unavailable even when resource observation is advertised', () => {
    browser()
    vi.stubGlobal('navigator', { product: 'ReactNative' })
    const recording = start(create())
    expect(recording.coverage.request.status).toBe('unavailable')
    expect(recording.coverage.request.detail).toContain('native')
    expect(ResourceObserver.instances).toHaveLength(0)
  })

  it('reports unavailable native/browser capabilities instead of implying an empty complete trace', () => {
    const collector = create()
    const recording = start(collector)
    expect(recording.correlation).toBe('temporal-only')
    expect(
      Object.values(recording.coverage).every((coverage) => coverage.status === 'unavailable'),
    ).toBe(true)
    expect(recording.coverage.request.detail).toContain('native')
    expect(recording.coverage.navigation.detail).toContain('native')
  })
})
