import type { z } from 'zod'
import { formatSourceLocation, roundMilliseconds } from '../../protocol'
import type { InstanceDescriptor } from './instance-identity'
import type { RenderInputCoverage } from './render-budget'
import type { RenderCause, RenderCauseCounts, RenderCauseEvent } from './render-causes'
import type { renderCauseEventSummarySchema, renderComponentSummarySchema } from './render-contract'
import type { RenderReport } from './render-model'
import type { ResolvedSource } from './source'

type RenderComponentSummary = z.infer<typeof renderComponentSummarySchema>
type RenderCauseEventSummary = z.infer<typeof renderCauseEventSummarySchema>
type CompactCause = RenderComponentSummary['causes'][number]

/** One render record without values, diffs, legacy aliases or duplicated provenance. */
export function summarizeRenderComponent(component: RenderReport): RenderComponentSummary {
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
    ...positive('noObservedInputChange', component.noObservedInputChange),
    ...positive('referenceOnlyPropRenders', component.referenceOnlyPropRenders),
    selfTime,
    totalTime,
    ...(cumulativeSelfTime === selfTime ? {} : { cumulativeSelfTime }),
    ...(cumulativeTotalTime === totalTime ? {} : { cumulativeTotalTime }),
    latestDocumentCommitId: component.latestDocumentCommitId,
    causeCounts: nonZeroCounts(component.causeCounts),
    causes: component.causes.map(compactCause),
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
    causes: event.causes.map(compactCause),
    inputEvidence: event.assessment.inputEvidence,
    ...incompleteInputCoverage(event.inputCoverage),
    source: compactSource(event.source, event.sourceOwnership),
  }
}

function compactCause(cause: RenderCause): CompactCause {
  const compact: CompactCause = { kind: cause.kind, evidence: cause.evidence }
  switch (cause.kind) {
    case 'props':
      return {
        ...compact,
        name: cause.name,
        ...(cause.referenceOnly ? { referenceOnly: true as const } : {}),
      }
    case 'state':
    case 'context':
      return { ...compact, name: cause.name }
    case 'external-store':
      return { ...compact, name: cause.storeLabel }
    case 'query':
      return cause.queryHash === undefined ? compact : { ...compact, name: cause.queryHash }
    case 'router':
      return cause.routerId === undefined ? compact : { ...compact, name: cause.routerId }
    case 'parent':
      return { ...compact, name: cause.parentName }
    case 'unknown':
      return { ...compact, reason: cause.reason }
    default:
      return compact
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

function incompleteInputCoverage(coverage: RenderInputCoverage): {
  inputCoverage?: Partial<RenderInputCoverage>
} {
  if (coverage.complete) return {}
  return {
    inputCoverage: Object.fromEntries(
      Object.entries(coverage).filter(
        ([key, value]) => key === 'complete' || (value !== 0 && value !== false),
      ),
    ),
  }
}

function nonZeroCounts(counts: RenderCauseCounts): RenderComponentSummary['causeCounts'] {
  return Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0))
}

function positive<Key extends string>(key: Key, value: number): Partial<Record<Key, number>> {
  return value > 0 ? ({ [key]: value } as Record<Key, number>) : {}
}
