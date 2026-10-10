import {
  formatSourceLocation,
  INTERACTION_SECTIONS,
  type InteractionCapture,
  type InteractionSection,
  type InteractionSummary,
  roundMilliseconds,
} from '../protocol'

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
  return {
    ...sectionStatus(evidence),
    commits: numberField(result, 'commits'),
    trackedComponents,
    totalRenders: numberField(summary, 'totalRenders'),
    totalUpdates: numberField(summary, 'totalUpdates'),
    omittedComponents: Math.max(0, (trackedComponents ?? components.length) - listed.length),
    components: listed.map((component) => ({
      id: numberField(component, 'id') ?? -1,
      name: stringField(component, 'name') ?? '(unknown)',
      renders: numberField(component, 'renders') ?? 0,
      updates: numberField(component, 'updates') ?? 0,
      selfTime: roundMilliseconds(numberField(component, 'selfTime') ?? 0),
      topCause: topCause(component),
    })),
  }
}

function topCause(component: Record<string, unknown>): {
  kind: string
  count: number
  name?: string
} | null {
  const counts = Object.entries(recordOf(component.causeCounts) ?? {}).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0,
  )
  if (counts.length === 0) return null
  const [kind, count] = counts.reduce((top, entry) => (entry[1] > top[1] ? entry : top))
  const name = causeLabel(recordsOf(component.causes).find((cause) => cause.kind === kind))
  return { kind, count, ...(name === undefined ? {} : { name }) }
}

function causeLabel(cause: Record<string, unknown> | undefined): string | undefined {
  if (!cause) return undefined
  for (const key of ['name', 'storeLabel', 'queryHash', 'routerId', 'parentName'] as const) {
    const value = cause[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return undefined
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

export function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function numberField(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function stringField(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key]
  return typeof value === 'string' ? value : null
}
