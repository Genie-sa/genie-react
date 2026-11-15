import { z } from 'zod'
import { appValueSchema, defineAgentToolContract, outputViewSchema } from '../../protocol'
import { renderObservationBudgetInputSchema } from '../../protocol/react-observation-schema'
import { componentMatchSchema, componentSelectorInputShape } from './component-name'
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
      z
        .object({ kind: z.literal('reference-only'), path: z.string() })
        .describe('Contents were compared completely and are equal; only the identity is new.'),
      z
        .object({ kind: z.literal('identity-changed-uninspected'), path: z.string() })
        .describe(
          'Identity changed but contents were not compared: an opaque object, a function, a value past the inspected depth, or an accessor.',
        ),
    ]),
  ),
  visited: z.number().int().nonnegative(),
  truncated: z
    .boolean()
    .describe(
      'True when paths are incomplete. Arbitrary object internals stay opaque; arrays, first-level plain-object props, plain-object state and context up to two levels, and documented store fields can expose exact paths.',
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
  before: appValueSchema('Depth- and size-bounded value before this commit.'),
  after: appValueSchema('Depth- and size-bounded value after this commit.'),
  deepDiff: deepDiffSchema,
})

const renderStateChangeBase = z.object({
  name: z.string(),
  kind: z.literal('state'),
  unstable: z.literal(false),
  before: appValueSchema('Depth- and size-bounded value before this commit.'),
  after: appValueSchema('Depth- and size-bounded value after this commit.'),
  deepDiff: deepDiffSchema,
})

const renderHookStateChangeSchema = renderStateChangeBase.extend({
  hook: z.object({
    index: z.number().int().describe("Flat position in the component's complete hook chain."),
    stateIndex: z
      .number()
      .int()
      .nullable()
      .describe(
        "The hook's stateIndex in react_inspect_component, accepted by react_override_hook_state. null for the pending flag React keeps inside useTransition and useActionState, which has no stateIndex.",
      ),
    kind: z.enum(['state', 'reducer']),
  }),
})

const renderClassStateChangeSchema = renderStateChangeBase.extend({
  name: z.literal('class state'),
  changedFields: z
    .array(z.string())
    .describe('Top-level fields of this.state whose value or reference changed.'),
})

const renderExternalStoreCauseBase = z.object({
  hookIndex: z.number().int().nonnegative(),
  externalStoreIndex: z.number().int().nonnegative(),
  subscriberId: z.string(),
  selectionEqual: z.literal(false),
  subscriptionFired: z
    .literal(true)
    .nullable()
    .describe(
      'true: React scheduled an update on this subscriber, as a store subscription does when it fires. null: unreadable. A snapshot that changed only because this render recomputed it from new props is not reported as a store cause.',
    ),
  before: appValueSchema('Depth- and size-bounded selected snapshot before this commit.'),
  after: appValueSchema('Depth- and size-bounded selected snapshot after this commit.'),
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
  observedInputKinds: z
    .array(
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
    )
    .describe(
      'Kinds of the exact input changes; unknown marks a changed hook Genie cannot classify.',
    ),
  behaviorEvidence: z.object({
    subtreeHostMutations: z
      .object({
        status: z.enum(['observed', 'none-observed', 'incomplete']),
        count: z
          .number()
          .int()
          .nonnegative()
          .describe(
            'Host writes this commit performed for the render and the children it rendered: changed attributes, styles or text, and inserted, moved or removed nodes. A prop React does not write, such as a new event handler, is not counted.',
          ),
        pendingSubtrees: z.number().int().nonnegative().describe('Legacy field, always 0.'),
        omittedByLimit: z.number().int().nonnegative().describe('Legacy field, always 0.'),
        callbackOnlyUpdates: z
          .number()
          .int()
          .nonnegative()
          .describe(
            'Host elements whose only changed props were functions, such as a new onClick or ref callback: no host write, but new closures.',
          ),
        writes: z
          .array(z.string())
          .max(8)
          .describe(
            'Up to 8 distinct writes: element.prop, #text, element:insert, element:move, element:remove-child or suspense:visibility.',
          ),
        callbacks: z.array(z.string()).max(8).describe('Up to 8 element.prop callback changes.'),
      })
      .describe(
        'Children that rendered for their own update with unchanged props keep their output, and output a Context change caused is credited to the component that renders its provider.',
      ),
    scheduledEffects: z.object({
      status: z.enum(['observed', 'none-observed', 'incomplete']),
      count: z.number().int().nonnegative(),
    }),
    subtreeScheduledEffects: z
      .object({
        status: z.enum(['observed', 'none-observed', 'incomplete']),
        count: z.number().int().nonnegative(),
      })
      .describe(
        'Effects and class lifecycles scheduled by this render and the children it rendered with changed inputs.',
      ),
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
      'The changed props container was not a plain object (class instance or exotic object), so its keys were not read.',
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
    before: appValueSchema('Depth- and size-bounded value before this commit.'),
    after: appValueSchema('Depth- and size-bounded value after this commit.'),
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
    before: appValueSchema('Depth- and size-bounded value before this commit.'),
    after: appValueSchema('Depth- and size-bounded value after this commit.'),
    deepDiff: deepDiffSchema,
    hook: renderHookStateChangeSchema.shape.hook.optional(),
  }),
  z.object({ kind: z.literal('children'), evidence: z.literal('exact') }),
  z.object({
    kind: z.literal('context'),
    evidence: z.literal('exact'),
    contextIndex: z
      .number()
      .int()
      .nonnegative()
      .describe("Position among this component's own Context reads; differs between consumers."),
    contextId: z
      .string()
      .describe('Identifies the Context object: equal across every consumer of the same Context.'),
    name: z
      .string()
      .describe(
        'The Context displayName, else Context(<component rendering its provider>), else Context[contextIndex].',
      ),
    provider: z
      .object({ componentId: z.number().int(), componentName: z.string() })
      .nullable()
      .describe('The component that renders the nearest provider, whose value changed.'),
    before: appValueSchema('Depth- and size-bounded value before this commit.'),
    after: appValueSchema('Depth- and size-bounded value after this commit.'),
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
    origin: z
      .object({ componentId: z.number().int(), componentName: z.string() })
      .nullable()
      .optional()
      .describe(
        'The nearest rendered ancestor React scheduled an update on, whose state, store, Context or forceUpdate started the cascade that reached this component. null when the chain could not be followed.',
      ),
  }),
  z.object({
    kind: z.literal('unknown'),
    evidence: z.literal('unknown'),
    reason: z
      .enum([
        'no-observable-fiber-input-change',
        'input-analysis-incomplete',
        'causal-analysis-incomplete',
        'unclassified-hook-changed',
      ])
      .describe(
        'no-observable-fiber-input-change: React rendered for an input Genie cannot see, such as forceUpdate. unclassified-hook-changed: a hook Genie cannot classify, such as useDeferredValue, holds a new value.',
      ),
    hookIndex: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Position of the changed hook for unclassified-hook-changed.'),
  }),
])

const renderNecessitySchema = z
  .enum(['necessary', 'unnecessary', 'unknown'])
  .describe(
    'necessary: the render wrote to the host. unnecessary: its inputs were provably equal, or it wrote nothing, replaced no callback and scheduled no effect. unknown: see necessityReason. Not a safe-to-remove verdict; validate the behavior assessment lists.',
  )

const necessityReasonSchema = z
  .enum([
    'mount',
    'dom-changed',
    'inputs-unchanged',
    'output-unchanged',
    'callbacks-changed',
    'effects-scheduled',
    'output-incomplete',
  ])
  .describe(
    'callbacks-changed: no host write, but new event handlers or ref callbacks whose closures Genie cannot compare. effects-scheduled: no host write, but effects or lifecycles were scheduled. output-incomplete: a host update, child render or budget could not be analyzed.',
  )

const RENDER_CAUSE_KINDS = [
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
] as const

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

const compactCauseSchema = z.object({
  kind: z.enum(RENDER_CAUSE_KINDS),
  evidence: z.enum(['exact', 'inferred', 'unknown']),
  name: z
    .string()
    .optional()
    .describe(
      'Prop, state or context name, store label, query hash, router ID or parent component.',
    ),
  contextIndex: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Which context read changed, for a component that reads the same context twice.'),
  referenceOnly: z.literal(true).optional(),
  reason: z
    .string()
    .optional()
    .describe(
      'Why an unknown cause could not be attributed, or how a query cause was matched; only query-notification-delivered is exact.',
    ),
  changedResultFields: z
    .array(z.string())
    .optional()
    .describe('Query result fields the delivered notification changed, e.g. data or fetchStatus.'),
  origin: z
    .string()
    .optional()
    .describe(
      'For a parent cause, the ancestor whose own update started the cascade, when it is not the parent itself. Fix the render there.',
    ),
})

const relatedRenderSchema = z
  .object({
    componentId: z.number().int(),
    componentName: z.string(),
    renderEventId: z.string(),
    causes: z.array(compactCauseSchema),
    necessity: renderNecessitySchema,
    necessityReason: necessityReasonSchema,
  })
  .optional()

const wrapperRelationShape = {
  wraps: relatedRenderSchema.describe(
    'The component this higher-order or memo wrapper renders, with its causes in the same commit. A wrapper such as Connect(Inner) often holds only an inferred store cause while the inner component holds the exact prop evidence.',
  ),
  wrappedBy: relatedRenderSchema.describe(
    'The higher-order or memo wrapper that rendered this component in the same commit, with its causes.',
  ),
}

export const renderComponentSchema = z.object({
  id: z.number(),
  name: z.string(),
  instance: instanceDescriptorSchema,
  renders: z
    .number()
    .describe(
      'Committed renders observed in this window. StrictMode double invocation, render attempts React discarded, and renders React bailed out of are not counted.',
    ),
  mounts: z.number(),
  updates: z.number(),
  unmounted: z
    .boolean()
    .describe('The instance unmounted inside this window; its renders stay counted.'),
  unnecessary: z
    .number()
    .describe('Legacy count; use noObservedInputChange and assessment for new integrations.'),
  noObservedInputChange: z
    .number()
    .describe(
      'Updates with complete input coverage where no input held a new value: the parent rendered without changing props, or state or context only received a new object with equal contents. Updates with no observed trigger, such as forceUpdate or useDeferredValue, are excluded and carry an unknown cause.',
    ),
  referenceOnlyPropRenders: z
    .number()
    .describe(
      'Renders of memo, PureComponent, or shouldComponentUpdate components whose only input changes were non-function props with a new reference that a complete bounded diff found equal. Excludes truncated diffs and partial scans; see undeterminedReferencePropRenders. A custom shouldComponentUpdate is never called, so such a class may have rendered by its own rules.',
    ),
  unstableRenders: z.number().describe('Legacy alias for referenceOnlyPropRenders.'),
  functionIdentityPropRenders: z
    .number()
    .describe(
      'Renders of memo, PureComponent, or shouldComponentUpdate components whose only input changes, under complete coverage, were props with a new reference: at least one a function with a new identity, such as an inline callback, and the rest reference-only. Not counted as reference-only because closures can differ.',
    ),
  undeterminedReferencePropRenders: z
    .number()
    .describe(
      'Renders of memo, PureComponent, or shouldComponentUpdate components whose only input changes were reference-changed props that a partial input scan, or a truncated diff of a non-function value, could not classify as reference-only.',
    ),
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
  necessityReason: necessityReasonSchema,
  assessment: renderAssessmentSchema,
  inputCoverage: renderInputCoverageSchema,
  source: sourceSchema,
  sourceAttribution: sourceAttributionSchema,
  sourceProvenance: sourceProvenanceSchema,
  sourceOwnership: z.enum(['app', 'library', 'unknown']),
  isLibrary: z.boolean(),
  wrapperAncestry: z.array(wrapperFrameSchema).max(9).default([]),
  ...wrapperRelationShape,
})

const compactSourceSchema = z
  .object({
    location: z.string().nullable().describe('file:line:column of the usage or definition.'),
    role: z
      .enum(['element-callsite', 'component-body', 'hook-callsite'])
      .optional()
      .describe(
        'What location points at: element-callsite is the JSX that created the component, in its parent; component-body is inside the component itself.',
      ),
    ownership: z.enum(['app', 'library', 'unknown']),
  })
  .describe('Collapses source, sourceAttribution, sourceProvenance, sourceOwnership and isLibrary.')

const compactInputCoverageSchema = renderInputCoverageSchema
  .partial()
  .describe('Present only when input attribution is incomplete; lists the failing checks.')

export const renderComponentSummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  mountId: z.string(),
  key: z.string().optional(),
  renders: z.number(),
  updates: z.number(),
  mounts: z.number().optional().describe('Omitted when zero, like the other optional counts.'),
  unmounted: z
    .literal(true)
    .optional()
    .describe('Present when the instance unmounted inside this window.'),
  noObservedInputChange: z
    .number()
    .optional()
    .describe('Kept at zero under sort:"unnecessary", which ranks by it.'),
  referenceOnlyPropRenders: z
    .number()
    .optional()
    .describe('Kept at zero under sort:"unstable" or "referenceOnly", which rank by it.'),
  functionIdentityPropRenders: z
    .number()
    .optional()
    .describe('Memo renders driven by a new function identity, such as an inline callback.'),
  undeterminedReferencePropRenders: z
    .number()
    .optional()
    .describe('Memo renders whose reference-changed props could not be classified.'),
  selfTime: z.number(),
  totalTime: z.number(),
  cumulativeSelfTime: z.number().optional().describe('Omitted when it equals selfTime.'),
  cumulativeTotalTime: z.number().optional().describe('Omitted when it equals totalTime.'),
  latestDocumentCommitId: z.number().int().nonnegative(),
  causeCounts: z.partialRecord(z.enum(RENDER_CAUSE_KINDS), z.number().int().positive()),
  causes: z.array(compactCauseSchema).describe('Causes of the latest observed render.'),
  necessity: renderNecessitySchema.describe('Necessity of the latest observed render.'),
  necessityReason: necessityReasonSchema,
  inputEvidence: renderAssessmentSchema.shape.inputEvidence,
  inputCoverage: compactInputCoverageSchema.optional(),
  memoCacheObserved: z.literal(true).optional(),
  wrappers: z.array(z.string()).optional(),
  ...wrapperRelationShape,
  source: compactSourceSchema,
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

const renderSummaryViewSchema = renderSummarySchema.omit({
  unstableComponents: true,
  unnecessaryComponents: true,
  topUnstableProps: true,
})

const reportAttributionSchema = z.object({
  status: z.enum(['current', 'stale']),
  startedAtDocumentCommitId: z.number().int().nonnegative(),
  completedAtDocumentCommitId: z.number().int().nonnegative(),
  startedAtAnalysisGeneration: z.number().int().nonnegative(),
  completedAtAnalysisGeneration: z.number().int().nonnegative(),
})

const renderBudgetLimitSchema = z.enum([
  'fiberLimit',
  'operationLimit',
  'timeLimitMs',
  'targetOperationReserve',
  'targetTimeReserveMs',
])

export const renderCoverageSchema = z.object({
  sourceClassification: ownershipCoverageSchema
    .extend({ evaluated: z.number().int().nonnegative() })
    .optional(),
  complete: z.boolean().describe("Completeness for this tool's primary result."),
  inputAttributionComplete: z
    .boolean()
    .describe('Whether causal input attribution is complete for every captured render.'),
  semantics: z.enum(['exact', 'lower-bound']),
  coverageDomain: z.enum(['render-measurement', 'render-causality']),
  skippedCommitFibers: z.number().int().nonnegative(),
  droppedUnmountFibers: z.number().int().nonnegative(),
  analysisFailedFibers: z.number().int().nonnegative(),
  pausedCommits: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'Commits React made after react_profile_stop paused recording. They fall outside the measured window, so counts read now are a lower bound for the time since; react_profile_stop reports coverage as of the pause.',
    ),
  truncatedInputFibers: z.number().int().nonnegative(),
  propsNotEnumeratedFibers: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'Renders whose changed props container was not a plain object, so its keys were left unread.',
    ),
  budgetExhaustedCommits: z.number().int().nonnegative(),
  budgetExhaustedSubsystems: z.array(
    z.object({ subsystem: z.string(), commits: z.number().int().positive() }),
  ),
  budgetAdvice: z
    .object({
      exhaustedLimits: z.array(renderBudgetLimitSchema),
      suggestedBudget: z.record(renderBudgetLimitSchema, z.number().positive()),
      next: z.string(),
    })
    .optional()
    .describe(
      'Present when a budget limit skipped work in this window: the limits that ran out and a budget estimated to fit the largest lossy commit. Growth inside the window cannot restore skipped commits, so clear with the suggested budget and repeat the step.',
    ),
  incompleteBecause: z
    .array(
      z.object({
        reason: z.enum([
          'budget-exhausted',
          'unmounts-dropped',
          'commits-after-profile-stop',
          'renderer-not-analyzed',
          'traversal-failed',
          'analysis-failed',
          'inputs-truncated',
          'props-not-enumerated',
        ]),
        fibers: z.number().int().nonnegative(),
        components: z
          .array(z.string())
          .optional()
          .describe('Up to 10 component names behind an input gap.'),
        detail: z.string(),
        next: z.string().optional(),
      }),
    )
    .optional()
    .describe('Present when coverage is incomplete: one entry for each counter that made it so.'),
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

const observedNameSchema = z.string().trim().min(1).max(160)

export const deprecationsSchema = z
  .array(z.string())
  .optional()
  .describe('Arguments this call accepted under an old name, with the name to use instead.')

export const renderObservationInputSchema = z.object({
  component: z
    .union([observedNameSchema, z.array(observedNameSchema).min(1).max(50)])
    .optional()
    .describe(
      'Reserve analysis work for these components: one display name or a list, matched exactly (case-sensitive) like the read tools. Pass exact:false to match every name containing one, ignoring case.',
    ),
  exact: z
    .boolean()
    .default(true)
    .describe('false matches each component value as a case-insensitive substring.'),
  components: z
    .array(observedNameSchema)
    .max(50)
    .default([])
    .describe(
      'Deprecated: use component with exact:false. Reserves analysis for display names containing any value, ignoring case.',
    ),
  roots: z
    .array(z.number().int())
    .max(20)
    .default([])
    .describe('Reserve analysis work for these component node IDs and their descendants.'),
  budget: renderObservationBudgetInputSchema,
  lifecycle: z
    .object({
      bufferLimit: z
        .number()
        .int()
        .min(100)
        .max(20_000)
        .default(1_000)
        .describe(
          'Bounds pending unmounts per commit and the unmounted components whose renders stay in the report.',
        ),
      targetReserve: z.number().int().min(0).max(5_000).default(100),
    })
    .default({ bufferLimit: 1_000, targetReserve: 100 })
    .refine((value) => value.targetReserve <= value.bufferLimit, {
      message: 'targetReserve cannot exceed bufferLimit',
      path: ['targetReserve'],
    }),
})

export const strictModeStatusSchema = z
  .enum(['on', 'off', 'partial', 'unknown'])
  .describe(
    'Whether mounted components render under React StrictMode: on for all, off for none, partial for some; unknown with no mounted components or a tree too large to scan. StrictMode replays effects on mount in development.',
  )

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

const renderSourceClassificationSchema = z.object({
  complete: z.boolean().describe('All matching candidates have app or library ownership evidence.'),
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
})

const renderReportBaseSchema = z.object({
  componentMatch: componentMatchSchema.optional(),
  nextCursor: z
    .string()
    .nullable()
    .describe(
      'Cursor for remaining frozen rows, or null when exhausted, includeCursor:false, or pagination.cursorOmitted is set. Unknown ownership is reported separately.',
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
    cursorOmitted: z
      .enum(['candidate-limit'])
      .optional()
      .describe(
        'Set when includeCursor was true but no cursor was retained: more than 5000 components match the name/update filters. The report is one-shot instead; the summary covers every match and omittedByLimit counts the rows past limit. Narrow component, nameFilter, excludeNames or minUpdates to page through them.',
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
  sourceClassification: renderSourceClassificationSchema,
  omittedByLimit: z.number().int().nonnegative(),
  comparable: z.boolean(),
  notComparableReasons: z.array(z.string()),
  coverage: renderCoverageSchema,
  filteredNote: z.string().optional(),
})

export const reactGetRendersContract = defineAgentToolContract({
  name: 'react_get_renders',
  title: 'Render report',
  description:
    'Timing fields are bundle-dependent; counts describe the observed run, not a production estimate. Report bounded component render counts, observed React input changes, stable mount identity, runtime timing, and source. Start a measurement with react_clear_renders, drive one interaction, then read this. The default summary view keeps compact per-component evidence; view:"full" adds input values and diffs, behavior assessment, detailed source provenance and the legacy unnecessary/forget fields.',
  group: 'react.render',
  input: z
    .object({
      ...componentSelectorInputShape,
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
      view: outputViewSchema('every component field, including legacy aliases'),
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
          'With cursor, pass only cursor and optional limit or view; omit selection and sort options.',
      },
    ),
  output: z.discriminatedUnion('view', [
    renderReportBaseSchema.extend({
      view: z.literal('summary'),
      summary: renderSummaryViewSchema,
      components: z.array(renderComponentSummarySchema),
    }),
    renderReportBaseSchema.extend({
      view: z.literal('full'),
      summary: renderSummarySchema,
      components: z.array(renderComponentSchema),
    }),
  ]),
  annotations: { readOnlyHint: true },
})

export const renderCauseEventSchema = z.object({
  renderEventId: z.string(),
  observationId: z.string().nullable(),
  commitId: z.number().int().nonnegative(),
  documentCommitId: z.number().int().nonnegative(),
  componentId: z.number().int(),
  componentName: z.string(),
  instance: instanceDescriptorSchema,
  causes: z.array(renderCauseSchema),
  necessity: renderNecessitySchema,
  necessityReason: necessityReasonSchema,
  assessment: renderAssessmentSchema,
  inputCoverage: renderInputCoverageSchema,
  source: sourceSchema,
  sourceAttribution: sourceAttributionSchema,
  sourceOwnership: z.enum(['app', 'library', 'unknown']),
  isLibrary: z.boolean(),
  ...wrapperRelationShape,
})

export const renderCauseEventSummarySchema = z.object({
  renderEventId: z.string(),
  observationId: z
    .string()
    .nullable()
    .optional()
    .describe("Present only when it differs from the report's observation."),
  documentCommitId: z.number().int().nonnegative(),
  componentId: z.number().int(),
  componentName: z.string(),
  mountId: z.string(),
  key: z.string().optional(),
  causes: z.array(compactCauseSchema),
  necessity: renderNecessitySchema,
  necessityReason: necessityReasonSchema,
  inputEvidence: renderAssessmentSchema.shape.inputEvidence,
  inputCoverage: compactInputCoverageSchema.optional(),
  ...wrapperRelationShape,
  source: compactSourceSchema,
})

const renderCauseReportBaseSchema = z.object({
  componentMatch: componentMatchSchema.optional(),
  tracking: z.boolean(),
  commits: z.number().int().nonnegative(),
  documentCommitId: z.number().int().nonnegative(),
  observation: observationSchema.nullable(),
  attribution: reportAttributionSchema,
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
})

export const reactRenderCausesContract = defineAgentToolContract({
  name: 'react_render_causes',
  title: 'Recent render evidence',
  description:
    'Report bounded render events with observation, document commit, render, component, and mount IDs plus exact, inferred, or unknown React input evidence. Start with react_clear_renders, drive one interaction, then filter by commit or component. IDs join only observed events; timing alone is never treated as causality. The default summary view names each cause; view:"full" adds input values, diffs, notification details, behavior assessment and detailed source attribution.',
  group: 'react.render',
  input: z
    .object({
      commit: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe('Only events from this documentCommitId, as shown on every event.'),
      afterCommit: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe('Only events with a documentCommitId greater than this.'),
      ...componentSelectorInputShape,
      limit: z.number().int().min(1).max(500).default(100),
      appOnly: z
        .boolean()
        .default(true)
        .describe(
          'Hide events with only library source evidence. An exact app hook callsite keeps a framework-wrapped event visible.',
        ),
      view: outputViewSchema('every event field, including input values and diffs'),
    })
    .refine((input) => input.commit === undefined || input.afterCommit === undefined, {
      message: 'commit and afterCommit are mutually exclusive',
    }),
  output: z.discriminatedUnion('view', [
    renderCauseReportBaseSchema.extend({
      view: z.literal('summary'),
      events: z.array(renderCauseEventSummarySchema),
    }),
    renderCauseReportBaseSchema.extend({
      view: z.literal('full'),
      events: z.array(renderCauseEventSchema),
    }),
  ]),
  annotations: { readOnlyHint: true },
})

const cohortReportSchema = z.object({
  attribution: reportAttributionSchema,
  documentCommitId: z.number().int().nonnegative(),
  ownershipCoverage: ownershipCoverageSchema,
  observation: observationSchema.nullable(),
  query: z.object({ component: z.string(), exact: z.boolean() }),
  componentMatch: componentMatchSchema,
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
  rendererBundle: renderMeasurementEnvironmentSchema.shape.bundle
    .nullable()
    .describe(
      'Bundle types of the React renderers hosting the mounted matches, so a framework overlay running production React does not speak for app components; null when none is mounted. Genie never analyzes a production renderer, so an instance it hosts has no render evidence.',
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
    pausedCommits: z.number().int().nonnegative(),
    truncatedInputFibers: z.number().int().nonnegative(),
    propsNotEnumeratedFibers: z.number().int().nonnegative(),
    budgetExhaustedCommits: z.number().int().nonnegative(),
    budgetExhaustedSubsystems: z.array(
      z.object({ subsystem: z.string(), commits: z.number().int().positive() }),
    ),
    generationHistoryEvictions: z.number().int().nonnegative(),
  }),
})

const cohortInstanceSchema = z.object({
  componentName: z.string(),
  sourceOwnership: z.enum(['app', 'library', 'unknown']),
  source: sourceSchema,
  sourceProvenance: sourceProvenanceSchema,
  renderingState: z
    .enum(['mounted-rendering', 'mounted-frozen', 'mounted-hidden', 'mounted-unknown', 'unmounted'])
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
})

const cohortSharedSchema = z
  .object({
    componentName: z.string().optional(),
    sourceOwnership: z.enum(['app', 'library', 'unknown']).optional(),
    source: z
      .string()
      .nullable()
      .optional()
      .describe('file:line:column of the usage or definition.'),
    parent: instanceDescriptorSchema.shape.parent.optional(),
    keyedParent: instanceDescriptorSchema.shape.keyedParent.optional(),
    logicalPathPrefix: z
      .string()
      .describe('The parent path most instances sit under; each row lists the rest of its path.'),
    logicalIdentityEvidence: instanceDescriptorSchema.shape.logicalIdentityEvidence.optional(),
    mountGenerationEvidence: instanceDescriptorSchema.shape.mountGenerationEvidence.optional(),
    renderingState: cohortInstanceSchema.shape.renderingState.optional(),
    reactVisibility: cohortInstanceSchema.shape.reactVisibility.optional(),
  })
  .describe(
    'The value most returned instances share, stated once; a row lists a field only where its value differs.',
  )

const cohortSummaryShape = {
  shared: cohortSharedSchema,
  instances: z.array(
    z.object({
      status: cohortInstanceSchema.shape.status,
      mountId: z.string(),
      fiberId: z.number().int(),
      key: z.string().nullable().optional(),
      siblingIndex: z.number().int().nonnegative().nullable().optional(),
      logicalPath: z
        .string()
        .describe('The path after shared.logicalPathPrefix, or the whole path when outsidePrefix.'),
      outsidePrefix: z.literal(true).optional(),
      mountGeneration: z.number().int().positive(),
      hostSelector: z.string().nullable(),
      documentCommitId: z.number().int().nonnegative().optional(),
      componentName: z.string().optional(),
      sourceOwnership: z.enum(['app', 'library', 'unknown']).optional(),
      source: z.string().nullable().optional(),
      parent: instanceDescriptorSchema.shape.parent.optional(),
      renderingState: cohortInstanceSchema.shape.renderingState.optional(),
      reactVisibility: cohortInstanceSchema.shape.reactVisibility.optional(),
    }),
  ),
}

export const reactComponentCohortContract = defineAgentToolContract({
  name: 'react_component_cohort',
  title: 'Component lifecycle cohort',
  description:
    'Distinguish matching component instances that updated, stayed mounted and idle, unmounted, are absent, or were omitted by a limit. Start with react_clear_renders, drive one interaction, then query an exact display name. Each row includes key/position strength, mount generation, and React Offscreen visibility independently of lifecycle. Hidden does not establish the cause of freezing or whether effects remain subscribed. The default summary view states fields every instance shares once under shared; view:"full" repeats them per instance with source provenance.',
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
    view: outputViewSchema(
      'every instance with its full descriptor, logicalPath and source provenance',
    ),
  }),
  output: z.discriminatedUnion('view', [
    cohortReportSchema.extend({ view: z.literal('summary'), ...cohortSummaryShape }),
    cohortReportSchema.extend({ view: z.literal('full'), instances: cohortInstanceSchema.array() }),
  ]),
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
    strictMode: strictModeStatusSchema,
    deprecations: deprecationsSchema,
  }),
  annotations: { idempotentHint: false },
})

const measurementSpanSchema = z.object({
  handle: z.string(),
  label: z.string(),
  ownership: z.literal('newest-open-span'),
  attribution: z.literal('temporal-only'),
  startedAfterDocumentCommitId: z.number().int().nonnegative(),
  endedAtDocumentCommitId: z.number().int().nonnegative().nullable(),
  expiresAt: z.number(),
})

export const reactMeasureContract = defineAgentToolContract({
  name: 'react_measure',
  title: 'Open labelled measurement',
  group: 'react.render',
  description:
    'Open a labelled span without clearing global renders. The newest open span exclusively owns subsequent commits; older spans resume when it closes. Temporal capture does not establish interaction causality. Up to 20 spans, 500 components and 1000 commits each; handles expire after five minutes or reload.',
  input: z.object({ label: z.string().trim().min(1).max(160) }),
  output: measurementSpanSchema,
})

export const reactRendersSinceContract = defineAgentToolContract({
  name: 'react_renders_since',
  title: 'Read labelled measurement',
  group: 'react.render',
  description:
    'Read commits owned by a measurement handle after it opened. Set close:true to stop capture and resume the previous open span. Reports disjoint commit IDs, label, excluded commits, and coverage. Global clear does not erase spans. A report is frozen at call entry.',
  input: z.object({
    handle: z.string().min(1).max(100),
    close: z.boolean().default(false),
    ...componentSelectorInputShape,
    appOnly: z
      .boolean()
      .default(true)
      .describe(
        'Only source-proven app components; unknown ownership is excluded and coverage becomes incomplete.',
      ),
    limit: z.number().int().min(1).max(200).default(40),
  }),
  output: measurementSpanSchema.extend({
    ...renderMeasurementEnvironmentSchema.shape,
    componentMatch: componentMatchSchema.optional(),
    commitIds: z.array(z.number().int().nonnegative()),
    commits: z.number().int().nonnegative(),
    excludedCommits: z.number().int().nonnegative(),
    summary: renderSummarySchema,
    components: z.array(renderComponentSchema),
    sourceClassification: renderSourceClassificationSchema,
    libraryHidden: z.number().int().nonnegative(),
    omittedByLimit: z.number().int().nonnegative(),
    coverage: z.object({ complete: z.boolean(), semantics: z.enum(['exact', 'lower-bound']) }),
    limitation: z.string(),
  }),
})
