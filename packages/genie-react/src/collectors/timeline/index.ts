import type { QueryClient } from '@tanstack/react-query'
import type { AnyRouter } from '@tanstack/react-router'
import { getRDTHook, instrument } from 'bippy'
import { z } from 'zod'
import { defineCollector, defineCollectorTool, type GenieCollector } from '../../client'
import { defineAgentToolContract, newId, roundMilliseconds } from '../../protocol'
import { getDocumentCommitId } from '../react/observation'
import { isSafeRenderer, safeCommitHandler } from '../react/safe-instrumentation'

export interface TimelineCollectorOptions {
  queryClient?: Pick<QueryClient, 'getQueryCache'>
  router?: Pick<AnyRouter, 'subscribe'>
}

const domainSchema = z.enum(['request', 'query', 'react', 'navigation'])
const COVERAGE_DETAILS = {
  'resource-timing':
    'Completed fetch/XHR Resource Timing only; observation time includes delivery delay. Requests started before recording may appear. Failed, unfinished, worker and non-fetch/XHR requests may be absent. Cross-origin detailed timing requires Timing-Allow-Origin. URLs omit credentials, queries and fragments; paths remain.',
  'resource-timing-flush-failed':
    'Completed fetch/XHR Resource Timing, but the final resource queue flush failed; entries may be missing.',
  'no-resource-timing':
    'Browser Resource Timing unavailable; native network requests are not observed.',
  'query-cache':
    'Supplied QueryCache add/remove/update notifications; no pre-existing snapshot, mutation cache, payloads or inferred request links. Query hashes are bounded but may contain key values.',
  'no-query-client': 'No QueryClient supplied. Only the supplied QueryCache is observed.',
  'react-root-commits':
    'Supported development React root commits; hook must precede React. renderDurationMs is root actualDuration when positive, otherwise unknown; not commit wall time, native UI timing, effects or component attribution. No Fiber tree traversal.',
  'no-react-renderer': 'No supported development React renderer/hook; load Genie before React.',
  'tanstack-router':
    'Supplied TanStack Router lifecycle notifications only; no transition duration or causal navigation IDs inferred. Locations include pathname only.',
  'no-tanstack-router':
    'No TanStack Router supplied; other routers and native navigation are not observed.',
} as const
type CoverageCode = keyof typeof COVERAGE_DETAILS
const COVERAGE_DOCS = 'https://genie-react.com/docs/tools/timeline#coverage-codes'

const coverageSchema = z.object({
  status: z.enum(['available', 'unavailable']),
  code: z.enum(Object.keys(COVERAGE_DETAILS) as [CoverageCode, ...CoverageCode[]]),
  detail: z
    .string()
    .optional()
    .describe(
      `Returned by timeline_start. The text is fixed per code, so later reports keep only the code (${COVERAGE_DOCS}).`,
    ),
})
const eventSchema = z.object({
  sequence: z.number().int().positive(),
  domain: domainSchema,
  type: z.string(),
  atMs: z.number().nonnegative(),
  details: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .describe(
      'Times are milliseconds rounded to 0.01. Request: URL without query/fragment/credentials, startMs/endMs relative to recording start, durationMs, detailedTimingAvailable and nullable responseStatus. React: rendererId, nullable renderDurationMs (root actualDuration, not commit wall time) and documentCommitId, which joins react_render_causes events of the same commit (null when render tracking is not installed). Query: bounded queryHash, action, status and fetchStatus. Navigation: from/to pathname, pathChanged and hrefChanged. atMs is observation time; resource completion can be delivered later.',
    ),
})
const reportSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.enum(['recording', 'stopped']),
  stopReason: z.enum(['manual', 'max-events', 'max-duration', 'collector-cleanup']).nullable(),
  durationMs: z.number().nonnegative(),
  maxEvents: z.number().int(),
  maxDurationMs: z.number().int(),
  eventCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
  correlation: z.literal('temporal-only'),
  clock: z.literal('performance.now'),
  ordering: z.literal('observation-time-then-sequence'),
  coverage: z.object({
    request: coverageSchema,
    query: coverageSchema,
    react: coverageSchema,
    navigation: coverageSchema,
  }),
})
const startInput = z.object({
  name: z.string().trim().min(1).max(120),
  maxEvents: z.number().int().min(1).max(10000).default(1000),
  maxDurationMs: z.number().int().min(1).max(120000).default(30000),
})
const readInput = z.object({
  id: z.string().min(1),
  domains: z.array(domainSchema).min(1).max(4).optional(),
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(1000).default(200),
})
const readOutput = reportSchema.extend({
  events: z.array(eventSchema),
  matchedEventCount: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative().nullable(),
})
const stopInput = z.object({ id: z.string().min(1) })
export type TimelineEvent = z.infer<typeof eventSchema>
export type TimelineReport = z.infer<typeof reportSchema>
export type TimelineReadReport = z.infer<typeof readOutput>
type Domain = TimelineEvent['domain']
type StopReason = NonNullable<TimelineReport['stopReason']>
interface Recording {
  report: TimelineReport
  events: TimelineEvent[]
  startedAt: number
  lastAtMs: number
  stopping: boolean
  dispose: Array<() => void>
  observer?: PerformanceObserver
  timer?: ReturnType<typeof setTimeout>
}

const MAX_TEXT_LENGTH = 512
function bounded(value: string): string {
  return value.slice(0, MAX_TEXT_LENGTH)
}

/** Keep request identity useful without retaining query strings, fragments, or credentials. */
function requestLocation(value: string): string {
  try {
    const url = new URL(value)
    return bounded(`${url.origin}${url.pathname}`)
  } catch {
    return '[unavailable URL]'
  }
}

const TIME_DETAIL_KEYS = new Set(['startMs', 'endMs', 'durationMs', 'renderDurationMs'])

function roundEventTimes(event: TimelineEvent): TimelineEvent {
  const details = Object.fromEntries(
    Object.entries(event.details).map(([key, value]) => [
      key,
      TIME_DETAIL_KEYS.has(key) && typeof value === 'number' ? roundMilliseconds(value) : value,
    ]),
  )
  return { ...event, atMs: roundMilliseconds(event.atMs), details }
}

/** Passive by default. Each explicit recording owns and releases its subscriptions. */
export function timelineCollector(options: TimelineCollectorOptions = {}): GenieCollector {
  let recording: Recording | undefined

  const now = () => performance.now()
  const describe = (target: Recording, { withCoverageDetail = false } = {}): TimelineReport =>
    reportSchema.parse({
      ...target.report,
      coverage: withCoverageDetail
        ? Object.fromEntries(
            Object.entries(target.report.coverage).map(([domain, coverage]) => [
              domain,
              { ...coverage, detail: COVERAGE_DETAILS[coverage.code] },
            ]),
          )
        : target.report.coverage,
      eventCount: target.events.length,
      durationMs: roundMilliseconds(
        target.report.state === 'recording'
          ? Math.max(0, Math.min(now() - target.startedAt, target.report.maxDurationMs))
          : target.report.durationMs,
      ),
    })

  function release(target: Recording): void {
    clearTimeout(target.timer)
    for (const dispose of target.dispose.splice(0).reverse()) {
      try {
        dispose()
      } catch {
        // Keep releasing other sources after a provider cleanup fails.
      }
    }
    target.observer = undefined
  }

  function stop(
    target: Recording,
    reason: StopReason,
    deliveredEntries: PerformanceEntry[] = [],
  ): void {
    if (target.report.state === 'stopped' || target.stopping) return
    target.stopping = true
    // Freeze the boundary before flushing asynchronously delivered resource completions.
    target.report.durationMs = Math.max(
      0,
      Math.min(now() - target.startedAt, target.report.maxDurationMs),
    )
    try {
      resources(target, deliveredEntries)
      if (target.observer) resources(target, target.observer.takeRecords())
    } catch {
      target.report.coverage.request = { status: 'available', code: 'resource-timing-flush-failed' }
    } finally {
      target.report.state = 'stopped'
      target.report.stopReason = reason
      if (reason === 'max-events') target.report.truncated = true
      release(target)
      target.stopping = false
    }
  }

  function append(
    target: Recording,
    domain: Domain,
    type: string,
    details: TimelineEvent['details'],
  ): void {
    if (target.report.state !== 'recording') return
    const elapsed = now() - target.startedAt
    if (!target.stopping && elapsed >= target.report.maxDurationMs) {
      stop(target, 'max-duration')
      return
    }
    if (target.events.length >= target.report.maxEvents) {
      target.report.truncated = true
      return
    }
    // Observation order stays append-only, including late PerformanceObserver deliveries.
    const atMs = Math.max(target.lastAtMs, 0, target.stopping ? target.report.durationMs : elapsed)
    target.lastAtMs = atMs
    target.events.push({ sequence: target.events.length + 1, domain, type, atMs, details })
    if (target.events.length === target.report.maxEvents) {
      target.report.truncated = true
      if (!target.stopping) stop(target, 'max-events')
    }
  }

  function resources(target: Recording, entries: PerformanceEntry[]): void {
    if (
      target.report.state === 'recording' &&
      !target.stopping &&
      now() - target.startedAt >= target.report.maxDurationMs
    ) {
      stop(target, 'max-duration', entries)
      return
    }
    for (const item of entries) {
      if (target.report.state === 'stopped' || target.events.length >= target.report.maxEvents)
        break
      if (item.entryType !== 'resource') continue
      const entry = item as PerformanceResourceTiming
      if (entry.initiatorType !== 'fetch' && entry.initiatorType !== 'xmlhttprequest') continue
      const startMs = entry.startTime - target.startedAt
      const endMs = startMs + entry.duration
      const cutoff = target.stopping ? target.report.durationMs : target.report.maxDurationMs
      if (
        !Number.isFinite(startMs) ||
        !Number.isFinite(entry.duration) ||
        entry.duration < 0 ||
        endMs < 0 ||
        endMs > cutoff
      ) {
        continue
      }
      append(target, 'request', 'completed', {
        url: requestLocation(entry.name),
        initiatorType: entry.initiatorType,
        startMs,
        endMs,
        durationMs: entry.duration,
        startedBeforeRecording: startMs < 0,
        // Zero restricted fields cannot distinguish TAO restrictions from absent timing.
        detailedTimingAvailable: entry.requestStart > 0 && entry.responseStart > 0,
        responseStatus:
          typeof entry.responseStatus === 'number' &&
          Number.isFinite(entry.responseStatus) &&
          entry.responseStatus > 0
            ? entry.responseStatus
            : null,
      })
    }
  }

  function lookup(id: string): Recording {
    if (!recording || recording.report.id !== id) {
      throw new Error(`Unknown or expired timeline recording: ${id}. Start a new recording.`)
    }
    if (
      recording.report.state === 'recording' &&
      now() - recording.startedAt >= recording.report.maxDurationMs
    ) {
      stop(recording, 'max-duration')
    }
    return recording
  }

  function begin(args: z.infer<typeof startInput>): TimelineReport {
    if (recording?.report.state === 'recording') {
      lookup(recording.report.id)
      if (recording.report.state === 'recording') {
        throw new Error('A timeline recording is already active. Stop it before starting another.')
      }
    }
    if (typeof performance === 'undefined' || typeof performance.now !== 'function') {
      throw new Error('Timeline recording requires a monotonic performance.now clock.')
    }
    const target: Recording = {
      startedAt: now(),
      lastAtMs: 0,
      events: [],
      dispose: [],
      stopping: false,
      report: {
        id: `timeline-${newId()}`,
        name: args.name,
        state: 'recording',
        stopReason: null,
        durationMs: 0,
        maxEvents: args.maxEvents,
        maxDurationMs: args.maxDurationMs,
        eventCount: 0,
        truncated: false,
        correlation: 'temporal-only',
        clock: 'performance.now',
        ordering: 'observation-time-then-sequence',
        coverage: {
          request: { status: 'unavailable', code: 'no-resource-timing' },
          query: { status: 'unavailable', code: 'no-query-client' },
          react: { status: 'unavailable', code: 'no-react-renderer' },
          navigation: { status: 'unavailable', code: 'no-tanstack-router' },
        },
      },
    }
    try {
      if (
        typeof window !== 'undefined' &&
        typeof PerformanceObserver !== 'undefined' &&
        !(typeof navigator !== 'undefined' && navigator.product === 'ReactNative') &&
        PerformanceObserver.supportedEntryTypes?.includes('resource')
      ) {
        const observer = new PerformanceObserver((list) => resources(target, list.getEntries()))
        target.dispose.push(() => observer.disconnect())
        observer.observe({ type: 'resource', buffered: false })
        target.observer = observer
        target.report.coverage.request = { status: 'available', code: 'resource-timing' }
      }
      if (options.queryClient) {
        target.dispose.push(
          options.queryClient.getQueryCache().subscribe((event) => {
            if (event.type !== 'added' && event.type !== 'removed' && event.type !== 'updated')
              return
            append(target, 'query', event.type, {
              queryHash: bounded(event.query.queryHash),
              action: event.type === 'updated' ? event.action.type : null,
              status: event.query.state.status,
              fetchStatus: event.query.state.fetchStatus,
            })
          }),
        )
        target.report.coverage.query = { status: 'available', code: 'query-cache' }
      }
      if (options.router) {
        for (const eventType of [
          'onBeforeNavigate',
          'onBeforeLoad',
          'onLoad',
          'onResolved',
        ] as const) {
          target.dispose.push(
            options.router.subscribe(eventType, (event) => {
              append(target, 'navigation', eventType, {
                from: event.fromLocation ? bounded(event.fromLocation.pathname) : null,
                to: bounded(event.toLocation.pathname),
                pathChanged: event.pathChanged,
                hrefChanged: event.hrefChanged,
              })
            }),
          )
        }
        target.report.coverage.navigation = { status: 'available', code: 'tanstack-router' }
      }
      let safeRendererPresent = false
      try {
        safeRendererPresent = [...getRDTHook().renderers.keys()].some(isSafeRenderer)
      } catch {
        // Missing hook is a capability gap, not a reason to lose Query or network evidence.
      }
      if (safeRendererPresent) {
        target.dispose.push(
          instrument({
            name: 'genie-timeline',
            onCommitFiberRoot: safeCommitHandler((rendererId, root) => {
              const duration = root.current.actualDuration
              const documentCommitId = getDocumentCommitId()
              append(target, 'react', 'commit', {
                rendererId,
                renderDurationMs:
                  typeof duration === 'number' && Number.isFinite(duration) && duration > 0
                    ? duration
                    : null,
                documentCommitId: documentCommitId > 0 ? documentCommitId : null,
              })
            }),
          }),
        )
        target.report.coverage.react = { status: 'available', code: 'react-root-commits' }
      }
      // Subscriptions can synchronously notify; release immediately if the cap stopped setup.
      if (target.report.state === 'stopped') {
        release(target)
      } else {
        const remainingMs = args.maxDurationMs - (now() - target.startedAt)
        if (remainingMs <= 0) stop(target, 'max-duration')
        else target.timer = setTimeout(() => stop(target, 'max-duration'), remainingMs)
      }
      recording = target
      return describe(target, { withCoverageDetail: true })
    } catch (error) {
      stop(target, 'collector-cleanup')
      release(target)
      // Failed setup must not replace the previously retained successful recording.
      throw error
    }
  }

  return defineCollector({
    meta: {
      id: 'timeline',
      title: 'Interaction timeline',
      description: 'On-demand bounded request, Query, React commit and navigation observations',
    },
    capabilities: ['timeline'],
    start: () => () => {
      if (recording) stop(recording, 'collector-cleanup')
    },
    tools: [
      defineCollectorTool({
        contract: defineAgentToolContract({
          name: 'timeline_start',
          title: 'Start interaction timeline',
          description:
            'Begin an on-demand bounded recording of request completions, Query updates, React root commits and TanStack navigation on one monotonic clock. Temporal correlation only, not causation. No listeners run before this call. One recording is retained; starting replaces a stopped recording. Automatically stops at the event or duration limit.',
          group: 'timeline',
          input: startInput,
          output: reportSchema,
          annotations: { readOnlyHint: true },
        }),
        handler: (args) => begin(startInput.parse(args)),
      }),
      defineCollectorTool({
        contract: defineAgentToolContract({
          name: 'timeline_read',
          title: 'Read interaction timeline',
          description:
            'Read a bounded page in stable observation order, optionally filtered by domain. Keep the same domains while paginating. Resource start/end times are separate from asynchronous observation time. Coverage explains missing evidence. A null nextOffset means caught up now; an active recording can append more events.',
          group: 'timeline',
          input: readInput,
          output: readOutput,
          annotations: { readOnlyHint: true },
        }),
        handler: (args) => {
          const { id, domains, offset, limit } = readInput.parse(args)
          const target = lookup(id)
          const events = domains
            ? target.events.filter((event) => domains.includes(event.domain))
            : target.events
          const nextOffset = offset + limit
          return readOutput.parse({
            ...describe(target),
            events: events.slice(offset, nextOffset).map(roundEventTimes),
            matchedEventCount: events.length,
            nextOffset: nextOffset < events.length ? nextOffset : null,
          })
        },
      }),
      defineCollectorTool({
        contract: defineAgentToolContract({
          name: 'timeline_stop',
          title: 'Stop interaction timeline',
          description:
            'Stop recording, flush queued request timing entries, unsubscribe all sources and retain a frozen report. Repeated stops return the same report. Use timeline_read to retrieve events.',
          group: 'timeline',
          input: stopInput,
          output: reportSchema,
          annotations: { readOnlyHint: true },
        }),
        handler: (args) => {
          const { id } = stopInput.parse(args)
          const target = lookup(id)
          stop(target, 'manual')
          return describe(target)
        },
      }),
    ],
  })
}
