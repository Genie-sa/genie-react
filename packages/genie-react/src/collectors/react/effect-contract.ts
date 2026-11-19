import { z } from 'zod'
import { defineAgentToolContract } from '../../protocol'
import { componentMatchSchema, componentSelectorInputShape } from './component-name'
import {
  appOnlySchema,
  ownershipBasisSchema,
  ownershipCoverageSchema,
  sourceSchema,
} from './contract-schemas'
import { observationSchema } from './render-contract'

const effectOwnershipSchema = z.enum(['app', 'library', 'unknown'])

export const effectProvenanceReasonSchema = z
  .enum([
    'exact-hook-order',
    'called-by-library-hook',
    'library-component',
    'hook-count-mismatch',
    'hook-source-unresolved',
    'hook-inspection-unavailable',
    'attribution-budget-exhausted',
    'report-state-advanced',
  ])
  .describe(
    'exact-hook-order: the declaring hook call was located, and ownership follows its file. called-by-library-hook: the call could not be located, but library code called the custom hook around it. library-component: neither could be located and the component itself is library code. The rest leave ownership unknown.',
  )
const provenanceEvidenceSchema = z.enum(['exact', 'inferred', 'unknown'])

const effectCoverageSchema = z.object({
  complete: z.boolean().describe('Completeness of effect schedule capture.'),
  inputAttributionComplete: z.boolean(),
  skippedCommitFibers: z.number().int().nonnegative(),
  droppedUnmountFibers: z.number().int().nonnegative(),
  analysisFailedFibers: z.number().int().nonnegative(),
  pausedCommits: z.number().int().nonnegative(),
  unobservedCommits: z
    .number()
    .int()
    .nonnegative()
    .default(0)
    .describe(
      'Commits made while no render window, profile, measurement or timeline was open; their effects were not recorded.',
    ),
  refreshCommitsExcluded: z
    .number()
    .int()
    .nonnegative()
    .default(0)
    .describe(
      'Fast Refresh commits, or commits indistinguishable from one, that the window did not analyse; their effects were not recorded.',
    ),
  truncatedInputFibers: z.number().int().nonnegative(),
  propsNotEnumeratedFibers: z.number().int().nonnegative(),
  truncatedEffectLists: z.number().int().nonnegative(),
  budgetExhaustedCommits: z.number().int().nonnegative(),
  budgetExhaustedSubsystems: z.array(
    z.object({ subsystem: z.string(), commits: z.number().int().positive() }),
  ),
})

const effectHotnessSchema = z.object({
  label: z
    .enum(['hot', 'not-hot', 'insufficient-data'])
    .describe(
      'hot: the effect runs more often than its inputs justify. With dependencies, that means it re-ran at least minUpdates times while every dependency that changed identity kept equal contents; without a dependency array, that it was scheduled at minScheduleRate or more. insufficient-data covers too few updates and re-runs whose changed dependencies could not be compared (functions, class instances).',
    ),
  basis: z
    .enum([
      'reference-only-reruns',
      'no-dependency-array',
      'value-change-reruns',
      'dependency-values-not-compared',
      'not-rescheduled',
      'below-schedule-rate',
      'below-minimum-updates',
    ])
    .describe('Why the label holds.'),
  reruns: z
    .object({
      valueChanged: z.number().int().nonnegative(),
      referenceOnly: z.number().int().nonnegative(),
      undetermined: z.number().int().nonnegative(),
    })
    .describe(
      'Update re-runs by what their changed dependencies did: a dependency changed value; only identities changed with equal contents; or the contents could not be compared.',
    ),
  samples: z.number().int().nonnegative(),
  observedRate: z.number().min(0).max(1),
  minUpdates: z.number().int().positive(),
  minScheduleRate: z.number().min(0).max(1),
  minFireRate: z.number().min(0).max(1).describe('Legacy alias for minScheduleRate.'),
  confidenceInterval: z.object({
    level: z.number().min(0).max(1),
    lower: z.number().min(0).max(1),
    upper: z.number().min(0).max(1),
  }),
  scheduleReason: z
    .enum(['meets-threshold', 'below-schedule-rate', 'below-minimum-updates'])
    .describe(
      'The scheduled/updates rate against minScheduleRate, as a raw fact. It decides the label only for an effect without a dependency array, so a hot effect with dependencies can be below-schedule-rate; basis says why the label holds.',
    ),
  reason: z
    .enum(['meets-threshold', 'below-fire-rate', 'below-minimum-updates'])
    .describe(
      'Legacy alias for scheduleReason, so it does not decide the label either; below-fire-rate means below schedule rate and does not prove execution.',
    ),
})

export const effectHookIndexSchema = z
  .number()
  .int()
  .nonnegative()
  .describe(
    'Flat hook index, the same index react_inspect_component reports in hooks[].index, so one effect is addressed the same way in every tool.',
  )

export const effectCustomHooksSchema = z
  .array(z.string())
  .nullable()
  .describe(
    'Custom hooks around the call that declared this effect, outermost first, as in react_inspect_component; [] when the component called it directly; null when the hook inspector could not attribute it.',
  )

const effectFindingSchema = z.object({
  index: z
    .number()
    .describe(
      'Position among the component’s effect hooks (useEffect, useLayoutEffect, useInsertionEffect, useImperativeHandle, and hooks built on them) in call order. Effects React pushes without a hook, such as useSyncExternalStore’s snapshot check, are not reported.',
    ),
  hookIndex: effectHookIndexSchema,
  hook: z
    .string()
    .nullable()
    .describe('The React hook that created this effect, e.g. useEffect or useSyncExternalStore.'),
  customHooks: effectCustomHooksSchema,
  kind: z.enum(['effect', 'layout', 'insertion']),
  depsMode: z
    .enum(['none', 'empty', 'list'])
    .describe(
      'none = no deps array (scheduled after every render); empty = [] (mount only); list = [deps].',
    ),
  depCount: z.number(),
  scheduled: z.number().describe('Update commits in which React scheduled this effect.'),
  updates: z.number().describe('Update commits observed for the component.'),
  schedulesEveryUpdate: z
    .boolean()
    .describe('Raw schedule fact; use hotness.label before treating a small sample as actionable.'),
  fired: z
    .number()
    .describe('Legacy alias for scheduled. This does not prove that the effect executed.'),
  firesEveryUpdate: z
    .boolean()
    .describe('Legacy alias for schedulesEveryUpdate. This does not prove execution.'),
  lastChangedDep: z
    .number()
    .nullable()
    .describe('Index of the dependency that changed for the most recent schedule.'),
  cleanupFunctionObserved: z
    .boolean()
    .describe(
      'Whether React stored a cleanup function at least once; this does not prove current cleanup state or execution timing.',
    ),
  hasCleanup: z.boolean().describe('Legacy alias for cleanupFunctionObserved.'),
  note: z
    .string()
    .optional()
    .describe('A concrete fix when the effect looks like a re-run/loop smell.'),
  source: sourceSchema.describe(
    "Where this effect is declared: the hook call that created it, from React DevTools' hook inspector. Null when it cannot be attributed; provenance.reason says why.",
  ),
  isLibrary: z
    .boolean()
    .describe(
      'Compatibility boolean derived from provenance.ownership === "library"; use provenance to preserve unknown ownership.',
    ),
  provenance: z.object({
    ownership: effectOwnershipSchema,
    evidence: provenanceEvidenceSchema,
    reason: effectProvenanceReasonSchema,
    hookSource: sourceSchema.describe('Effect implementation callsite, separate from its owner.'),
    packageName: z
      .string()
      .nullable()
      .describe('Owning npm package when one can be recovered from a library source path.'),
    hookAncestry: z
      .array(
        z.object({
          name: z.string(),
          source: sourceSchema,
          ownership: effectOwnershipSchema,
          packageName: z.string().nullable(),
        }),
      )
      .max(12)
      .describe(
        'Custom hooks above this effect, outermost first, each with the place it was called and its ownership.',
      ),
    definitionSource: z.null().describe('Reserved for exact effect definition evidence.'),
    allocationCallsite: z.null().describe('Effects do not expose allocation callsites.'),
    hookDefinitionOwner: sourceSchema,
    hookCallsite: sourceSchema,
    package: z.string().nullable().describe('Alias of the owning package for split provenance.'),
    sourceMapConfidence: z.enum(['mapped', 'served', 'unknown']),
    failureReason: z.enum(['hook-provenance-unavailable']).nullable(),
  }),
  hotness: effectHotnessSchema.describe(
    'Thresholded classification plus a 95% Wilson interval for the observed schedule rate.',
  ),
})

export const reactEffectAuditContract = defineAgentToolContract({
  name: 'react_effect_audit',
  title: 'Effect schedule audit',
  description:
    'Audit useEffect, useLayoutEffect, and useInsertionEffect schedules: commit counts, dependency mode/change, cleanup presence, hotness (does the effect run more often than its dependencies justify?), and who declared each effect. Each effect carries the hookIndex and customHooks react_inspect_component reports, and its declaration from the same hook inspector React DevTools runs when you select a component, so an effect inside a library hook is library-owned even in an app component. React commit flags do not prove passive execution or cleanup timing. Start with react_clear_renders, drive the interaction, then read this.',
  group: 'react.render',
  input: z
    .object({
      ...componentSelectorInputShape,
      onlyHot: z
        .boolean()
        .default(false)
        .describe('Return only effects whose thresholded hotness label is "hot".'),
      appOnly: z
        .boolean()
        .default(true)
        .describe(
          'Hide effects declared in library code, including library hooks called from your components. Effects whose declaration is unresolved stay, with provenance.ownership "unknown"; filteredNote counts what was hidden. Set false to include library effects.',
        ),
      packageName: z
        .string()
        .trim()
        .min(1)
        .max(214)
        .optional()
        .describe(
          'Only effects attributed to this exact npm package, e.g. "@tanstack/react-query". Requires appOnly:false.',
        ),
      minUpdates: z
        .number()
        .int()
        .min(1)
        .max(1_000)
        .default(3)
        .describe(
          'Minimum observed updates before an effect can be classified hot, and the number of re-runs without a dependency value change that makes it hot.',
        ),
      minFireRate: z
        .number()
        .min(0.1)
        .max(1)
        .default(1)
        .describe('Legacy name for minScheduleRate.'),
      minScheduleRate: z
        .number()
        .min(0.1)
        .max(1)
        .optional()
        .describe(
          'Preferred minimum scheduled/updates ratio for classifying an effect without a dependency array as hot.',
        ),
      limit: z.number().int().min(1).max(200).default(40),
    })
    .superRefine((input, context) => {
      if (input.packageName !== undefined && input.appOnly) {
        context.addIssue({
          code: 'custom',
          path: ['appOnly'],
          message: 'set appOnly:false when filtering by packageName',
        })
      }
    }),
  output: z.object({
    componentMatch: componentMatchSchema.optional(),
    tracking: z.boolean(),
    commits: z.number(),
    documentCommitId: z.number().int().nonnegative(),
    attribution: z.object({
      status: z.enum(['current', 'stale']),
      startedAtDocumentCommitId: z.number().int().nonnegative(),
      completedAtDocumentCommitId: z.number().int().nonnegative(),
      startedAtAnalysisGeneration: z.number().int().nonnegative(),
      completedAtAnalysisGeneration: z.number().int().nonnegative(),
    }),
    hotnessCriteria: z.object({
      minUpdates: z.number().int().positive(),
      minScheduleRate: z.number().min(0).max(1),
      minFireRate: z.number().min(0).max(1).describe('Legacy alias for minScheduleRate.'),
      confidenceLevel: z.number().min(0).max(1),
    }),
    components: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        source: sourceSchema.describe(
          'Nearest symbolicated fiber source; may be a definition or owner callsite. See componentProvenance.',
        ),
        isLibrary: z.boolean(),
        componentProvenance: z.object({
          ownership: effectOwnershipSchema,
          evidence: z.enum(['inferred', 'unknown']),
          reason: z.enum(['nearest-symbolicated-fiber', 'source-unresolved']),
          basis: ownershipBasisSchema.nullable(),
          source: sourceSchema,
        }),
        effects: z.array(effectFindingSchema),
        effectsOmitted: z.number().int().nonnegative(),
      }),
    ),
    omittedByLimit: z.number().int().nonnegative(),
    effectsOmittedByLimit: z.number().int().nonnegative(),
    coverage: effectCoverageSchema,
    filteredNote: z
      .string()
      .optional()
      .describe(
        'Present when appOnly hid library effects or kept effects of unknown ownership; distinguishes "no effects filtered" from "no effects exist".',
      ),
    packageFilter: z
      .object({
        packageName: z.string(),
        matchedEffects: z.number().int().nonnegative(),
        excludedEffects: z.number().int().nonnegative(),
        unknownPackageEffects: z.number().int().nonnegative(),
      })
      .optional()
      .describe('Explicit accounting for an exact packageName filter.'),
  }),
  annotations: { readOnlyHint: true },
})

const effectEventsInputSchema = z.object({
  appOnly: appOnlySchema,
  ...componentSelectorInputShape,
  afterDocumentCommitId: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(500).default(100),
})

export type EffectEventsInput = z.output<typeof effectEventsInputSchema>

const observedEffectRunSchema = z.object({
  status: z.literal('observed'),
  evidence: z.literal('exact'),
  startedAt: z.number(),
  completedAt: z.number(),
  durationMs: z.number().nonnegative(),
  outcome: z.enum(['completed', 'threw']),
  error: z.string().optional(),
})

const effectRunTriggerSchema = z
  .enum(['commit', 'strict-mode-replay', 'reconnect'])
  .describe(
    'commit = the run React scheduled; strict-mode-replay = StrictMode’s development re-run of a fresh mount, not an app bug; reconnect = a hidden Activity or offscreen subtree was shown again.',
  )

const effectEventSchema = z.object({
  sourceOwnership: effectOwnershipSchema.describe(
    "Ownership of this effect's declaration, the same answer react_effect_audit gives in provenance.ownership: an effect declared inside a library hook is library-owned even in an app component.",
  ),
  ownershipEvidence: provenanceEvidenceSchema,
  ownershipReason: effectProvenanceReasonSchema,
  source: sourceSchema.describe(
    'Where this effect is declared: the hook call that created it (role hook-callsite). Null when it cannot be attributed.',
  ),
  hook: z
    .string()
    .nullable()
    .describe('The React hook that created this effect, e.g. useEffect or useSyncExternalStore.'),
  customHooks: effectCustomHooksSchema,
  componentOwnership: effectOwnershipSchema,
  componentSource: sourceSchema.describe(
    "The component's own location, as react_get_tree reports it.",
  ),
  effectEventId: z.string(),
  effectId: z.string(),
  observationId: z.string().nullable(),
  commitId: z.number().int().nonnegative(),
  documentCommitId: z.number().int().nonnegative(),
  componentId: z.number().int(),
  componentName: z.string(),
  mountId: z.string(),
  effectIndex: z
    .number()
    .int()
    .nonnegative()
    .describe('Position among the component’s effect hooks, as react_effect_audit index.'),
  hookIndex: effectHookIndexSchema,
  kind: z.enum(['effect', 'layout', 'insertion']),
  phase: z.enum(['mount', 'update']),
  event: z
    .enum(['scheduled', 'reconnected'])
    .describe(
      'scheduled = React flagged the effect in this commit; reconnected = React re-ran an unscheduled effect because its hidden subtree became visible.',
    ),
  evidence: z.literal('exact'),
  dependencyComparison: z
    .enum(['compared', 'no-dependency-array', 'previous-unavailable', 'not-applicable'])
    .describe(
      'compared: changedDependencySlots lists every slot React saw change (within the scan limits). previous-unavailable: the previous dependencies could not be read, so an empty list does not mean nothing changed. not-applicable: a mount or reconnect, which React runs without comparing.',
    ),
  changedDependencySlots: z.array(z.number().int().nonnegative()),
  dependencyChanges: z
    .array(
      z.object({
        slot: z.number().int().nonnegative(),
        change: z.enum(['value', 'reference-only', 'undetermined']),
      }),
    )
    .describe(
      'Each changed slot by what changed: value; reference-only (a new identity with equal contents); undetermined (contents not comparable, such as functions or class instances).',
    ),
  changedDependencySlotsOmitted: z.number().int().nonnegative(),
  dependencySlotsUnscanned: z.number().int().nonnegative(),
  execution: z.union([
    observedEffectRunSchema.extend({ trigger: effectRunTriggerSchema }),
    z.object({
      status: z.literal('unobserved'),
      reason: z.enum([
        'not-yet-observed',
        'unsupported-effect-kind',
        'instrumentation-unavailable',
      ]),
    }),
  ]),
  cleanupExecution: z
    .union([
      observedEffectRunSchema.extend({ trigger: z.literal('strict-mode-replay').optional() }),
      z.object({
        status: z.literal('unobserved'),
        reason: z.enum([
          'not-yet-observed',
          'no-cleanup-returned',
          'unsupported-effect-kind',
          'instrumentation-unavailable',
        ]),
      }),
    ])
    .describe(
      'Cleanup of the latest execution. A new execution resets it to not-yet-observed, so an observed cleanup always belongs to the current run.',
    ),
  consequences: z.object({
    status: z.literal('instrumented'),
    observedDomains: z.tuple([
      z.literal('query-notification'),
      z.literal('router-notification'),
      z.literal('react-update'),
      z.literal('react-commit'),
    ]),
    unobservedDomains: z.tuple([
      z.literal('asynchronous-react-update'),
      z.literal('external-store-write'),
      z.literal('network'),
      z.literal('event-listener'),
      z.literal('navigation'),
    ]),
    events: z.array(
      z.union([
        z.object({
          kind: z.literal('notification'),
          domain: z.enum(['query-notification', 'router-notification']),
          notificationId: z.string(),
          timestamp: z.number(),
          evidence: z.literal('exact'),
        }),
        z
          .object({
            kind: z.literal('react-update'),
            stage: z.enum(['execution', 'cleanup']),
            status: z.literal('scheduled'),
            timestamp: z.number(),
            evidence: z.literal('exact'),
          })
          .describe('React work was scheduled synchronously while this run executed.'),
        z
          .object({
            kind: z.literal('react-update'),
            stage: z.enum(['execution', 'cleanup']),
            status: z.literal('undetermined'),
            timestamp: z.number(),
            evidence: z.literal('unknown'),
            reason: z.literal('work-already-pending'),
          })
          .describe(
            'React work was already pending, so an update this run scheduled on the same lane cannot be detected.',
          ),
        z
          .object({
            kind: z.literal('resulting-commit'),
            documentCommitId: z.number().int().nonnegative(),
            timestamp: z.number(),
            evidence: z.literal('inferred'),
            reason: z.enum(['commit-retired-update-lanes', 'committed-during-run']),
          })
          .describe(
            'The commit that retired the lanes this run scheduled. Present only after a scheduled react-update; other updates can share that commit.',
          ),
      ]),
    ),
  }),
  timeline: z.array(
    z.object({
      stage: z.enum(['schedule', 'execution', 'cleanup', 'consequence', 'resulting-commit']),
      timestamp: z.number(),
      evidence: z.enum(['exact', 'inferred']),
      referenceId: z.string().optional(),
      outcome: z.enum(['completed', 'threw']).optional(),
      trigger: effectRunTriggerSchema.optional(),
    }),
  ),
})

const effectEventsOutputSchema = z.object({
  componentMatch: componentMatchSchema.optional(),
  ownershipCoverage: ownershipCoverageSchema,
  tracking: z.boolean(),
  documentCommitId: z.number().int().nonnegative(),
  observation: observationSchema.nullable(),
  events: z.array(effectEventSchema),
  omittedByLimit: z.number().int().nonnegative(),
  libraryEventsHidden: z
    .number()
    .int()
    .nonnegative()
    .describe('Events appOnly hid because their effect is declared in library code.'),
  filteredNote: z
    .string()
    .optional()
    .describe(
      'Present when appOnly hid library effects or kept effects of unknown ownership, so an empty list is never mistaken for "no effects ran".',
    ),
  evictedEvents: z
    .number()
    .int()
    .nonnegative()
    .describe('Schedule events evicted from the retained history.'),
  droppedEvents: z.number().int().nonnegative().describe('Legacy alias for evictedEvents.'),
  refreshCommitsExcluded: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'Fast Refresh commits since the observation started. Genie does not analyse them, so effects they re-ran are missing and coverage.complete is false.',
    ),
  coverage: effectCoverageSchema,
})

export const reactEffectEventsContract = defineAgentToolContract({
  name: 'react_effect_events',
  title: 'Recent effect timeline events',
  description:
    'Alias of react_effect_timeline with identical input and output; prefer react_effect_timeline.',
  group: 'react.render',
  input: effectEventsInputSchema,
  output: effectEventsOutputSchema,
  annotations: { readOnlyHint: true },
})

export const reactEffectTimelineContract = defineAgentToolContract({
  name: 'react_effect_timeline',
  title: 'Effect causal timeline',
  description:
    'Report bounded effect schedules and reconnects joined to exact passive execution and cleanup observations (each run labelled commit, strict-mode-replay, or reconnect), exact Query/Router notification consequences, React updates scheduled synchronously during a run, and the commit that retired them as an explicitly inferred edge. Layout and insertion effects run before Genie sees the commit, so their execution and cleanup stay unobserved. Unsupported or unavailable stages carry a reason; asynchronous updates, external-store writes, network, event-listener, and navigation consequences remain explicitly unobserved.',
  group: 'react.render',
  input: effectEventsInputSchema,
  output: effectEventsOutputSchema,
  annotations: { readOnlyHint: true },
})
