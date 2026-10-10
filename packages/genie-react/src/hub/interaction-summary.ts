import {
  compactRenderCause,
  formatSourceLocation,
  INTERACTION_SECTIONS,
  type InteractionCapture,
  type InteractionSection,
  type InteractionSummary,
  incompleteInputCoverage,
  memoCounters,
  RENDER_CAUSE_EVIDENCE,
  roundMilliseconds,
} from '../protocol'
import { numberField, recordOf, stringField } from './wire-guards'

const SUMMARY_COMPONENTS = 10
const SUMMARY_EFFECTS = 5

type ToolEvidence = NonNullable<InteractionCapture['sections']['renders']>
type SectionStatus = Pick<ToolEvidence, 'status' | 'error'>

/** The retained bundle, optionally reduced to the requested sections. */
export function selectInteractionSections(
  capture: InteractionCapture,
  sections: readonly InteractionSection[] | undefined,
): InteractionCapture {
  const selected = structuredClone(capture)
  if (!sections) return selected
  const wanted = new Set(sections)
  for (const section of INTERACTION_SECTIONS) {
    if (!wanted.has(section)) delete selected.sections[section]
  }
  return selected
}

/** Decision fields from a full interaction bundle; the retained bundle stays readable with view:"full". */
export function summarizeInteraction(capture: InteractionCapture): InteractionSummary {
  const { sections, settle, ...identity } = capture
  return structuredClone({
    ...identity,
    view: 'summary' as const,
    settle: {
      ok: settle.ok,
      waitedMs: settle.waitedMs,
      ...(settle.reason === undefined ? {} : { reason: settle.reason }),
      domains: Object.fromEntries(
        Object.entries(settle.domains).map(([domain, result]) => [
          domain,
          {
            status: result.status,
            ...(result.reason === undefined ? {} : { reason: result.reason }),
          },
        ]),
      ),
    },
    renders: summarizeRenders(sections.renders),
    causes: summarizeCauses(sections.causes),
    effects: summarizeEffects(sections.effects),
    cohorts: (sections.cohorts ?? []).map(({ component, evidence }) => {
      const result = recordOf(evidence.result)
      return {
        ...sectionStatus(evidence),
        component,
        cohortStatus: stringField(result, 'status'),
        matched: numberField(result, 'matched'),
        mountedUpdated: numberField(result, 'mountedUpdated'),
        unmounted: numberField(result, 'unmounted'),
      }
    }),
    fullView: {
      tool: 'devtools_interaction_stop' as const,
      args: { interactionId: capture.interactionId, view: 'full' as const },
      sections: [...INTERACTION_SECTIONS],
    },
  })
}

function summarizeRenders(evidence: ToolEvidence | undefined): InteractionSummary['renders'] {
  const result = recordOf(evidence?.result)
  const summary = recordOf(result?.summary)
  const components = recordsOf(result?.components)
  const listed = components.slice(0, SUMMARY_COMPONENTS)
  const trackedComponents = numberField(summary, 'trackedComponents')
  const semantics = stringField(summary, 'semantics')
  return {
    ...sectionStatus(evidence),
    commits: numberField(result, 'commits'),
    trackedComponents,
    totalRenders: numberField(summary, 'totalRenders'),
    totalUpdates: numberField(summary, 'totalUpdates'),
    semantics: isRenderSemantics(semantics) ? semantics : null,
    omittedComponents: Math.max(0, (trackedComponents ?? components.length) - listed.length),
    components: listed.map(summarizeComponent),
  }
}

function summarizeComponent(
  component: Record<string, unknown>,
): InteractionSummary['renders']['components'][number] {
  const inputCoverage = recordOf(component.inputCoverage)
  return {
    id: numberField(component, 'id') ?? -1,
    name: stringField(component, 'name') ?? '(unknown)',
    renders: numberField(component, 'renders') ?? 0,
    updates: numberField(component, 'updates') ?? 0,
    selfTime: roundMilliseconds(numberField(component, 'selfTime') ?? 0),
    ...memoCounters(component),
    inputEvidence: stringField(recordOf(component.assessment), 'inputEvidence'),
    ...(typeof inputCoverage?.complete === 'boolean'
      ? incompleteInputCoverage({ ...inputCoverage, complete: inputCoverage.complete })
      : {}),
    topCause: topCause(component),
  }
}

/** The most frequent cause kind across the window; details come from that kind's cause in the latest render, so they are labelled latest. */
function topCause(
  component: Record<string, unknown>,
): InteractionSummary['renders']['components'][number]['topCause'] {
  const counts = Object.entries(recordOf(component.causeCounts) ?? {}).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0,
  )
  const count = Math.max(0, ...counts.map(([, value]) => value))
  const [kind, ...tiedWith] = counts.filter(([, value]) => value === count).map(([name]) => name)
  if (kind === undefined) return null
  const latest = recordsOf(component.causes).find((cause) => cause.kind === kind)
  return {
    kind,
    count,
    ...(tiedWith.length > 0 ? { tiedWith } : {}),
    ...(latest ? latestCauseDetails(latest) : {}),
  }
}

function latestCauseDetails(cause: Record<string, unknown>) {
  const {
    kind: _kind,
    name,
    ...details
  } = compactRenderCause({
    ...cause,
    kind: String(cause.kind),
    evidence: RENDER_CAUSE_EVIDENCE.find((value) => value === cause.evidence) ?? 'unknown',
  })
  return { ...(name === undefined ? {} : { latestName: name }), ...details }
}

function isRenderSemantics(
  value: string | null,
): value is NonNullable<InteractionSummary['renders']['semantics']> {
  return value === 'exact' || value === 'lower-bound' || value === 'unknown'
}

function summarizeCauses(evidence: ToolEvidence | undefined): InteractionSummary['causes'] {
  const result = recordOf(evidence?.result)
  return {
    ...sectionStatus(evidence),
    events: recordsOf(result?.events).length,
    omittedByLimit: numberField(result, 'omittedByLimit'),
  }
}

function summarizeEffects(evidence: ToolEvidence | undefined): InteractionSummary['effects'] {
  const result = recordOf(evidence?.result)
  const events = recordsOf(result?.events)
  const byEffect = new Map<string, InteractionSummary['effects']['hottest'][number]>()
  for (const event of events) {
    const effectId = stringField(event, 'effectId')
    if (effectId === null) continue
    const execution = recordOf(event.execution)
    const executed = execution?.status === 'observed'
    const entry = byEffect.get(effectId) ?? {
      effectId,
      componentName: stringField(event, 'componentName') ?? '(unknown)',
      kind: stringField(event, 'kind') ?? 'unknown',
      events: 0,
      executions: 0,
      durationMs: 0,
      source: sourceLocation(recordOf(event.source)),
    }
    entry.events += 1
    if (executed) entry.executions += 1
    entry.durationMs = roundMilliseconds(
      entry.durationMs + (numberField(execution, 'durationMs') ?? 0),
    )
    byEffect.set(effectId, entry)
  }
  return {
    ...sectionStatus(evidence),
    tool: evidence?.tool ?? 'react_effect_timeline',
    events: events.length,
    omittedByLimit: numberField(result, 'omittedByLimit'),
    hottest: [...byEffect.values()]
      .sort((left, right) => right.events - left.events || right.durationMs - left.durationMs)
      .slice(0, SUMMARY_EFFECTS),
  }
}

function sectionStatus(evidence: SectionStatus | undefined): SectionStatus {
  if (!evidence) return { status: 'unavailable' }
  return {
    status: evidence.status,
    ...(evidence.error === undefined ? {} : { error: evidence.error }),
  }
}

function sourceLocation(source: Record<string, unknown> | null): string | null {
  const file = stringField(source, 'file')
  return file === null
    ? null
    : formatSourceLocation({
        file,
        line: numberField(source, 'line'),
        column: numberField(source, 'column'),
      })
}

function recordsOf(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const record = recordOf(entry)
    return record ? [record] : []
  })
}
