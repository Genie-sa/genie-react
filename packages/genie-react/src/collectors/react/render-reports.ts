import { roundMilliseconds } from '../../protocol'
import { resolveClassUpdateCallers } from './class-updates'
import {
  type ComponentMatch,
  type ComponentNameSelector,
  componentNameMatcher,
  describeComponentMatch,
} from './component-name'
import { wrapperAncestryOf } from './fiber'
import { countExternalStoreHooks, type RenderCauseEvent } from './render-causes'
import {
  hasExactAppExternalStoreCallsite,
  resolveExternalStoreSourcesWithinBudget,
  withReportEvidence,
} from './render-evidence'
import type {
  RenderRecord,
  RenderReport,
  RenderSummary,
  RetainedRenderCauseEvent,
} from './render-model'
import type { ComponentAggregate } from './render-snapshots'
import {
  classifyFibersWithinBudget,
  type ExternalStoreSourceResolution,
  type FiberClassification,
  scheduleClassificationWarmup,
  sourceAttributionForSource,
  sourceLabel,
  sourceProvenanceForSource,
} from './source'

const SOURCE_CLASSIFY_LIMIT = 120
const SOURCE_CLASSIFY_BUDGET_MS = 500
const UNKNOWN_COMPONENT_LIMIT = 50
const UNCLASSIFIED_FIBER: FiberClassification = {
  source: null,
  ownership: 'unknown',
  isLibrary: false,
}

export interface RenderQuery extends ComponentNameSelector {
  nameFilter?: string
  excludeNames?: string[]
  minUpdates?: number
  limit: number
  sort: 'renders' | 'updates' | 'unnecessary' | 'referenceOnly' | 'unstable' | 'selfTime'
  appOnly?: boolean
}

export interface RenderCauseQuery extends ComponentNameSelector {
  commit?: number
  afterCommit?: number
  limit: number
  appOnly?: boolean
}

export interface ReportAttributionGuard {
  isCurrent: () => boolean
}

/** `result` when appOnly decides membership, so an unresolved candidate may be library code it would hide; `ownership-labels` when every candidate is kept and only its label is unresolved. */
export type SourceClassificationEffect = 'result' | 'ownership-labels'

export interface SourceClassificationCoverage {
  complete: boolean
  affects: SourceClassificationEffect
  totalCandidates: number
  evaluated: number
  app: number
  library: number
  unknown: number
  unknownComponents: string[]
  unknownComponentsOmitted: number
}

type ClassifiedRecord = {
  evaluated: boolean
  record: RenderRecord
  report: RenderReport
  libraryOnly: boolean
  appOwned: boolean
}

interface RecordSourceEvidence extends FiberClassification {
  evaluated: boolean
  hookSources: ExternalStoreSourceResolution
  externalStoreCount: number
  libraryOnly: boolean
  appOwned: boolean
}

/** Glob matching with bounded backtracking; patterns never become executable regular expressions. */
function matchesNamePattern(name: string, pattern: string): boolean {
  let nameIndex = 0
  let patternIndex = 0
  let starIndex = -1
  let retryIndex = 0
  while (nameIndex < name.length) {
    if (pattern[patternIndex] === '?' || pattern[patternIndex] === name[nameIndex]) {
      nameIndex += 1
      patternIndex += 1
    } else if (pattern[patternIndex] === '*') {
      starIndex = patternIndex++
      retryIndex = nameIndex
    } else if (starIndex >= 0) {
      patternIndex = starIndex + 1
      nameIndex = ++retryIndex
    } else {
      return false
    }
  }
  while (pattern[patternIndex] === '*') patternIndex += 1
  return patternIndex === pattern.length
}

export function describeRecordMatch(
  records: Map<number, RenderRecord>,
  selector: ComponentNameSelector,
): ComponentMatch | undefined {
  if (selector.component === undefined) return undefined
  return describeComponentMatch(
    selector,
    [...records.values()].map((record) => record.name),
  )
}

export function renderRecordFilter(query: RenderQuery): (record: RenderRecord) => boolean {
  const component = componentNameMatcher(query)
  const pattern = query.nameFilter?.toLowerCase()
  const exclusions = query.excludeNames?.map((name) => name.toLowerCase()) ?? []
  return (record) => {
    const name = record.name.toLowerCase()
    return (
      component(record.name) &&
      (!pattern || matchesNamePattern(name, pattern)) &&
      !exclusions.some((exclusion) => matchesNamePattern(name, exclusion)) &&
      record.updates >= (query.minUpdates ?? 0)
    )
  }
}

async function selectRecords(
  records: Map<number, RenderRecord>,
  query: RenderQuery,
  guard?: ReportAttributionGuard,
): Promise<{
  kept: ClassifiedRecord[]
  libraryHidden: number
  sourceClassification: SourceClassificationCoverage
}> {
  return selectClassifiedRecords(
    await classifyRecordReports([...records.values()].filter(renderRecordFilter(query)), guard),
    query,
  )
}

function selectClassifiedRecords(
  classified: ClassifiedRecord[],
  query: Pick<RenderQuery, 'component' | 'appOnly'>,
): {
  kept: ClassifiedRecord[]
  libraryHidden: number
  sourceClassification: SourceClassificationCoverage
} {
  const sourceClassification = summarizeOwnership(
    classified.map((entry) => ({ ...entry, name: entry.report.name, source: entry.report.source })),
    query.appOnly,
  )
  if (query.appOnly !== true) return { kept: classified, libraryHidden: 0, sourceClassification }
  const kept = classified.filter((entry) => !entry.libraryOnly)
  return { kept, libraryHidden: classified.length - kept.length, sourceClassification }
}

interface OwnershipEvidence {
  evaluated: boolean
  appOwned: boolean
  libraryOnly: boolean
  name: string
  source: { file: string } | null
}

/** Ownership counts plus the distinct unknown-ownership components, named with the file that renders them, so two cohorts can be checked for counting the same ones. */
function summarizeOwnership(
  entries: OwnershipEvidence[],
  appOnly: boolean | undefined,
): SourceClassificationCoverage {
  let app = 0
  let library = 0
  let evaluated = 0
  const unknownLabels = new Set<string>()
  for (const entry of entries) {
    if (entry.evaluated) evaluated += 1
    if (entry.appOwned) app += 1
    else if (entry.libraryOnly) library += 1
    else unknownLabels.add(entry.source ? `${entry.name} (${entry.source.file})` : entry.name)
  }
  const unknown = entries.length - app - library
  const unknownComponents = [...unknownLabels].sort()
  return {
    complete: unknown === 0,
    affects: appOnly === true ? 'result' : 'ownership-labels',
    totalCandidates: entries.length,
    evaluated,
    app,
    library,
    unknown,
    unknownComponents: unknownComponents.slice(0, UNKNOWN_COMPONENT_LIMIT),
    unknownComponentsOmitted: Math.max(0, unknownComponents.length - UNKNOWN_COMPONENT_LIMIT),
  }
}

async function classifyRecordReports(
  list: RenderRecord[],
  guard?: ReportAttributionGuard,
): Promise<ClassifiedRecord[]> {
  const [resolvedEvidence] = await Promise.all([
    recordSourceEvidence(list),
    resolveClassUpdateCallers(list.map((record) => record.causes)),
  ])
  const evidence =
    guard?.isCurrent() === false ? list.map(() => staleRecordSourceEvidence()) : resolvedEvidence
  return list.map((record, index): ClassifiedRecord => {
    const entry = evidence[index] ?? unknownRecordSourceEvidence()
    const { source, ownership, isLibrary, hookSources, externalStoreCount, libraryOnly, appOwned } =
      entry
    const { fiber: _fiber, latestRenderEventId: _latestRenderEventId, ...rest } = record
    return {
      record,
      evaluated: entry.evaluated,
      libraryOnly,
      appOwned,
      report: {
        ...rest,
        selfTime: roundMilliseconds(rest.selfTime),
        totalTime: roundMilliseconds(rest.totalTime),
        cumulativeSelfTime: roundMilliseconds(rest.cumulativeSelfTime),
        cumulativeTotalTime: roundMilliseconds(rest.cumulativeTotalTime),
        causes: record.unmounted
          ? withReportEvidence(rest.causes, source, undefined, 0, 'component-unmounted')
          : withReportEvidence(rest.causes, source, hookSources, externalStoreCount),
        noObservedInputChange: rest.unnecessary,
        compiler: {
          memoCacheObserved: rest.forget,
          evidence: 'exact',
          compilationStatus: 'unknown',
          limitation: 'runtime-memo-cache-presence-only',
        },
        instance: rest.instance,
        name: rest.name === 'Anonymous' ? (sourceLabel(source) ?? rest.name) : rest.name,
        source,
        sourceAttribution: sourceAttributionForSource(source),
        sourceProvenance: sourceProvenanceForSource(source),
        sourceOwnership: ownership,
        isLibrary,
        wrapperAncestry: wrapperAncestryOf(record.fiber),
      },
    }
  })
}

async function recordSourceEvidence(records: RenderRecord[]): Promise<RecordSourceEvidence[]> {
  const [classificationResult, hookSources] = await Promise.all([
    classifyRecordsWithinBudget(records),
    resolveExternalStoreSourcesWithinBudget(records.map((record) => record.fiber)),
  ])
  return records.map((record, index) => {
    const classification = classificationResult.classes[index] ?? UNCLASSIFIED_FIBER
    const hooks = hookSources[index] ?? { status: 'deadline-exceeded', hooks: null }
    const externalStoreCount = countExternalStoreHooks(record.fiber)
    const exactAppHook = hasExactAppExternalStoreCallsite(hooks, externalStoreCount)
    const appOwned = classification.ownership === 'app' || exactAppHook
    return {
      ...classification,
      evaluated: classificationResult.evaluated[index] === true,
      hookSources: hooks,
      externalStoreCount,
      libraryOnly: classification.ownership === 'library' && !exactAppHook,
      appOwned,
    }
  })
}

function unknownRecordSourceEvidence(): RecordSourceEvidence {
  return {
    ...UNCLASSIFIED_FIBER,
    evaluated: false,
    hookSources: { status: 'deadline-exceeded', hooks: null },
    externalStoreCount: 0,
    libraryOnly: false,
    appOwned: false,
  }
}

function staleRecordSourceEvidence(): RecordSourceEvidence {
  return {
    ...UNCLASSIFIED_FIBER,
    evaluated: false,
    hookSources: { status: 'report-state-advanced', hooks: null },
    externalStoreCount: 0,
    libraryOnly: false,
    appOwned: false,
  }
}

async function classifyRecordsWithinBudget(records: RenderRecord[]) {
  const fibers = records.map((record) => record.fiber)
  const result = await classifyFibersWithinBudget(fibers, {
    limit: SOURCE_CLASSIFY_LIMIT,
    budgetMs: SOURCE_CLASSIFY_BUDGET_MS,
  })
  if (result.partial) scheduleClassificationWarmup(fibers)
  return result
}

function sortReports(entries: ClassifiedRecord[], sort: RenderQuery['sort']): ClassifiedRecord[] {
  return [...entries].sort((left, right) => {
    const before = left.report
    const after = right.report
    if (sort === 'updates') return after.updates - before.updates
    if (sort === 'selfTime') return after.selfTime - before.selfTime
    if (sort === 'unnecessary') return after.unnecessary - before.unnecessary
    if (sort === 'referenceOnly' || sort === 'unstable') {
      return after.referenceOnlyPropRenders - before.referenceOnlyPropRenders
    }
    return after.renders - before.renders
  })
}

export async function buildRenders(
  records: Map<number, RenderRecord>,
  query: RenderQuery,
): Promise<RenderReport[]> {
  const { kept } = await selectRecords(records, query)
  return sortReports(kept, query.sort)
    .slice(0, query.limit)
    .map((entry) => entry.report)
}

export async function buildRendersReport(
  records: Map<number, RenderRecord>,
  query: RenderQuery,
): Promise<{ components: RenderReport[]; libraryHidden: number; omittedByLimit: number }> {
  const { kept, libraryHidden } = await selectRecords(records, query)
  const components = sortReports(kept, query.sort)
    .slice(0, query.limit)
    .map((entry) => entry.report)
  return { components, libraryHidden, omittedByLimit: Math.max(0, kept.length - query.limit) }
}

/** Resolve source/hook evidence once so a measurement's summary and page use the same ownership set. */
export async function buildRendersMeasurementReport(
  records: Map<number, RenderRecord>,
  commits: number,
  query: RenderQuery,
  guard?: ReportAttributionGuard,
): Promise<{
  summary: RenderSummary
  sourceClassification: SourceClassificationCoverage
  components: RenderReport[]
  libraryHidden: number
  omittedByLimit: number
  componentMatch: ComponentMatch | undefined
}> {
  const classified = await classifyRecordReports(
    [...records.values()].filter(renderRecordFilter(query)),
    guard,
  )
  const { kept, libraryHidden, sourceClassification } = selectClassifiedRecords(classified, query)
  return {
    componentMatch: describeRecordMatch(records, query),
    sourceClassification,
    summary: summarizeRecords(
      kept.map((entry) => entry.record),
      commits,
    ),
    components: sortReports(kept, query.sort)
      .slice(0, query.limit)
      .map((entry) => entry.report),
    libraryHidden,
    omittedByLimit: Math.max(0, kept.length - query.limit),
  }
}

export async function buildRenderCauseEventsReport(
  records: Map<number, RenderRecord>,
  recentEvents: readonly RetainedRenderCauseEvent[],
  query: RenderCauseQuery,
  guard?: ReportAttributionGuard,
): Promise<{
  events: RenderCauseEvent[]
  libraryHidden: number
  omittedByLimit: number
  componentMatch: ComponentMatch | undefined
  sourceClassification: SourceClassificationCoverage
}> {
  const named = componentNameMatcher(query)
  const inRange = recentEvents
    .filter((event) => query.commit === undefined || event.documentCommitId === query.commit)
    .filter(
      (event) => query.afterCommit === undefined || event.documentCommitId > query.afterCommit,
    )
  const matching = inRange.filter((event) => named(event.componentName))
  const liveRecords = [
    ...new Map(
      matching
        .map((event) => records.get(event.componentId))
        .filter((record): record is RenderRecord => record !== undefined)
        .map((record) => [record.id, record]),
    ).values(),
  ]
  const [resolvedEvidence] = await Promise.all([
    recordSourceEvidence(liveRecords),
    resolveClassUpdateCallers(matching.map((event) => event.causes)),
  ])
  const attributionCurrent = guard?.isCurrent() !== false
  const evidence = attributionCurrent
    ? resolvedEvidence
    : liveRecords.map(() => staleRecordSourceEvidence())
  const evidenceById = new Map<number, RecordSourceEvidence>()
  liveRecords.forEach((record, index) => {
    evidenceById.set(record.id, evidence[index] ?? unknownRecordSourceEvidence())
  })

  const classified = [...matching].reverse().map((event) => {
    const classification = evidenceById.get(event.componentId) ?? unknownRecordSourceEvidence()
    const liveRecord = records.get(event.componentId)
    // Component source and ownership belong to the mounted instance; only hook-level evidence is specific to its latest render.
    const sameInstance =
      liveRecord !== undefined && liveRecord.instance.mountId === event.instance.mountId
    const isLatestEvent =
      sameInstance &&
      !liveRecord.unmounted &&
      liveRecord.latestRenderEventId === event.renderEventId
    const eventSource = attributionCurrent && sameInstance ? classification.source : null
    const unavailableReason = !attributionCurrent
      ? 'report-state-advanced'
      : liveRecord === undefined || liveRecord.unmounted
        ? 'component-unmounted'
        : isLatestEvent
          ? undefined
          : 'event-not-latest'
    const reported: RenderCauseEvent = {
      ...event,
      causes: withReportEvidence(
        event.causes,
        eventSource,
        isLatestEvent ? classification.hookSources : undefined,
        isLatestEvent ? classification.externalStoreCount : 0,
        unavailableReason,
      ),
      instance: event.instance,
      source: eventSource,
      sourceAttribution: eventSource
        ? sourceAttributionForSource(eventSource)
        : { role: 'unavailable', evidence: 'unknown' },
      sourceOwnership: eventSource ? classification.ownership : 'unknown',
      isLibrary: eventSource ? classification.isLibrary : false,
    }
    return {
      event: reported,
      evaluated: sameInstance && classification.evaluated,
      libraryOnly: sameInstance ? classification.libraryOnly : false,
      appOwned: sameInstance ? classification.appOwned : false,
    }
  })
  const visible =
    query.appOnly !== true ? classified : classified.filter(({ libraryOnly }) => !libraryOnly)
  const libraryHidden = classified.length - visible.length
  return {
    sourceClassification: summarizeOwnership(
      classified.map((entry) => ({ ...entry, name: entry.event.componentName, source: null })),
      query.appOnly,
    ),
    componentMatch: describeComponentMatch(
      query,
      inRange.map((event) => event.componentName),
    ),
    events: visible.slice(0, query.limit).map(({ event }) => event),
    libraryHidden,
    omittedByLimit: Math.max(0, visible.length - query.limit),
  }
}

export async function buildRendersLeaderboards(
  records: Map<number, RenderRecord>,
  limit: number,
  guard?: ReportAttributionGuard,
  selection: Pick<RenderQuery, 'component' | 'exact' | 'appOnly'> = {},
): Promise<{
  componentMatch: ComponentMatch | undefined
  sourceClassification: SourceClassificationCoverage
  slowest: RenderReport[]
  mostRerendered: RenderReport[]
  mostUnnecessary: RenderReport[]
  mostUnstable: RenderReport[]
}> {
  const { kept, sourceClassification } = await selectRecords(
    records,
    { limit, sort: 'renders', ...selection },
    guard,
  )
  const top = (sort: RenderQuery['sort']): RenderReport[] =>
    sortReports(kept, sort)
      .slice(0, limit)
      .map((entry) => entry.report)
  return {
    componentMatch: describeRecordMatch(records, selection),
    sourceClassification,
    slowest: top('selfTime'),
    mostRerendered: top('renders'),
    mostUnnecessary: top('unnecessary'),
    mostUnstable: top('unstable'),
  }
}

export async function buildRenderSummary(
  records: Map<number, RenderRecord>,
  commits: number,
  appOnly = false,
): Promise<RenderSummary> {
  let list = [...records.values()]
  if (appOnly) {
    const evidence = await recordSourceEvidence(list)
    list = list.filter((_, index) => evidence[index]?.libraryOnly !== true)
  }
  return summarizeRecords(list, commits)
}

function summarizeRecords(list: RenderRecord[], commits: number): RenderSummary {
  let totalRenders = 0
  let totalUpdates = 0
  let unstableComponents = 0
  let referenceOnlyPropComponents = 0
  let unnecessaryComponents = 0
  const unstablePropCounts = new Map<string, number>()
  const referenceOnlyPropCounts = new Map<string, number>()
  for (const record of list) {
    totalRenders += record.renders
    totalUpdates += record.updates
    if (record.referenceOnlyPropRenders > 0) {
      referenceOnlyPropComponents += 1
      unstableComponents += 1
    }
    if (record.unnecessary > 0) unnecessaryComponents += 1
    for (const change of record.changes) {
      if (change.kind === 'props' && change.unstable) {
        unstablePropCounts.set(change.name, (unstablePropCounts.get(change.name) ?? 0) + 1)
      }
      if (change.kind === 'props' && change.referenceOnly) {
        referenceOnlyPropCounts.set(
          change.name,
          (referenceOnlyPropCounts.get(change.name) ?? 0) + 1,
        )
      }
    }
  }
  return {
    commits,
    trackedComponents: list.length,
    totalRenders,
    totalUpdates,
    unstableComponents,
    referenceOnlyPropComponents,
    unnecessaryComponents,
    noObservedInputChangeComponents: unnecessaryComponents,
    topUnstableProps: [...unstablePropCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 10),
    topReferenceOnlyProps: [...referenceOnlyPropCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 10),
  }
}

export async function buildCurrentAggregateMeasurement(
  records: Map<number, RenderRecord>,
  appOnly = false,
  guard?: ReportAttributionGuard,
): Promise<{
  components: ComponentAggregate[]
  sourceClassification: SourceClassificationCoverage
}> {
  const list = [...records.values()]
  const resolvedEvidence = await recordSourceEvidence(list)
  const evidence =
    guard?.isCurrent() === false ? list.map(() => staleRecordSourceEvidence()) : resolvedEvidence
  const aggregates = new Map<string, ComponentAggregate>()
  list.forEach((record, index) => {
    const { source, libraryOnly } = evidence[index] ?? unknownRecordSourceEvidence()
    if (appOnly && libraryOnly) return
    const displayLabel = sourceLabel(source)
    const canonicalSource = source
      ? `${source.file}:${source.line ?? '?'}:${source.column ?? '?'}`
      : null
    const definitionKey = componentDefinitionKey(record)
    const current = aggregates.get(definitionKey)
    if (current) {
      current.renders += record.renders
      current.mounts += record.mounts
      current.updates += record.updates
      current.selfTime += record.cumulativeSelfTime
      current.totalTime += record.cumulativeTotalTime
      current.unnecessary += record.unnecessary
      current.referenceOnlyPropRenders += record.referenceOnlyPropRenders
      current.unstableRenders += record.unstableRenders
      return
    }
    aggregates.set(definitionKey, {
      definitionKey,
      name: record.name === 'Anonymous' ? (displayLabel ?? record.name) : record.name,
      source: canonicalSource,
      renders: record.renders,
      mounts: record.mounts,
      updates: record.updates,
      selfTime: record.cumulativeSelfTime,
      totalTime: record.cumulativeTotalTime,
      unnecessary: record.unnecessary,
      referenceOnlyPropRenders: record.referenceOnlyPropRenders,
      unstableRenders: record.unstableRenders,
    })
  })
  const sourceClassification = summarizeOwnership(
    list.map((record, index) => {
      const entry = evidence[index] ?? unknownRecordSourceEvidence()
      const name =
        record.name === 'Anonymous' ? (sourceLabel(entry.source) ?? record.name) : record.name
      return { ...entry, name }
    }),
    appOnly,
  )
  return { components: [...aggregates.values()], sourceClassification }
}

const componentDefinitionIds = new WeakMap<object, number>()
let nextComponentDefinitionId = 1

function componentDefinitionKey(record: RenderRecord): string {
  const definition = record.fiber.elementType ?? record.fiber.type
  if ((typeof definition === 'object' && definition !== null) || typeof definition === 'function') {
    let id = componentDefinitionIds.get(definition)
    if (id === undefined) {
      id = nextComponentDefinitionId
      nextComponentDefinitionId += 1
      componentDefinitionIds.set(definition, id)
    }
    return `definition:${id}`
  }
  return `fiber:${record.id}`
}

export async function buildCurrentAggregates(
  ...args: Parameters<typeof buildCurrentAggregateMeasurement>
) {
  return (await buildCurrentAggregateMeasurement(...args)).components
}
