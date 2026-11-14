import { z } from 'zod'
import { defineAgentToolContract } from './contract'

export const MAX_PENDING_WORK_BOUNDARIES = 20

export const reactPendingWorkContract = defineAgentToolContract({
  name: 'react_pending_work',
  title: 'Pending React work',
  description:
    'Report React work that has not committed yet: roots with scheduled or suspended updates (a pending transition, a queued update) and Suspense boundaries showing a fallback while they wait on data. react_quiesce and devtools_wait read it before reporting React idle. Boundaries held open by react_toggle_suspense_fallback are excluded. Timers and promises that have not reached React are invisible here.',
  group: 'react.render',
  input: z.object({}).strict(),
  output: z.object({
    documentCommitId: z
      .number()
      .int()
      .nonnegative()
      .describe('The document commit counter when the scan ran, so a caller can tell a commit raced it.'),
    scheduledRoots: z
      .number()
      .int()
      .nonnegative()
      .describe('Mounted roots whose pending lanes are non-zero: an update React has not committed.'),
    suspendedBoundaries: z
      .number()
      .int()
      .nonnegative()
      .describe('Suspense boundaries currently showing a fallback, excluding forced ones.'),
    boundaries: z
      .array(z.object({ boundaryId: z.number(), boundaryName: z.string() }))
      .max(MAX_PENDING_WORK_BOUNDARIES),
    scanTruncated: z
      .boolean()
      .describe('The fiber scan stopped at its limit, so suspendedBoundaries is a lower bound.'),
  }),
  annotations: { readOnlyHint: true, idempotentHint: true },
})

export type PendingReactWork = z.infer<typeof reactPendingWorkContract.output>
