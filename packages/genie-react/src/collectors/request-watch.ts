import { defineCollector, defineCollectorTool, type GenieCollector } from '../client'
import {
  MAX_LISTED_WATCHED_REQUESTS,
  newId,
  type RequestWatchReport,
  requestWatchReadContract,
  requestWatchStartContract,
  requestWatchStopContract,
  roundMilliseconds,
} from '../protocol'
import { requestLocation } from './timeline'
import { observeRequests, type RequestRecord } from './timeline/requests'

/** Open and stopped watches kept for reads; a new watch beyond this evicts the oldest. */
const MAX_WATCHES = 8

interface Watch {
  id: string
  startedAt: number
  endedAt: number | null
  stopReason: RequestWatchReport['stopReason']
  started: number
  open: RequestRecord[]
  timer: ReturnType<typeof setTimeout>
}

function inFlight(record: RequestRecord): boolean {
  if (record.outcome === 'in-flight') return true
  return (
    record.outcome === 'response' && record.bodyReadStartedAt !== null && record.bodyReadAt === null
  )
}

/** On-demand counts of the app's fetch and XMLHttpRequest calls still in flight, which `verify` waits for before it decides. */
export function requestWatchCollector(): GenieCollector {
  const watches = new Map<string, Watch>()
  let unobserve: (() => void) | null = null

  const pruneSettled = (watch: Watch): void => {
    if (watch.endedAt === null) watch.open = watch.open.filter(inFlight)
  }

  const onStart = (record: RequestRecord): void => {
    for (const watch of watches.values()) {
      if (watch.endedAt !== null) continue
      pruneSettled(watch)
      watch.started += 1
      watch.open.push(record)
    }
  }

  const stop = (watch: Watch, reason: NonNullable<RequestWatchReport['stopReason']>): void => {
    if (watch.endedAt !== null) return
    pruneSettled(watch)
    watch.endedAt = performance.now()
    watch.stopReason = reason
    clearTimeout(watch.timer)
    if ([...watches.values()].every((other) => other.endedAt !== null)) {
      unobserve?.()
      unobserve = null
    }
  }

  const report = (watch: Watch): RequestWatchReport => {
    pruneSettled(watch)
    const at = watch.endedAt ?? performance.now()
    return {
      watchId: watch.id,
      state: watch.endedAt === null ? 'watching' : 'stopped',
      stopReason: watch.stopReason,
      durationMs: roundMilliseconds(at - watch.startedAt),
      started: watch.started,
      inFlight: watch.open.length,
      requests: watch.open.slice(0, MAX_LISTED_WATCHED_REQUESTS).map((record) => ({
        requestId: record.id,
        initiatorType: record.initiatorType,
        method: record.method,
        url: requestLocation(record.href),
        ageMs: roundMilliseconds(Math.max(0, at - record.startedAt)),
      })),
    }
  }

  const lookup = (watchId: string): Watch => {
    const watch = watches.get(watchId)
    if (!watch) {
      throw new Error(`Unknown or evicted request watch: ${watchId}. Start a new watch.`)
    }
    return watch
  }

  const start = (maxDurationMs: number): RequestWatchReport => {
    if (typeof performance === 'undefined' || typeof performance.now !== 'function') {
      throw new Error('Watching requests requires a monotonic performance.now clock.')
    }
    for (const [id, oldest] of watches) {
      if (watches.size < MAX_WATCHES) break
      stop(oldest, 'replaced')
      watches.delete(id)
    }
    unobserve ??= observeRequests(onStart)
    const watch: Watch = {
      id: `requests-${newId()}`,
      startedAt: performance.now(),
      endedAt: null,
      stopReason: null,
      started: 0,
      open: [],
      timer: setTimeout(() => stop(watch, 'max-duration'), maxDurationMs),
    }
    watches.set(watch.id, watch)
    return report(watch)
  }

  return defineCollector({
    meta: {
      id: 'request-watch',
      title: 'Request watch',
      description: 'On-demand counts of app fetch and XMLHttpRequest calls still in flight',
    },
    capabilities: ['network'],
    start: () => () => {
      for (const watch of watches.values()) stop(watch, 'collector-cleanup')
    },
    tools: [
      defineCollectorTool({
        contract: requestWatchStartContract,
        handler: (args) => start(requestWatchStartContract.input.parse(args).maxDurationMs),
      }),
      defineCollectorTool({
        contract: requestWatchReadContract,
        handler: (args) => report(lookup(requestWatchReadContract.input.parse(args).watchId)),
      }),
      defineCollectorTool({
        contract: requestWatchStopContract,
        handler: (args) => {
          const watch = lookup(requestWatchStopContract.input.parse(args).watchId)
          stop(watch, 'manual')
          return report(watch)
        },
      }),
    ],
  })
}
