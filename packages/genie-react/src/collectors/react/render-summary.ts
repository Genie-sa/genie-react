import type { z } from 'zod'
import {
  compactRenderCause,
  formatSourceLocation,
  incompleteInputCoverage,
  memoCounters,
  roundMilliseconds,
} from '../../protocol'
import type { InstanceDescriptor } from './instance-identity'
import type { RenderCauseCounts, RenderCauseEvent } from './render-causes'
import type { renderCauseEventSummarySchema, renderComponentSummarySchema } from './render-contract'
import type { RenderReport } from './render-model'
import type { RenderQuery } from './render-reports'
import type { ResolvedSource } from './source'

type RenderComponentSummary = z.infer<typeof renderComponentSummarySchema>
type RenderCauseEventSummary = z.infer<typeof renderCauseEventSummarySchema>
type RenderSort = RenderQuery['sort']

const SORT_KEY_FIELDS: Partial<Record<RenderSort, keyof RenderComponentSummary>> = {
  unnecessary: 'noObservedInputChange',
  referenceOnly: 'referenceOnlyPropRenders',
  unstable: 'referenceOnlyPropRenders',
}

/** One render record without values, diffs, legacy aliases or duplicated provenance; the field a sort ranks by is kept even when zero. */
export function summarizeRenderComponent(
  component: RenderReport,
  sort?: RenderSort,
): RenderComponentSummary {
  const sortKey = sort === undefined ? undefined : SORT_KEY_FIELDS[sort]
  const selfTime = roundMilliseconds(component.selfTime)
  const totalTime = roundMilliseconds(component.totalTime)
  const cumulativeSelfTime = roundMilliseconds(component.cumulativeSelfTime)
  const cumulativeTotalTime = roundMilliseconds(component.cumulativeTotalTime)
  return {
    id: component.id,
    name: component.name,
    ...identity(component.instance),
    renders: component.renders,
    updates: component.updates,
    ...positive('mounts', component.mounts),
    ...memoCounters(component, sortKey),
    selfTime,
    totalTime,
    ...(cumulativeSelfTime === selfTime ? {} : { cumulativeSelfTime }),
    ...(cumulativeTotalTime === totalTime ? {} : { cumulativeTotalTime }),
    latestDocumentCommitId: component.latestDocumentCommitId,
    causeCounts: nonZeroCounts(component.causeCounts),
    causes: component.causes.map(compactRenderCause),
    inputEvidence: component.assessment.inputEvidence,
    ...incompleteInputCoverage(component.inputCoverage),
    ...(component.compiler.memoCacheObserved ? { memoCacheObserved: true as const } : {}),
    ...(component.wrapperAncestry.length > 0
      ? { wrappers: component.wrapperAncestry.map((frame) => frame.name) }
      : {}),
    source: compactSource(component.source, component.sourceOwnership),
  }
}

/** One render event reduced to its identity, named causes and source location. */
export function summarizeRenderCauseEvent(
  event: RenderCauseEvent,
  reportObservationId: string | null,
): RenderCauseEventSummary {
  return {
    renderEventId: event.renderEventId,
    ...(event.observationId === reportObservationId ? {} : { observationId: event.observationId }),
    documentCommitId: event.documentCommitId,
    componentId: event.componentId,
    componentName: event.componentName,
    ...identity(event.instance),
    causes: event.causes.map(compactRenderCause),
    inputEvidence: event.assessment.inputEvidence,
    ...incompleteInputCoverage(event.inputCoverage),
    source: compactSource(event.source, event.sourceOwnership),
  }
}

function compactSource(
  source: ResolvedSource | null | undefined,
  ownership: RenderComponentSummary['source']['ownership'],
): RenderComponentSummary['source'] {
  return { location: formatSourceLocation(source ?? null), ownership }
}

function identity(instance: InstanceDescriptor): { mountId: string; key?: string } {
  return instance.key === null
    ? { mountId: instance.mountId }
    : { mountId: instance.mountId, key: instance.key }
}

function nonZeroCounts(counts: RenderCauseCounts): RenderComponentSummary['causeCounts'] {
  return Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0))
}

function positive<Key extends string>(key: Key, value: number): Partial<Record<Key, number>> {
  return value > 0 ? ({ [key]: value } as Record<Key, number>) : {}
}
