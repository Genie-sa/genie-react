import { z } from 'zod'
import { defineAgentToolContract, definedValueSchema, outputViewSchema } from '../../protocol'
import { appOnlySchema, ownershipCoverageSchema, sourceSchema } from './contract-schemas'

export const SUSPENSE_BOUNDARY_STATES = [
  'fallback',
  'transition-pending',
  'dehydrated',
  'content',
] as const

export const SUSPENSE_BLOCKER_KINDS = [
  'lazy',
  'use',
  'data-library',
  'server-io',
  'server-stream',
  'asset',
  'unknown',
] as const

export const SUSPENSE_BLOCKER_BASES = [
  'react-use-tracking',
  'use-thenable-state',
  'lazy-type',
  'lazy-element-payload',
  'server-environment',
  'rsc-stream-name',
  'host-stylesheet-resource',
  'data-library-frame',
  'query-started-by-suspended-render',
  'debug-info-unclassified',
  'tracked-thenable-without-debug-info',
  'thrown-promise-without-debug-info',
] as const

const evidenceSchema = z.enum(['exact', 'inferred', 'unknown'])

const capabilitySchema = z
  .object({
    asyncDebugInfo: z
      .enum(['available', 'partial', 'unavailable'])
      .describe(
        "available: React 19.2+ development build, names and timings for use(), lazy and server I/O. partial: React 19.0-19.1 development, an unrecognized version, or some roots without debug information; those roots' boundaries report blockerStatus unavailable. unavailable: blockers are never reported.",
      ),
    reason: z
      .enum([
        'production-build',
        'react-before-19',
        'react-19.0-19.1',
        'unrecognized-react-version',
        'debug-fields-missing',
        'no-react-renderer',
        'some-roots-without-debug-info',
      ])
      .nullable()
      .describe('Why the data is partial or unavailable; null when available.'),
    reactVersion: z.string().nullable(),
    bundle: z.enum(['development', 'production', 'unknown']),
  })
  .describe(
    "Describes the React roots that hold Suspense boundaries; a root without one, such as a framework's dev overlay bundling its own production React, cannot hold a blocker and does not count. Derived from each renderer's version and build type plus the presence of React's development-only `_debugInfo` fiber field.",
  )

const frameSchema = z.object({
  functionName: z.string().nullable(),
  file: z.string().nullable(),
  line: z.number().int().nullable(),
  column: z.number().int().nullable(),
  isLibrary: z.boolean(),
})

const awaiterSchema = z
  .object({
    id: z
      .number()
      .int()
      .nullable()
      .describe('Component ID for react_inspect_component; null for a server component.'),
    name: z.string(),
    env: z
      .string()
      .nullable()
      .describe('Server environment, such as "Server", for React Server Components.'),
  })
  .nullable()
  .describe('The component React recorded as awaiting this blocker.')

const blockerSummarySchema = z.object({
  kind: z.enum(SUSPENSE_BLOCKER_KINDS),
  kindEvidence: evidenceSchema.describe(
    'exact: React recorded the blocker through that mechanism. inferred: a stack frame or name points there. unknown: the data does not say.',
  ),
  phase: z
    .enum(['pending', 'awaited-by-content'])
    .describe(
      "pending: React's latest render attempt of this boundary is waiting on it now. awaited-by-content: the content now on screen awaited it before committing.",
    ),
  status: z
    .enum(['pending', 'fulfilled', 'rejected', 'unknown'])
    .describe('Settlement observed on the promise at observedAtMs.'),
  name: z.string().nullable(),
  description: z
    .string()
    .nullable()
    .describe('Identifier taken from the settled value, such as a URL, file or id.'),
  durationMs: z
    .number()
    .nullable()
    .describe('end - start for a settled blocker; null when React recorded no timing.'),
  pendingForMs: z
    .number()
    .nullable()
    .describe('observedAtMs - start for a pending blocker with a recorded start; else null.'),
  awaitedBy: awaiterSchema,
  location: z
    .string()
    .nullable()
    .describe('file:line of the first app frame in the await or I/O stack.'),
  query: z
    .object({ queryHash: z.string(), queryKey: definedValueSchema('The owning query key.') })
    .nullable()
    .describe(
      'The TanStack Query this thrown promise waits on, inferred: a component under this boundary started fetching it with suspense while React rendered it, and it is still fetching. Joined only when the boundary has as many such queries as unidentified pending blockers; requires the Query collector.',
    ),
})

const blockerFullSchema = blockerSummarySchema.extend({
  basis: z.enum(SUSPENSE_BLOCKER_BASES).describe('The data that decided kind.'),
  recordedBy: z
    .enum([
      'retry-queue',
      'use-hook',
      'lazy-type',
      'lazy-element',
      'child-debug-info',
      'host-resource',
    ])
    .describe('Where React kept this entry.'),
  startMs: z
    .number()
    .nullable()
    .describe('performance.now() time React recorded the start; null when absent.'),
  endMs: z.number().nullable(),
  env: z.string().nullable(),
  owner: awaiterSchema.describe('The component that started the I/O, when React recorded one.'),
  awaitStack: z.array(frameSchema).describe('Where the blocker was awaited.'),
  ioStack: z.array(frameSchema).describe('Where the I/O started, for example the lazy() call.'),
  stacksTruncated: z.boolean(),
})

const blockerStatusSchema = z
  .enum(['pending-observed', 'awaited-only', 'none', 'unrecorded', 'not-observable', 'unavailable'])
  .describe(
    "pending-observed: at least one pending blocker came from React's retry queue. awaited-only: only blockers of the content on screen. none: no blocker recorded and no fallback committed since mount. unrecorded: a fallback committed since mount but the content left no async debug info, typically a thrown promise. not-observable: the boundary is waiting but React kept no retry queue to read, or the fallback is forced. unavailable: see capability.",
  )

const boundaryBaseSchema = z.object({
  id: z
    .number()
    .int()
    .describe(
      'Boundary fiber ID: the boundaryId of react_error_state, accepted by react_toggle_suspense_fallback.',
    ),
  name: z.string().describe('The Suspense `name` prop when set, else "Suspense".'),
  parentBoundaryId: z.number().int().nullable(),
  state: z
    .enum(SUSPENSE_BOUNDARY_STATES)
    .describe(
      'fallback: the committed tree shows the fallback. transition-pending: old content stays on screen while an uncommitted render of this boundary waits. dehydrated: server HTML not yet hydrated. content: children are shown.',
    ),
  stateEvidence: evidenceSchema.describe(
    'exact for committed state; inferred for transition-pending, which reads an uncommitted render attempt.',
  ),
  forced: z.boolean().describe('Held in its fallback by react_toggle_suspense_fallback.'),
  hydration: z
    .enum(['hydrated', 'client-rendered'])
    .nullable()
    .describe(
      'For a boundary that arrived as server HTML while Genie watched: hydrated, or client-rendered when React discarded that HTML and rendered it again on the client (see react_hydration). null otherwise.',
    ),
  fallbackCommittedSinceMount: z
    .boolean()
    .describe(
      'React attached retry listeners in a committed fallback since this boundary mounted.',
    ),
  blockerStatus: blockerStatusSchema,
  blockersOmitted: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'Blockers past blockerLimit. Blockers are ordered by what held the boundary longest: pending ones by how long they have waited, then settled ones by duration, so omitted ones waited less.',
    ),
  serverComponents: z
    .array(z.object({ name: z.string(), env: z.string().nullable() }))
    .describe(
      'Server components React recorded as rendering this boundary element or content inside it (nested boundaries list their own), in the order recorded, each once.',
    ),
  serverComponentsOmitted: z.number().int().nonnegative(),
  source: sourceSchema,
  sourceOwnership: z.enum(['app', 'library', 'unknown']),
})

const boundarySummarySchema = boundaryBaseSchema.extend({
  blockers: z.array(blockerSummarySchema),
})

const boundaryFullSchema = boundaryBaseSchema.extend({
  blockers: z.array(blockerFullSchema),
})

const reportBaseSchema = z.object({
  capability: capabilitySchema,
  observedAtMs: z.number().describe('performance.now() when fibers and promises were read.'),
  documentCommitId: z.number().int().nonnegative(),
  counts: z.object({
    boundaries: z.number().int().nonnegative(),
    fallback: z.number().int().nonnegative(),
    transitionPending: z.number().int().nonnegative(),
    dehydrated: z.number().int().nonnegative(),
    content: z.number().int().nonnegative(),
  }),
  omittedByLimit: z.number().int().nonnegative(),
  coverage: z.object({
    complete: z
      .boolean()
      .describe(
        'Async debug information is available, every boundary was scanned and returned, every waiting boundary has an identified pending blocker, and nothing changed during the read.',
      ),
    scanTruncated: z.boolean(),
    fiberScanLimit: z.number().int().positive(),
    waitingWithoutBlocker: z
      .number()
      .int()
      .nonnegative()
      .describe('Waiting boundaries with no pending blocker identified.'),
    unattributedEntries: z
      .number()
      .int()
      .nonnegative()
      .describe('Async entries recorded outside every Suspense boundary.'),
    unattributedSuspendedRoots: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Roots where React holds a suspended, uncommitted render (such as a transition suspending above every boundary) that no listed boundary explains.',
      ),
    changedDuringRead: z
      .boolean()
      .describe(
        'A React commit or a promise settlement happened while sources resolved; read again for a stable answer.',
      ),
    commitScheduled: z
      .boolean()
      .describe(
        'React finished a render and is holding its commit: Suspense reveal throttling (about 300ms) or a commit waiting on stylesheets, images or fonts. A fallback on screen may already be resolved; read again shortly.',
      ),
    sourcesPartial: z.boolean(),
    serverAwaits: z
      .enum(['none', 'last-settled-per-await'])
      .describe(
        'last-settled-per-await: listed boundaries have server-io blockers, and React records one I/O per server await. For an await on several promises at once, such as Promise.all, only the one that settled last is listed, so a read that ran beside it can be absent. Measure a fix by the critical path, from the earliest start to the latest end, not by which reads appear.',
      ),
  }),
  ownershipCoverage: ownershipCoverageSchema,
  waitingHint: z.string().nullable(),
})

export const reactSuspenseContract = defineAgentToolContract({
  name: 'react_suspense',
  title: 'Suspense boundaries and what they wait on',
  description:
    'List Suspense boundaries with their state (fallback, transition-pending, dehydrated, content) and what each is waiting on, from React\'s async debug information (the data behind DevTools "suspended by"). Pending blockers come from the latest render attempt; content boundaries list what their committed content awaited. Each blocker has a kind (lazy, use, data-library, server-io, server-stream, asset, unknown) with an evidence grade. Check capability first: React 18 and production builds report no blockers, and React 19.0-19.1 names fewer. Pass id to read one boundary (any component inside it works). The default summary view gives decision fields; view:"full" adds stacks, timings, environments and the recording mechanism.',
  group: 'react.render',
  input: z
    .object({
      id: z
        .number()
        .int()
        .optional()
        .describe('Read only the nearest Suspense boundary at or above this component ID.'),
      waitingOnly: z
        .boolean()
        .default(false)
        .describe('Only boundaries in fallback, transition-pending or dehydrated state.'),
      limit: z.number().int().min(1).max(200).default(20),
      blockerLimit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe('Blockers per boundary; pending blockers are kept first.'),
      includeSource: z
        .boolean()
        .default(true)
        .describe('Resolve boundary and stack file:line through source maps.'),
      appOnly: appOnlySchema,
      view: outputViewSchema('stacks, timings, environments, basis and recording mechanism'),
    })
    .meta({ examples: [{}, { waitingOnly: true }, { id: 12, view: 'full' }] }),
  output: z.discriminatedUnion('view', [
    reportBaseSchema.extend({
      view: z.literal('summary'),
      boundaries: z.array(boundarySummarySchema),
    }),
    reportBaseSchema.extend({ view: z.literal('full'), boundaries: z.array(boundaryFullSchema) }),
  ]),
  annotations: { readOnlyHint: true },
})

export type SuspenseBoundaryState = (typeof SUSPENSE_BOUNDARY_STATES)[number]
export type SuspenseBlockerKind = (typeof SUSPENSE_BLOCKER_KINDS)[number]
export type SuspenseBlockerBasis = (typeof SUSPENSE_BLOCKER_BASES)[number]
export type SuspenseCapability = z.infer<typeof capabilitySchema>
export type SuspenseBlockerFull = z.infer<typeof blockerFullSchema>
export type SuspenseStackFrame = z.infer<typeof frameSchema>
export type SuspenseBlockerStatus = z.infer<typeof blockerStatusSchema>
export type SuspenseAwaiter = z.infer<typeof awaiterSchema>
export type SuspenseReport = z.infer<typeof reactSuspenseContract.output>
