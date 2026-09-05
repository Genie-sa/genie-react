import { z } from 'zod'
import { defineAgentToolContract } from '../../protocol'
import { renderObservationBudgetInputSchema } from '../../protocol/react-observation-schema'
import {
  appOnlySchema,
  ownershipCoverageSchema,
  sourceProvenanceSchema,
  sourceSchema,
  wrapperFrameSchema,
} from './contract-schemas'

export const observationSchema = z.object({
  id: z.string().describe('Measurement-window ID, unique within this browser document.'),
  epoch: z.number().int().positive(),
  startedAfterDocumentCommitId: z.number().int().nonnegative(),
})

export const instanceDescriptorSchema = z.object({
  fiberId: z.number().int(),
  mountId: z.string(),
  key: z.string().nullable(),
  siblingIndex: z.number().int().nonnegative().nullable(),
  parent: z
    .object({ fiberId: z.number().int(), name: z.string(), key: z.string().nullable() })
    .nullable(),
  keyedParent: z
    .object({ fiberId: z.number().int(), name: z.string(), key: z.string().nullable() })
    .nullable(),
  logicalPath: z.string(),
  logicalIdentityEvidence: z.enum(['keyed', 'positional', 'unknown']),
  mountGeneration: z.number().int().positive(),
  mountGenerationEvidence: z.enum(['exact', 'inferred', 'unknown']),
  hostSelector: z.string().nullable(),
})

const deepDiffValueSchema = z.union([
  z.null(),
  z.string(),
  z.number(),
  z.boolean(),
  z.object({ type: z.literal('string'), value: z.string(), truncated: z.literal(true) }),
  z.object({ type: z.literal('undefined') }),
  z.object({
    type: z.literal('number'),
    value: z.enum(['NaN', 'Infinity', '-Infinity', '-0']),
  }),
  z.object({ type: z.literal('bigint'), value: z.string() }),
  z.object({ type: z.literal('symbol'), value: z.string() }),
  z.object({
    type: z.enum(['array', 'object', 'date', 'map', 'set', 'function', 'instance']),
  }),
])

const deepDiffSchema = z.object({
  changes: z.array(
    z.discriminatedUnion('kind', [
      z.object({
        kind: z.literal('value'),
        path: z.string(),
        before: deepDiffValueSchema,
        after: deepDiffValueSchema,
      }),
      z.object({ kind: z.literal('added'), path: z.string(), after: deepDiffValueSchema }),
      z.object({ kind: z.literal('removed'), path: z.string(), before: deepDiffValueSchema }),
      z.object({ kind: z.literal('reference-only'), path: z.string() }),
    ]),
  ),
  visited: z.number().int().nonnegative(),
  truncated: z
    .boolean()
    .describe(
      'True when paths are incomplete. Arbitrary object internals stay opaque; arrays and documented store fields can expose exact paths.',
    ),
})

const renderPropChangeSchema = z.object({
  name: z.string(),
  kind: z.literal('props'),
  referenceChanged: z.boolean(),
  referenceOnly: z.boolean(),
  unstable: z.boolean().describe('Legacy alias for referenceChanged.'),
  beforePresent: z.boolean(),
  afterPresent: z.boolean(),
  before: z.unknown(),
  after: z.unknown(),
  deepDiff: deepDiffSchema,
})

const renderStateChangeBase = z.object({
  name: z.string(),
  kind: z.literal('state'),
  unstable: z.literal(false),
  before: z.unknown().describe('Depth- and size-bounded value before this commit.'),
  after: z.unknown().describe('Depth- and size-bounded value after this commit.'),
  deepDiff: deepDiffSchema,
})

const renderHookStateChangeSchema = renderStateChangeBase.extend({
  hook: z.object({
    index: z.number().int().describe("Flat position in the component's complete hook chain."),
    stateIndex: z
      .number()
      .int()
      .describe('Position among useState/useReducer hooks; accepted by react_override_hook_state.'),
    kind: z.enum(['state', 'reducer']),
  }),
})

const renderClassStateChangeSchema = renderStateChangeBase.extend({
  name: z.literal('class state'),
})

const renderExternalStoreCauseBase = z.object({
  hookIndex: z.number().int().nonnegative(),
  externalStoreIndex: z.number().int().nonnegative(),
  subscriberId: z.string(),
  selectionEqual: z.literal(false),
  before: z.unknown().describe('Depth- and size-bounded selected snapshot before this commit.'),
  after: z.unknown().describe('Depth- and size-bounded selected snapshot after this commit.'),
  changedFields: z
    .array(z.string())
    .describe('Shallow selected-snapshot fields that changed; "$value" means a scalar changed.'),
  deepDiff: deepDiffSchema,
  hookProvenance: z
    .discriminatedUnion('status', [
      z.object({
        status: z.literal('exact'),
        evidence: z.literal('exact'),
        callsite: sourceSchema,
        primitiveSource: sourceSchema,
        hookAncestry: z.array(z.object({ name: z.string(), source: sourceSchema })).max(12),
      }),
      z.object({
        status: z.literal('unavailable'),
        evidence: z.literal('unknown'),
        reason: z.enum([
          'hook-count-mismatch',
          'hook-inspection-unavailable',
          'inspection-truncated',
          'shadow-render-disabled',
          'attribution-budget-exhausted',
          'no-external-store-callsite',
          'component-unmounted',
          'event-not-latest',
          'report-state-advanced',
          'hook-source-unresolved',
        ]),
      }),
    ])
    .optional(),
})

const notificationPolicySchema = z.object({
  mode: z.enum(['all', 'fields', 'auto-tracked', 'dynamic']),
  fields: z.array(z.string()).optional(),
  trackedFieldsAvailable: z.boolean(),
})

const queryIdentitySchema = z.object({
  observerId: z.string(),
  queryHash: z.string().optional(),
  queryKey: z.unknown().optional(),
  identityStatus: z.enum(['current', 'transitioning']),
  notificationPolicy: notificationPolicySchema,
  hasSelect: z.boolean(),
})

export const renderAssessmentSchema = z.object({
  inputEvidence: z.enum(['mount', 'changed', 'none-observed', 'incomplete']),
  observedInputKinds: z.array(
    z.enum([
      'mount',
      'props',
      'state',
      'children',
      'context',
      'external-store',
      'query',
      'router',
      'parent',
      'unknown',
    ]),
  ),
  behaviorEvidence: z.object({
    subtreeHostMutations: z.object({
      status: z.enum(['observed', 'none-observed', 'incomplete']),
      count: z.number().int().nonnegative(),
      pendingSubtrees: z.number().int().nonnegative(),
      omittedByLimit: z
        .number()
        .int()
        .nonnegative()
        .describe('Legacy alias for pendingSubtrees; not an omitted-Fiber count.'),
    }),
    scheduledEffects: z.object({
      status: z.enum(['observed', 'none-observed', 'incomplete']),
      count: z.number().int().nonnegative(),
    }),
    unobservedDomains: z.array(
      z.enum(['focus', 'url', 'network', 'transition', 'freshness', 'effect-execution']),
    ),
  }),
  optimizationSafety: z.literal('not-proven-safe'),
  requiredValidation: z.array(z.enum(['dom', 'aria', 'focus', 'url', 'network', 'transition'])),
})

const compilerRuntimeEvidenceSchema = z.object({
  memoCacheObserved: z.boolean(),
  evidence: z.literal('exact'),
  compilationStatus: z.literal('unknown'),
  limitation: z.literal('runtime-memo-cache-presence-only'),
})

const renderInputCoverageSchema = z.object({
  complete: z.boolean(),
  omittedInputs: z.number().int().nonnegative(),
  scanTruncated: z.boolean(),
  propsNotEnumerated: z
    .boolean()
    .describe(
      'The props container identity changed, but its arbitrary keys were not read because it may be a Proxy.',
    ),
})

const sourceAttributionSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('usage-or-definition-fallback'),
    evidence: z.literal('inferred'),
  }),
  z.object({ role: z.literal('unavailable'), evidence: z.literal('unknown') }),
])

export const renderCauseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('mount'), evidence: z.literal('exact') }),
  z.object({
    kind: z.literal('props'),
    evidence: z.literal('exact'),
    name: z.string(),
    referenceChanged: z.boolean(),
    referenceOnly: z.boolean(),
    unstable: z.boolean().describe('Legacy alias for referenceChanged.'),
    beforePresent: z.boolean(),
    afterPresent: z.boolean(),
    before: z.unknown(),
    after: z.unknown(),
    deepDiff: deepDiffSchema,
    producerCandidate: z
      .object({
        source: sourceSchema,
        evidence: z.enum(['inferred', 'unknown']),
        reason: z.literal('component-jsx-usage-or-definition-fallback'),
      })
      .optional(),
  }),
  z.object({
    kind: z.literal('state'),
    evidence: z.literal('exact'),
    name: z.string(),
    before: z.unknown(),
    after: z.unknown(),
    deepDiff: deepDiffSchema,
    hook: renderHookStateChangeSchema.shape.hook.optional(),
  }),
  z.object({ kind: z.literal('children'), evidence: z.literal('exact') }),
  z.object({
    kind: z.literal('context'),
    evidence: z.literal('exact'),
    contextIndex: z.number().int().nonnegative(),
    name: z.string(),
    before: z.unknown(),
    after: z.unknown(),
    deepDiff: deepDiffSchema,
  }),
  renderExternalStoreCauseBase.extend({
    kind: z.literal('external-store'),
    evidence: z.literal('inferred'),
    reason: z.literal('external-store-snapshot-changed'),
    storeId: z.string(),
    storeLabel: z.string(),
    selector: z.string().nullable(),
    equality: z.literal('object-is'),
    fanout: z.number().int().nonnegative().nullable(),
    notificationId: z.null(),
    competingCandidates: z.array(z.string()),
  }),
  renderExternalStoreCauseBase.extend({
    kind: z.literal('query'),
    evidence: z.enum(['exact', 'inferred']),
    reason: z.enum([
      'query-observer-result-identity',
      'queries-observer-result-identity',
      'query-notification-delivered',
      'query-result-shape',
    ]),
    notificationId: z.string().nullable().optional(),
    notification: z
      .object({
        trackedFields: z.array(z.string()),
        trackedFieldsCoverage: z.enum(['exact', 'unavailable']),
        changedResultFields: z.array(z.string()),
        deliveryReason: z
          .string()
          .describe(
            'observer-notified or tracked-field-changed:<field> for an exact tracked field.',
          ),
        fanout: z.number().int().nonnegative(),
        structuralSharing: z.object({
          reusedFields: z.array(z.string()),
          changedFields: z.array(z.string()),
          truncated: z.boolean(),
        }),
      })
      .optional(),
    notificationPolicyCheck: z
      .discriminatedUnion('status', [
        z.object({
          status: z.literal('matched'),
          basis: z.literal('current-effective-policy'),
          changedSubscribedFields: z.array(z.string()),
        }),
        z.object({
          status: z.literal('unavailable'),
          basis: z.literal('current-effective-policy'),
          reason: z.enum([
            'policy-unavailable',
            'identity-transitioning',
            'snapshot-fields-unavailable',
          ]),
        }),
      ])
      .describe('Compatibility with the current effective policy, not historical delivery proof.')
      .optional(),
    competingCandidates: z.array(z.string()).optional(),
    observerId: z.string().optional(),
    queryHash: z.string().optional(),
    queryKey: z.unknown().optional(),
    identityStatus: z.enum(['current', 'transitioning']).optional(),
    notificationPolicy: notificationPolicySchema.optional(),
    hasSelect: z.boolean().optional(),
    queries: z.array(queryIdentitySchema).optional(),
  }),
  renderExternalStoreCauseBase.extend({
    kind: z.literal('router'),
    evidence: z.enum(['exact', 'inferred']),
    reason: z.enum([
      'registered-router-store',
      'router-notification-delivered',
      'registered-router-store-nearby',
      'router-state-shape',
    ]),
    routerId: z.string().optional(),
    notificationId: z.string().nullable().optional(),
    competingCandidates: z.array(z.string()).optional(),
  }),
  z.object({
    kind: z.literal('parent'),
    evidence: z.literal('inferred'),
    parentId: z.number().int(),
    parentName: z.string(),
    reason: z.literal('nearest-rendered-ancestor'),
  }),
  z.object({
    kind: z.literal('unknown'),
    evidence: z.literal('unknown'),
    reason: z.enum([
      'no-observable-fiber-input-change',
      'input-analysis-incomplete',
      'causal-analysis-incomplete',
    ]),
  }),
])

const renderNecessitySchema = z
  .enum(['necessary', 'unnecessary', 'unknown'])
  .describe(
    'Legacy input-only classification kept for compatibility. It is not a safe-to-remove verdict; use assessment instead.',
  )

const renderCauseCountsSchema = z.object({
  mount: z.number().int().nonnegative(),
  props: z.number().int().nonnegative(),
  state: z.number().int().nonnegative(),
  children: z.number().int().nonnegative(),
  context: z.number().int().nonnegative(),
  'external-store': z.number().int().nonnegative(),
  query: z.number().int().nonnegative(),
  router: z.number().int().nonnegative(),
  parent: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
})

const renderComponentSchema = z.object({
  id: z.number(),
  name: z.string(),
  instance: instanceDescriptorSchema,
  renders: z.number(),
  mounts: z.number(),
  updates: z.number(),
  unnecessary: z
    .number()
    .describe('Legacy count; use noObservedInputChange and assessment for new integrations.'),
  noObservedInputChange: z.number(),
  referenceOnlyPropRenders: z
    .number()
    .describe('Legacy field. Automatic capture does not enumerate arbitrary prop containers.'),
  unstableRenders: z.number().describe('Legacy alias for referenceOnlyPropRenders.'),
  forget: z
    .boolean()
    .describe('Legacy name for runtime memo-cache presence; use compiler.memoCacheObserved.'),
  compiler: compilerRuntimeEvidenceSchema,
  selfTime: z.number().describe('Peak self time of one observed render, in milliseconds.'),
  totalTime: z.number().describe('Peak total time of one observed render, in milliseconds.'),
  cumulativeSelfTime: z
    .number()
    .describe('Sum of self time across observed renders in this measurement window.'),
  cumulativeTotalTime: z
    .number()
    .describe('Sum of total time across observed renders in this measurement window.'),
  changes: z.array(
    z.union([renderPropChangeSchema, renderHookStateChangeSchema, renderClassStateChangeSchema]),
  ),
  latestCommitId: z.number().int().nonnegative(),
  latestDocumentCommitId: z.number().int().nonnegative(),
  causes: z.array(renderCauseSchema),
  causeCounts: renderCauseCountsSchema,
  necessity: renderNecessitySchema,
  assessment: renderAssessmentSchema,
  inputCoverage: renderInputCoverageSchema,
  source: sourceSchema,
  sourceAttribution: sourceAttributionSchema,
  sourceProvenance: sourceProvenanceSchema,
  sourceOwnership: z.enum(['app', 'library', 'unknown']),
  isLibrary: z.boolean(),
  wrapperAncestry: z.array(wrapperFrameSchema).max(9).default([]),
})

const renderSummarySchema = z.object({
  semantics: z
    .enum(['exact', 'lower-bound', 'unknown'])
    .describe('Whether aggregate counts are complete, a lower bound, or unusable as a zero.'),
  coverageDomain: z.literal('render-measurement'),
  commits: z.number(),
  trackedComponents: z.number(),
  totalRenders: z.number(),
  totalUpdates: z.number(),
  unstableComponents: z.number(),
  referenceOnlyPropComponents: z.number(),
  unnecessaryComponents: z
    .number()
    .describe('Legacy input-only aggregate; use noObservedInputChangeComponents.'),
  noObservedInputChangeComponents: z.number(),
  topUnstableProps: z.array(z.object({ name: z.string(), count: z.number() })),
  topReferenceOnlyProps: z.array(z.object({ name: z.string(), count: z.number() })),
})

const reportAttributionSchema = z.object({
  status: z.enum(['current', 'stale']),
  startedAtDocumentCommitId: z.number().int().nonnegative(),
  completedAtDocumentCommitId: z.number().int().nonnegative(),
  startedAtAnalysisGeneration: z.number().int().nonnegative(),
  completedAtAnalysisGeneration: z.number().int().nonnegative(),
})

export const renderCoverageSchema = z.object({
  complete: z.boolean().describe("Completeness for this tool's primary result."),
  inputAttributionComplete: z
    .boolean()
    .describe('Whether causal input attribution is complete for every captured render.'),
  semantics: z.enum(['exact', 'lower-bound']),
  coverageDomain: z.enum(['render-measurement', 'render-causality']),
  skippedCommitFibers: z.number().int().nonnegative(),
  droppedUnmountFibers: z.number().int().nonnegative(),
  analysisFailedFibers: z.number().int().nonnegative(),
  truncatedInputFibers: z.number().int().nonnegative(),
  propsNotEnumeratedFibers: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'Renders whose changed props container was left opaque to avoid invoking app Proxy traps.',
    ),
  budgetExhaustedCommits: z.number().int().nonnegative(),
  budgetExhaustedSubsystems: z.array(
    z.object({ subsystem: z.string(), commits: z.number().int().positive() }),
  ),
  targeted: z
    .object({
      components: z.array(z.string()),
      roots: z.array(z.number().int()),
      processedFibers: z.number().int().nonnegative(),
      skippedFibers: z.number().int().nonnegative(),
      complete: z.boolean(),
    })
    .optional(),
  observationBudget: z
    .object({
      adaptive: z.boolean(),
      adaptiveScale: z.number().int().positive(),
      fiberLimit: z.number().int().positive(),
      operationLimit: z.number().int().positive(),
      timeLimitMs: z.number().positive(),
      targetOperationReserve: z.number().int().positive(),
      targetTimeReserveMs: z.number().positive(),
      lifecycleBufferLimit: z.number().int().positive(),
      lifecycleTargetReserve: z.number().int().nonnegative(),
    })
    .optional(),
})

export const renderObservationInputSchema = z.object({
  components: z
    .array(z.string().trim().min(1).max(160))
    .max(50)
    .default([])
    .describe('Reserve analysis work for component display names containing any value.'),
  roots: z
    .array(z.number().int())
    .max(20)
    .default([])
    .describe('Reserve analysis work for these component node IDs and their descendants.'),
  budget: renderObservationBudgetInputSchema,
  lifecycle: z
    .object({
      bufferLimit: z.number().int().min(100).max(20_000).default(1_000),
      targetReserve: z.number().int().min(0).max(5_000).default(100),
    })
    .default({ bufferLimit: 1_000, targetReserve: 100 })
    .refine((value) => value.targetReserve <= value.bufferLimit, {
      message: 'targetReserve cannot exceed bufferLimit',
      path: ['targetReserve'],
    }),
})

export const renderMeasurementEnvironmentSchema = z.object({
  bundle: z
    .enum(['development', 'production', 'mixed', 'unknown'])
    .describe(
      'Bundle types reported by registered React renderers in the app document, not the Genie build. Unknown if absent or unrecognized.',
    ),
  timingsBundleDependent: z
    .literal(true)
    .describe(
      'All timing fields depend on the measured bundle and instrumentation; development timings are not release estimates.',
    ),
  countsScope: z
    .literal('observed-run')
    .describe(
      'Counts describe this observed run, subject to coverage; development and Strict Mode behavior can differ from production.',
    ),
})

export const reactGetRendersContract = defineAgentToolContract({
  name: 'react_get_renders',
  title: 'Render report',
  description:
    'Timing fields are bundle-dependent; counts describe the observed run, not a production estimate. Report bounded component render counts, observed React input changes, stable mount identity, runtime timing, and source. Start a measurement with react_clear_renders, drive one interaction, then read this. Legacy unnecessary/forget fields remain for compatibility; use render causes and explicit evidence before editing code.',
  group: 'react.render',
  input: z
    .object({
      component: z.string().optional().describe('Only components whose name contains this string.'),
      nameFilter: z
        .string()
        .min(1)
        .max(160)
        .optional()
        .describe(
          'Case-insensitive whole-name glob: * matches any text and ? matches one character. Applied before limit.',
        ),
      excludeNames: z
        .array(z.string().min(1).max(160))
        .max(50)
        .default([])
        .describe('Case-insensitive whole-name globs to exclude before limit.'),
      minUpdates: z
        .number()
        .int()
        .nonnegative()
        .default(0)
        .describe('Minimum observed update count, applied before limit.'),
      includeCursor: z
        .boolean()
        .default(true)
        .describe(
          'Retain a frozen cursor for remaining rows. Set false for polling or one-shot reads: no snapshot is retained, the summary still covers the selected records, and omitted rows have no cursor.',
        ),
      cursor: z
        .string()
        .min(1)
        .max(100)
        .optional()
        .describe(
          'Continue a frozen report using nextCursor. Pass only cursor and optional limit; counts, filters, ordering, and source coverage remain frozen. Cursors expire after five minutes or after three newer paginated reports, and clear/profile start invalidates them.',
        ),
      sort: z
        .enum(['renders', 'updates', 'unnecessary', 'referenceOnly', 'unstable', 'selfTime'])
        .default('renders'),
      limit: z.number().int().min(1).max(200).default(40),
      appOnly: z
        .boolean()
        .default(true)
        .describe(
          'Show only records with app source evidence. Unknown ownership is excluded instead of being attributed to the app; an exact app hook callsite keeps a framework-wrapped record visible.',
        ),
    })
    .refine(
      (input) =>
        !input.cursor ||
        (!input.component &&
          !input.nameFilter &&
          input.excludeNames.length === 0 &&
          input.minUpdates === 0 &&
          input.sort === 'renders' &&
          input.appOnly === true &&
          input.includeCursor === true),
      {
        message:
          'With cursor, pass only cursor and optional limit; omit selection and sort options.',
      },
    ),
  output: z.object({
    nextCursor: z
      .string()
      .nullable()
      .describe(
        'Cursor for remaining frozen rows, or null when exhausted or includeCursor:false. Unknown ownership is reported separately.',
      ),
    pagination: z.object({
      snapshotId: z.string().nullable(),
      offset: z.number().int().nonnegative(),
      totalComponents: z.number().int().nonnegative(),
      expiresAt: z
        .number()
        .nullable()
        .describe(
          'Cursor expiry as Unix time in milliseconds. Null for one-shot reads. At most three snapshots of up to 5000 name/update-filtered candidates are retained.',
        ),
    }),
    ...renderMeasurementEnvironmentSchema.shape,
    tracking: z.boolean(),
    renderCollection: z
      .string()
      .describe(
        'Whether render collection can observe commits at all. Anything but "available" means zero counts are not evidence that nothing re-rendered.',
      ),
    commits: z.number(),
    documentCommitId: z.number().int().nonnegative(),
    observation: observationSchema.nullable(),
    attribution: reportAttributionSchema,
    summary: renderSummarySchema,
    components: z.array(renderComponentSchema),
    sourceClassification: z.object({
      complete: z
        .boolean()
        .describe('All matching candidates have app or library ownership evidence.'),
      totalCandidates: z
        .number()
        .int()
        .nonnegative()
        .describe('Matching records before appOnly and limit.'),
      evaluated: z
        .number()
        .int()
        .nonnegative()
        .describe(
          'Candidates evaluated within the source budget, including unresolved results and cache hits.',
        ),
      app: z.number().int().nonnegative(),
      library: z.number().int().nonnegative(),
      unknown: z
        .number()
        .int()
        .nonnegative()
        .describe('Unresolved or unevaluated ownership; never counted as library.'),
    }),
    omittedByLimit: z.number().int().nonnegative(),
    comparable: z.boolean(),
    notComparableReasons: z.array(z.string()),
    coverage: renderCoverageSchema,
    filteredNote: z.string().optional(),
  }),
  annotations: { readOnlyHint: true },
})

const renderCauseEventSchema = z.object({
  renderEventId: z.string(),
  observationId: z.string().nullable(),
  commitId: z.number().int().nonnegative(),
  documentCommitId: z.number().int().nonnegative(),
  componentId: z.number().int(),
  componentName: z.string(),
  instance: instanceDescriptorSchema,
  causes: z.array(renderCauseSchema),
  necessity: renderNecessitySchema,
  assessment: renderAssessmentSchema,
  inputCoverage: renderInputCoverageSchema,
  source: sourceSchema,
  sourceAttribution: sourceAttributionSchema,
  sourceOwnership: z.enum(['app', 'library', 'unknown']),
  isLibrary: z.boolean(),
})

export const reactRenderCausesContract = defineAgentToolContract({
  name: 'react_render_causes',
  title: 'Recent render evidence',
  description:
    'Report bounded render events with observation, document commit, render, component, and mount IDs plus exact, inferred, or unknown React input evidence. Start with react_clear_renders, drive one interaction, then filter by commit or component. IDs join only observed events; timing alone is never treated as causality.',
  group: 'react.render',
  input: z
    .object({
      commit: z.number().int().nonnegative().optional(),
      afterCommit: z.number().int().nonnegative().optional(),
      component: z.string().optional().describe('Only components whose name contains this string.'),
      limit: z.number().int().min(1).max(500).default(100),
      appOnly: z
        .boolean()
        .default(true)
        .describe(
          'Hide events with only library source evidence. An exact app hook callsite keeps a framework-wrapped event visible.',
        ),
    })
    .refine((input) => input.commit === undefined || input.afterCommit === undefined, {
      message: 'commit and afterCommit are mutually exclusive',
    }),
  output: z.object({
    tracking: z.boolean(),
    commits: z.number().int().nonnegative(),
    documentCommitId: z.number().int().nonnegative(),
    observation: observationSchema.nullable(),
    attribution: reportAttributionSchema,
    events: z.array(renderCauseEventSchema),
    omittedByLimit: z.number().int().nonnegative(),
    coverage: renderCoverageSchema.extend({
      droppedRenderEvents: z.number().int().nonnegative(),
    }),
    renderEventRetention: z.object({
      evictedEvents: z.number().int().nonnegative(),
      earliestDocumentCommitId: z.number().int().nonnegative().nullable(),
      latestDocumentCommitId: z.number().int().nonnegative().nullable(),
    }),
    filteredNote: z.string().optional(),
  }),
  annotations: { readOnlyHint: true },
})

export const reactComponentCohortContract = defineAgentToolContract({
  name: 'react_component_cohort',
  title: 'Component lifecycle cohort',
  description:
    'Distinguish matching component instances that updated, stayed mounted and idle, unmounted, are absent, or were omitted by a limit. Start with react_clear_renders, drive one interaction, then query an exact display name. Each row includes key/position strength, mount generation, and React Offscreen visibility independently of lifecycle. Hidden does not establish the cause of freezing or whether effects remain subscribed.',
  group: 'react.render',
  input: z.object({
    appOnly: appOnlySchema,
    component: z
      .string()
      .min(1)
      .describe(
        'Component display name; matched exactly by default, or as a substring with exact:false.',
      ),
    exact: z.boolean().default(true),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  output: z.object({
    attribution: reportAttributionSchema,
    documentCommitId: z.number().int().nonnegative(),
    ownershipCoverage: ownershipCoverageSchema,
    observation: observationSchema.nullable(),
    query: z.object({ component: z.string(), exact: z.boolean() }),
    status: z.enum([
      'not-started',
      'absent',
      'mounted-idle',
      'updated',
      'unmounted',
      'mixed',
      'unknown',
    ]),
    matched: z.number().int().nonnegative(),
    mountedUpdated: z.number().int().nonnegative(),
    mountedIdle: z.number().int().nonnegative(),
    mountedUnknown: z.number().int().nonnegative(),
    unmounted: z.number().int().nonnegative(),
    returned: z.number().int().nonnegative(),
    omittedByLimit: z.number().int().nonnegative(),
    instances: z.array(
      z.object({
        componentName: z.string(),
        sourceOwnership: z.enum(['app', 'library', 'unknown']),
        source: sourceSchema,
        sourceProvenance: sourceProvenanceSchema,
        renderingState: z
          .enum([
            'mounted-rendering',
            'mounted-frozen',
            'mounted-hidden',
            'mounted-unknown',
            'unmounted',
          ])
          .describe(
            'Current render eligibility, independent of updates during the observation. Frozen requires the react-freeze adapter and a committed suspended primary; hidden alone does not prove react-freeze. Rendering means eligible, not necessarily currently updating. No effect or observer subscription claim.',
          ),
        reactVisibility: z
          .enum(['hidden', 'not-hidden', 'unknown'])
          .describe(
            'Hidden means a committed React Offscreen ancestor has hidden state; not-hidden means no such boundary was observed, not necessarily visible on screen. Unknown for unmounted instances or incomplete boundary state. This does not establish a react-freeze or navigation freeze cause.',
          ),
        status: z.enum(['mounted-idle', 'mounted-updated', 'mounted-unknown', 'unmounted']),
        instance: instanceDescriptorSchema,
        profileCommitId: z.number().int().nonnegative().optional(),
        documentCommitId: z.number().int().nonnegative().optional(),
      }),
    ),
    coverage: z.object({
      freezeDetection: z.enum(['react-freeze-identity', 'disabled']),
      complete: z
        .boolean()
        .describe(
          'Global completeness of lifecycle and cohort capture; returned per-instance statuses can remain authoritative when false.',
        ),
      inputAttributionComplete: z.boolean(),
      scannedFibers: z.number().int().nonnegative(),
      scanLimit: z.number().int().positive(),
      scanTruncated: z.boolean(),
      rootAvailable: z.boolean(),
      rootCount: z.number().int().nonnegative(),
      scannedRootCount: z.number().int().nonnegative(),
      rootLimit: z.number().int().positive(),
      rootScope: z.enum(['committed', 'committed+fallback', 'fallback', 'missing']),
      rootScopeComplete: z.boolean(),
      rootScopeTruncated: z.boolean(),
      skippedCommitFibers: z.number().int().nonnegative(),
      droppedUnmountFibers: z.number().int().nonnegative(),
      analysisFailedFibers: z.number().int().nonnegative(),
      truncatedInputFibers: z.number().int().nonnegative(),
      propsNotEnumeratedFibers: z.number().int().nonnegative(),
      budgetExhaustedCommits: z.number().int().nonnegative(),
      budgetExhaustedSubsystems: z.array(
        z.object({ subsystem: z.string(), commits: z.number().int().positive() }),
      ),
      generationHistoryEvictions: z.number().int().nonnegative(),
    }),
  }),
  annotations: { readOnlyHint: true },
})

export const reactClearRendersContract = defineAgentToolContract({
  name: 'react_clear_renders',
  title: 'Start a render measurement',
  description:
    'Clear profile aggregates and start a new observation window. The returned observation ID joins later render and effect evidence; it does not imply that a browser interaction happened.',
  group: 'react.render',
  input: renderObservationInputSchema,
  output: z.object({
    ok: z.boolean(),
    tracking: z.boolean(),
    documentCommitId: z.number().int().nonnegative(),
    observation: observationSchema,
    observationConfig: renderCoverageSchema.shape.observationBudget.unwrap(),
  }),
  annotations: { idempotentHint: false },
})
