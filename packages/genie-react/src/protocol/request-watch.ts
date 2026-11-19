import { z } from 'zod'
import { defineAgentToolContract } from './contract'

export const MAX_LISTED_WATCHED_REQUESTS = 10

const watchIdSchema = z.string().regex(/^requests-[0-9a-f-]{36}$/, 'not a request watch ID')

const requestWatchReportSchema = z.object({
  watchId: z.string(),
  state: z.enum(['watching', 'stopped']),
  stopReason: z
    .enum(['manual', 'max-duration', 'replaced', 'collector-cleanup'])
    .nullable()
    .describe('replaced: a newer watch evicted this one because too many were open.'),
  durationMs: z.number().nonnegative(),
  started: z
    .number()
    .int()
    .nonnegative()
    .describe('fetch and XMLHttpRequest calls the app started while the watch was open.'),
  inFlight: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'Of those, the ones not finished: no response yet, or a fetch body the app is still reading. A stopped watch keeps the count from its stop.',
    ),
  requests: z
    .array(
      z.object({
        requestId: z.number().int().positive(),
        initiatorType: z.enum(['fetch', 'xmlhttprequest']),
        method: z.string(),
        url: z
          .string()
          .describe('Origin and path; the query, fragment and credentials are left out.'),
        ageMs: z.number().nonnegative(),
      }),
    )
    .max(MAX_LISTED_WATCHED_REQUESTS)
    .describe(`The in-flight requests, oldest first, at most ${MAX_LISTED_WATCHED_REQUESTS}.`),
})
export type RequestWatchReport = z.infer<typeof requestWatchReportSchema>

export const requestWatchStartContract = defineAgentToolContract({
  name: 'request_watch_start',
  title: 'Start watching app requests',
  description:
    "Start counting the fetch and XMLHttpRequest calls the app makes from now on, so a later read can tell whether any is still in flight. Requests started before this call, Genie's own requests, workers, WebSocket and EventSource are not seen. verify begin opens one for its network settle domain. The watch stops by itself after maxDurationMs.",
  group: 'timeline',
  input: z
    .object({
      maxDurationMs: z.number().int().min(1_000).max(1_800_000).default(300_000),
    })
    .strict(),
  output: requestWatchReportSchema,
  annotations: { readOnlyHint: true },
})

export const requestWatchReadContract = defineAgentToolContract({
  name: 'request_watch_read',
  title: 'Read a request watch',
  description:
    'Report how many app requests the watch saw start and how many are still in flight, listing the oldest in-flight ones.',
  group: 'timeline',
  input: z.object({ watchId: watchIdSchema }).strict(),
  output: requestWatchReportSchema,
  annotations: { readOnlyHint: true, idempotentHint: true },
})

export const requestWatchStopContract = defineAgentToolContract({
  name: 'request_watch_stop',
  title: 'Stop a request watch',
  description: 'Stop the watch and return its final report. Repeated stops return the same report.',
  group: 'timeline',
  input: z.object({ watchId: watchIdSchema }).strict(),
  output: requestWatchReportSchema,
  annotations: { readOnlyHint: true, idempotentHint: true },
})

/** One line naming what keeps the network busy, for settle reasons and refusals. */
export function describeInFlightRequests(report: RequestWatchReport): string {
  const shown = report.requests
    .slice(0, 3)
    .map((request) => `${request.method} ${request.url} (${Math.round(request.ageMs)} ms)`)
  const more = report.inFlight - shown.length
  return `${report.inFlight} ${report.inFlight === 1 ? 'request is' : 'requests are'} still in flight: ${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}`
}
