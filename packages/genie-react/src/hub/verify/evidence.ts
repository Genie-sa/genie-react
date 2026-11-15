import { z } from 'zod'
import type { VerifyTarget } from '../../protocol'

/** A tool result as the verification retained it; `status` is not `ok` when the app lacks the tool or the call failed. */
export interface RetainedTool {
  status: 'ok' | 'unavailable' | 'error'
  tool: string
  args: unknown
  capturedAt: string
  durationMs: number
  result?: unknown
  error?: string
}

const nullableNumber = z.number().nullable().catch(null)

const sourceSchema = z
  .object({
    file: z.string(),
    line: nullableNumber,
    column: nullableNumber,
    role: z.string().optional(),
  })
  .nullable()
  .catch(null)

const provenanceSchema = z
  .object({ definitionSource: sourceSchema })
  .partial()
  .nullable()
  .catch(null)

const instanceSchema = z.object({
  mountId: z.string(),
  key: z.string().nullable(),
  logicalPath: z.string(),
  mountGeneration: z.number().int(),
  mountGenerationEvidence: z.enum(['exact', 'inferred', 'unknown']),
})

const observationRef = z.object({ id: z.string() }).nullable().catch(null)

const budgetAdviceSchema = z.object({
  exhaustedLimits: z.array(z.string()),
  suggestedBudget: z.record(z.string(), z.number()),
})

const coverageSnapshotSchema = z.object({
  complete: z.boolean(),
  semantics: z.enum(['exact', 'lower-bound']),
  skippedCommitFibers: z.number(),
  droppedUnmountFibers: z.number(),
  analysisFailedFibers: z.number(),
  pausedCommits: z.number().default(0),
  budgetExhaustedCommits: z.number(),
  budgetAdvice: budgetAdviceSchema.optional(),
  targeted: z.object({ complete: z.boolean(), skippedFibers: z.number() }).optional(),
  truncatedEffectLists: z.number().default(0),
})

const freezeSchema = z.object({
  tracking: z.literal(false),
  documentCommitId: z.number().int().nonnegative(),
  observation: observationRef,
  coverage: coverageSnapshotSchema,
})

const bundleSchema = z.enum(['development', 'production', 'mixed', 'unknown'])

const renderProbeSchema = z.object({
  tracking: z.boolean(),
  renderCollection: z.string(),
  bundle: bundleSchema.catch('unknown'),
  documentCommitId: z.number().int().nonnegative(),
  observation: observationRef,
})

const renderComponentSchema = z.object({
  id: z.number(),
  name: z.string(),
  instance: instanceSchema,
  renders: z.number(),
  mounts: z.number(),
  updates: z.number(),
  unmounted: z.boolean().catch(false),
  latestDocumentCommitId: z.number(),
  source: sourceSchema,
  sourceProvenance: provenanceSchema,
})

const renderReportSchema = renderProbeSchema.extend({
  attribution: z.object({ status: z.enum(['current', 'stale']) }),
  omittedByLimit: z.number(),
  components: z.array(renderComponentSchema),
})

const causeSchema = z.object({
  kind: z.string(),
  evidence: z.enum(['exact', 'inferred', 'unknown']),
  name: z.string().optional(),
  reason: z.string().optional(),
  queryHash: z.string().optional(),
  notificationId: z.string().nullable().optional(),
})

const renderEventSchema = z.object({
  renderEventId: z.string(),
  observationId: z.string().nullable(),
  documentCommitId: z.number(),
  componentName: z.string(),
  instance: instanceSchema,
  causes: z.array(causeSchema),
  inputCoverage: z.object({ complete: z.boolean() }),
})

const renderCausesSchema = z.object({
  observation: observationRef,
  attribution: z.object({ status: z.enum(['current', 'stale']) }),
  omittedByLimit: z.number(),
  coverage: z.object({ droppedRenderEvents: z.number() }),
  renderEventRetention: z.object({
    evictedEvents: z.number(),
    earliestDocumentCommitId: z.number().nullable(),
  }),
  events: z.array(renderEventSchema),
})

const executionSchema = z.union([
  z.object({
    status: z.literal('observed'),
    trigger: z.enum(['commit', 'strict-mode-replay', 'reconnect']).catch('commit'),
  }),
  z.object({
    status: z.literal('unobserved'),
    reason: z.enum(['not-yet-observed', 'unsupported-effect-kind', 'instrumentation-unavailable']),
  }),
])

const effectEventSchema = z.object({
  effectEventId: z.string(),
  observationId: z.string().nullable(),
  documentCommitId: z.number(),
  componentName: z.string(),
  mountId: z.string(),
  effectIndex: z.number().int(),
  kind: z.enum(['effect', 'layout', 'insertion']),
  execution: executionSchema,
})

const effectTimelineSchema = z.object({
  observation: observationRef,
  events: z.array(effectEventSchema),
  omittedByLimit: z.number(),
  evictedEvents: z.number(),
  refreshCommitsExcluded: z.number().default(0),
})

const effectAuditSchema = z.object({
  components: z.array(
    z.object({
      name: z.string(),
      effects: z.array(z.object({ index: z.number().int() })),
    }),
  ),
  omittedByLimit: z.number(),
})

const cohortSchema = z.object({
  observation: observationRef,
  omittedByLimit: z.number(),
  rendererBundle: bundleSchema.nullable().catch('unknown'),
  instances: z.array(
    z.object({
      componentName: z.string(),
      renderingState: z.enum([
        'mounted-rendering',
        'mounted-frozen',
        'mounted-hidden',
        'mounted-unknown',
        'unmounted',
      ]),
      source: sourceSchema,
      sourceProvenance: provenanceSchema,
      instance: instanceSchema,
    }),
  ),
})

const errorStateSchema = z.object({
  scanTruncated: z.boolean(),
  caughtErrors: z.array(
    z.object({
      boundaryName: z.string(),
      boundaryKind: z.enum(['error-boundary', 'root']).catch('error-boundary'),
      message: z.string().nullable(),
      forced: z.boolean(),
      status: z.enum(['active', 'unknown']).catch('unknown'),
    }),
  ),
  catchLog: z
    .object({
      catches: z.array(
        z.object({
          catchId: z.string(),
          documentCommitId: z.number(),
          boundaryName: z.string(),
          boundaryKind: z.enum(['error-boundary', 'root']),
          forced: z.boolean(),
          message: z.string().nullable(),
          throwingComponent: z.string().nullable(),
        }),
      ),
      omittedByLimit: z.number(),
      complete: z.boolean(),
      incompleteReasons: z.array(z.string()),
    })
    .optional(),
})

const overridesSchema = z.object({
  overrides: z.array(z.object({ kind: z.string(), componentName: z.string() })),
  total: z.number(),
})

const queryFetchingSchema = z.object({
  simulatedQueries: z.array(z.object({ queryHash: z.string(), simulatedState: z.string() })),
})

const refreshEventsSchema = z.object({ latestSequence: z.number().int() })

const visibilitySchema = z.object({
  source: z.enum(['document', 'app-state', 'unavailable']),
  state: z.enum(['visible', 'hidden', 'unknown']),
  hiddenTransitions: z.number().int().nonnegative(),
})

const clearSchema = z.object({
  documentCommitId: z.number().int().nonnegative(),
  observation: z.object({ id: z.string() }),
  strictMode: z.enum(['on', 'off', 'partial', 'unknown']).catch('unknown'),
})

export type CoverageSnapshot = z.infer<typeof coverageSnapshotSchema>
export type RendererBundle = z.infer<typeof bundleSchema>
export type RenderProbe = z.infer<typeof renderProbeSchema>
export type VisibilityRead = z.infer<typeof visibilitySchema>
export type ClearRead = z.infer<typeof clearSchema>

/** Parses one retained result against the fields the verdict relies on; `null` means the evidence is missing or malformed. */
function parsed<T>(schema: z.ZodType<T>, tool: RetainedTool | undefined): T | null {
  if (tool?.status !== 'ok') return null
  const result = schema.safeParse(tool.result)
  return result.success ? result.data : null
}

export const readFreeze = (tool?: RetainedTool) => parsed(freezeSchema, tool)
export const readRenderProbe = (tool?: RetainedTool) => parsed(renderProbeSchema, tool)
export function readClear(result: unknown): ClearRead | null {
  const parsedResult = clearSchema.safeParse(result)
  return parsedResult.success ? parsedResult.data : null
}
export const readOverrides = (tool?: RetainedTool) => parsed(overridesSchema, tool)
export const readSimulatedQueries = (tool?: RetainedTool) => parsed(queryFetchingSchema, tool)
export const readRefreshSequence = (tool?: RetainedTool) =>
  parsed(refreshEventsSchema, tool)?.latestSequence ?? null
export const readVisibility = (tool?: RetainedTool) => parsed(visibilitySchema, tool)

/** The definition file when known, so two usages of one component in different parents stay one target. */
function sourceKey(
  source: z.infer<typeof sourceSchema>,
  provenance: z.infer<typeof provenanceSchema>,
): { file: string | null; location: string | null } {
  const definition = provenance?.definitionSource ?? null
  const chosen =
    definition ?? (source && source.role !== 'element-callsite' ? source : null) ?? source
  if (!chosen) return { file: null, location: null }
  const position = [chosen.line, chosen.column].filter((part) => part !== null).join(':')
  return { file: chosen.file, location: position ? `${chosen.file}:${position}` : chosen.file }
}

export interface InstanceRecord {
  mountId: string
  key: string | null
  logicalPath: string
  mountGeneration: number
  mountGenerationEvidence: 'exact' | 'inferred' | 'unknown'
  renders: number
  mounts: number
  updates: number
  unmounted: boolean
  latestDocumentCommitId: number
  sourceFile: string | null
  sourceLocation: string | null
}

export interface RendersRead {
  records: InstanceRecord[]
  omittedByLimit: number
  attributionStale: boolean
  observationId: string | null
}

export function readRenders(tool: RetainedTool | undefined, component: string): RendersRead | null {
  const report = parsed(renderReportSchema, tool)
  if (!report) return null
  return {
    records: report.components
      .filter((entry) => entry.name === component)
      .map((entry) => ({
        mountId: entry.instance.mountId,
        key: entry.instance.key,
        logicalPath: entry.instance.logicalPath,
        mountGeneration: entry.instance.mountGeneration,
        mountGenerationEvidence: entry.instance.mountGenerationEvidence,
        renders: entry.renders,
        mounts: entry.mounts,
        updates: entry.updates,
        unmounted: entry.unmounted,
        latestDocumentCommitId: entry.latestDocumentCommitId,
        ...sourceFields(entry.source, entry.sourceProvenance),
      })),
    omittedByLimit: report.omittedByLimit,
    attributionStale: report.attribution.status === 'stale',
    observationId: report.observation?.id ?? null,
  }
}

function sourceFields(
  source: z.infer<typeof sourceSchema>,
  provenance: z.infer<typeof provenanceSchema>,
): { sourceFile: string | null; sourceLocation: string | null } {
  const { file, location } = sourceKey(source, provenance)
  return { sourceFile: file, sourceLocation: location }
}

export interface CohortRecord {
  mountId: string
  key: string | null
  renderingState: z.infer<typeof cohortSchema>['instances'][number]['renderingState']
  sourceFile: string | null
  sourceLocation: string | null
}

export interface CohortRead {
  instances: CohortRecord[]
  omittedByLimit: number
  observationId: string | null
  /** The build of the renderers hosting the mounted instances; null when none is mounted. */
  rendererBundle: RendererBundle | null
}

export function readCohort(tool: RetainedTool | undefined, component: string): CohortRead | null {
  const cohort = parsed(cohortSchema, tool)
  if (!cohort) return null
  return {
    instances: cohort.instances
      .filter((entry) => entry.componentName === component)
      .map((entry) => ({
        mountId: entry.instance.mountId,
        key: entry.instance.key,
        renderingState: entry.renderingState,
        ...sourceFields(entry.source, entry.sourceProvenance),
      })),
    omittedByLimit: cohort.omittedByLimit,
    observationId: cohort.observation?.id ?? null,
    rendererBundle: cohort.rendererBundle,
  }
}

export interface RenderCause {
  kind: string
  evidence: 'exact' | 'inferred' | 'unknown'
  name: string | null
  reason: string | null
}

export interface RenderEventRecord {
  renderEventId: string
  documentCommitId: number
  mountId: string
  causes: RenderCause[]
  inputCoverageComplete: boolean
}

export interface RenderEventsRead {
  events: RenderEventRecord[]
  omittedByLimit: number
  droppedRenderEvents: number
  earliestRetainedDocumentCommitId: number | null
  attributionStale: boolean
  foreignObservationEvents: number
  observationId: string | null
}

export function readRenderEvents(
  tool: RetainedTool | undefined,
  component: string,
  window: { observationId: string; afterDocumentCommitId: number; throughDocumentCommitId: number },
): RenderEventsRead | null {
  const report = parsed(renderCausesSchema, tool)
  if (!report) return null
  const named = report.events.filter(
    (event) =>
      event.componentName === component &&
      event.documentCommitId > window.afterDocumentCommitId &&
      event.documentCommitId <= window.throughDocumentCommitId,
  )
  return {
    events: named
      .filter((event) => event.observationId === window.observationId)
      .map((event) => ({
        renderEventId: event.renderEventId,
        documentCommitId: event.documentCommitId,
        mountId: event.instance.mountId,
        causes: event.causes.map((cause) => ({
          kind: cause.kind,
          evidence: cause.evidence,
          name: (cause.kind === 'query' ? cause.queryHash : cause.name) ?? null,
          reason: cause.reason ?? null,
        })),
        inputCoverageComplete: event.inputCoverage.complete,
      })),
    omittedByLimit: report.omittedByLimit,
    droppedRenderEvents: Math.max(
      report.coverage.droppedRenderEvents,
      report.renderEventRetention.evictedEvents,
    ),
    earliestRetainedDocumentCommitId: report.renderEventRetention.earliestDocumentCommitId,
    attributionStale: report.attribution.status === 'stale',
    foreignObservationEvents: named.filter((event) => event.observationId !== window.observationId)
      .length,
    observationId: report.observation?.id ?? null,
  }
}

export interface EffectEventRecord {
  effectEventId: string
  documentCommitId: number
  mountId: string
  effectIndex: number
  kind: 'effect' | 'layout' | 'insertion'
  execution: z.infer<typeof executionSchema>
}

export interface EffectsRead {
  events: EffectEventRecord[]
  omittedByLimit: number
  evictedEvents: number
  refreshCommitsExcluded: number
  observationId: string | null
  /** Effect hook positions the component declares, from the audit; null when the audit could not be read. */
  declaredEffectIndexes: number[] | null
}

export function readEffects(
  timeline: RetainedTool | undefined,
  audit: RetainedTool | undefined,
  component: string,
  window: { afterDocumentCommitId: number; throughDocumentCommitId: number },
): EffectsRead | null {
  const report = parsed(effectTimelineSchema, timeline)
  if (!report) return null
  const declared = parsed(effectAuditSchema, audit)
  return {
    events: report.events
      .filter(
        (event) =>
          event.componentName === component &&
          event.documentCommitId > window.afterDocumentCommitId &&
          event.documentCommitId <= window.throughDocumentCommitId,
      )
      .map(({ observationId: _, componentName: __, ...event }) => event),
    omittedByLimit: report.omittedByLimit,
    evictedEvents: report.evictedEvents,
    refreshCommitsExcluded: report.refreshCommitsExcluded,
    observationId: report.observation?.id ?? null,
    declaredEffectIndexes:
      declared && declared.omittedByLimit === 0
        ? [
            ...new Set(
              declared.components
                .filter((entry) => entry.name === component)
                .flatMap((entry) => entry.effects.map((effect) => effect.index)),
            ),
          ]
        : null,
  }
}

export interface BoundaryRead {
  catches: NonNullable<z.infer<typeof errorStateSchema>['catchLog']>['catches']
  catchLog: { complete: boolean; incompleteReasons: string[]; omittedByLimit: number } | null
  atEnd: z.infer<typeof errorStateSchema>['caughtErrors']
  scanTruncated: boolean
}

export function readBoundaries(
  tool: RetainedTool | undefined,
  throughDocumentCommitId: number,
): BoundaryRead | null {
  const state = parsed(errorStateSchema, tool)
  if (!state) return null
  return {
    catches: (state.catchLog?.catches ?? []).filter(
      (entry) => entry.documentCommitId <= throughDocumentCommitId,
    ),
    catchLog: state.catchLog
      ? {
          complete: state.catchLog.complete,
          incompleteReasons: state.catchLog.incompleteReasons,
          omittedByLimit: state.catchLog.omittedByLimit,
        }
      : null,
    atEnd: state.caughtErrors,
    scanTruncated: state.scanTruncated,
  }
}

/** How a target resolved at `begin`: the source file it binds to and the instances mounted then. */
export interface TargetResolution {
  target: VerifyTarget
  status: 'resolved' | 'pending' | 'ambiguous'
  sourceFile: string | null
  candidates: string[]
  unresolvedSources: number
  begin: CohortRead
  /** False when the cohort could not be read at begin, so `begin` holds no instances. */
  listed: boolean
}

export interface TargetEvidence {
  resolution: TargetResolution
  renders: RendersRead | null
  events: RenderEventsRead | null
  effects: EffectsRead | null
  end: CohortRead | null
}

export interface VerificationEvidence {
  window: {
    observationId: string
    startDocumentCommitId: number
    settledDocumentCommitId: number
    frozenDocumentCommitId: number
    settle: {
      outcome: 'met' | 'timed-out' | 'failed'
      reason?: string
      waitedMs: number
      quietMs: number
      timeoutMs: number
    }
    tailMs: number
    strictMode: ClearRead['strictMode']
  }
  coverage: CoverageSnapshot | null
  targets: ReadonlyMap<string, TargetEvidence>
  boundaries: BoundaryRead | null
}
