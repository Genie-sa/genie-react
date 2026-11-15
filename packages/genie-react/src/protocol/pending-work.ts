import { z } from 'zod'
import { defineAgentToolContract } from './contract'

export const MAX_PENDING_WORK_BOUNDARIES = 20

export const reactPendingWorkContract = defineAgentToolContract({
  name: 'react_pending_work',
  title: 'Pending React work',
  description:
    'Report React work that has not committed yet: roots with scheduled or suspended updates (a pending transition, a queued update), Suspense boundaries showing a fallback while they wait on data, and server-rendered boundaries not hydrated yet. Boundaries are the ones react_suspense reports in the fallback or dehydrated state; those inside hidden Activity or Offscreen subtrees are not on screen and are skipped. react_quiesce and devtools_wait read it before reporting React idle. Boundaries held open by react_toggle_suspense_fallback are excluded. Timers and promises that have not reached React are invisible here.',
  group: 'react.render',
  input: z.object({}).strict(),
  output: z.object({
    documentCommitId: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'The document commit counter when the scan ran, so a caller can tell a commit raced it.',
      ),
    scheduledRoots: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Mounted roots whose pending lanes are non-zero: an update React has not committed.',
      ),
    suspendedBoundaries: z
      .number()
      .int()
      .nonnegative()
      .describe('Suspense boundaries currently showing a fallback, excluding forced ones.'),
    dehydratedBoundaries: z
      .number()
      .int()
      .nonnegative()
      .default(0)
      .describe(
        'Server-rendered boundaries still showing server HTML that React has not hydrated, so it does not respond to input yet.',
      ),
    boundaries: z
      .array(
        z.object({
          boundaryId: z.number(),
          boundaryName: z.string(),
          state: z.enum(['fallback', 'dehydrated']).default('fallback'),
        }),
      )
      .max(MAX_PENDING_WORK_BOUNDARIES),
    scanTruncated: z
      .boolean()
      .describe(
        'The fiber scan stopped at its limit, so suspendedBoundaries and dehydratedBoundaries are lower bounds.',
      ),
  }),
  annotations: { readOnlyHint: true, idempotentHint: true },
})

export type PendingReactWork = z.infer<typeof reactPendingWorkContract.output>
