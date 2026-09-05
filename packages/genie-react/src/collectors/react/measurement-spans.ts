import { newId } from '../../protocol'
import { getDocumentCommitId } from './observation'
import { emptyCauseCounts } from './render-causes'
import type { RenderRecord } from './render-model'
import { buildRendersMeasurementReport, type RenderQuery } from './render-reports'
import { captureReportEpoch, reportStateMatches } from './report-attribution'

const MAX_SPANS = 20
const MAX_COMPONENTS = 500
const MAX_COMMITS = 1000
const TTL_MS = 5 * 60_000

interface MeasurementSpan {
  handle: string
  label: string
  startedAfterDocumentCommitId: number
  endedAtDocumentCommitId: number | null
  expiresAt: number
  records: Map<number, RenderRecord>
  commitIds: number[]
  excludedCommits: number
  incomplete: boolean
}

const spans = new Map<string, MeasurementSpan>()
let commitOwner: MeasurementSpan | undefined

function prune(): void {
  const now = Date.now()
  for (const [handle, span] of spans) {
    if (now >= span.expiresAt) spans.delete(handle)
  }
}

function metadata(span: MeasurementSpan) {
  return {
    handle: span.handle,
    label: span.label,
    ownership: 'newest-open-span' as const,
    attribution: 'temporal-only' as const,
    startedAfterDocumentCommitId: span.startedAfterDocumentCommitId,
    endedAtDocumentCommitId: span.endedAtDocumentCommitId,
    expiresAt: span.expiresAt,
  }
}

/** Opening never clears global evidence. Only the newest open span owns each subsequent commit. */
export function openMeasurementSpan(label: string) {
  prune()
  if (spans.size >= MAX_SPANS) {
    const closed = [...spans.values()].find((span) => span.endedAtDocumentCommitId !== null)
    if (closed) spans.delete(closed.handle)
    else
      throw new Error(
        '20 measurement spans are open. Close a span with react_renders_since({handle,close:true}) before opening another.',
      )
  }
  const span: MeasurementSpan = {
    handle: newId(),
    label,
    startedAfterDocumentCommitId: getDocumentCommitId(),
    endedAtDocumentCommitId: null,
    expiresAt: Date.now() + TTL_MS,
    records: new Map(),
    commitIds: [],
    excludedCommits: 0,
    incomplete: false,
  }
  spans.set(span.handle, span)
  return metadata(span)
}

/** Claim once per document commit, so all roots' individual commits have exactly one owner. */
export function beginMeasurementCommit(documentCommitId: number, observable: boolean): void {
  if (spans.size === 0) {
    commitOwner = undefined
    return
  }
  prune()
  const open = [...spans.values()].filter((span) => span.endedAtDocumentCommitId === null)
  commitOwner = open.at(-1)
  for (const span of open) {
    if (span !== commitOwner) span.excludedCommits += 1
  }
  if (!commitOwner) return
  if (!observable) commitOwner.incomplete = true
  commitOwner.commitIds.push(documentCommitId)
  if (commitOwner.commitIds.length === MAX_COMMITS) {
    commitOwner.incomplete = true
    commitOwner.endedAtDocumentCommitId = documentCommitId
  }
}

/** An excluded renderer can arrive before the newest span owns any analyzable commit. */
export function markMeasurementCollectionGap(): void {
  prune()
  const newest = [...spans.values()].filter((span) => span.endedAtDocumentCommitId === null).at(-1)
  if (newest) newest.incomplete = true
}

export function markMeasurementIncomplete(): void {
  if (commitOwner) commitOwner.incomplete = true
}

/** Retain deltas from the same successful analysis as the global report, without re-analyzing fibers. */
export function recordMeasurementRender(
  record: RenderRecord,
  previous: RenderRecord | undefined,
): void {
  const span = commitOwner
  if (!span || span.commitIds.at(-1) !== record.latestDocumentCommitId) return
  const existing = span.records.get(record.id)
  if (!existing && span.records.size >= MAX_COMPONENTS) {
    span.incomplete = true
    return
  }
  const delta = (
    key:
      | 'renders'
      | 'mounts'
      | 'updates'
      | 'unnecessary'
      | 'referenceOnlyPropRenders'
      | 'unstableRenders'
      | 'cumulativeSelfTime'
      | 'cumulativeTotalTime',
  ) => record[key] - (previous?.[key] ?? 0)
  const causeCounts = { ...(existing?.causeCounts ?? emptyCauseCounts()) }
  for (const cause of record.causes) causeCounts[cause.kind] += 1
  const selfTime = delta('cumulativeSelfTime')
  const totalTime = delta('cumulativeTotalTime')
  span.records.set(record.id, {
    ...record,
    renders: (existing?.renders ?? 0) + delta('renders'),
    mounts: (existing?.mounts ?? 0) + delta('mounts'),
    updates: (existing?.updates ?? 0) + delta('updates'),
    unnecessary: (existing?.unnecessary ?? 0) + delta('unnecessary'),
    referenceOnlyPropRenders:
      (existing?.referenceOnlyPropRenders ?? 0) + delta('referenceOnlyPropRenders'),
    unstableRenders: (existing?.unstableRenders ?? 0) + delta('unstableRenders'),
    cumulativeSelfTime: (existing?.cumulativeSelfTime ?? 0) + selfTime,
    cumulativeTotalTime: (existing?.cumulativeTotalTime ?? 0) + totalTime,
    selfTime: Math.max(existing?.selfTime ?? 0, selfTime),
    totalTime: Math.max(existing?.totalTime ?? 0, totalTime),
    causeCounts,
  })
}

/** Freeze the selected span before async source lookup; closing resumes the previous open span. */
export async function readMeasurementSpan(handle: string, close: boolean, query: RenderQuery) {
  prune()
  const span = spans.get(handle)
  if (!span)
    throw new Error(
      'Measurement handle is unknown, expired, evicted, or invalidated by reload. Open a new span with react_measure.',
    )
  if (close && span.endedAtDocumentCommitId === null) {
    span.endedAtDocumentCommitId = getDocumentCommitId()
    if (commitOwner === span) commitOwner = undefined
  }
  const header = metadata(span)
  const commitIds = [...span.commitIds]
  const excludedCommits = span.excludedCommits
  const incomplete = span.incomplete
  const epoch = captureReportEpoch()
  const report = await buildRendersMeasurementReport(
    new Map(span.records),
    commitIds.length,
    query,
    { isCurrent: () => reportStateMatches(epoch) },
  )
  const complete = !incomplete && (!query.appOnly || report.sourceClassification.complete)
  return {
    ...header,
    commitIds,
    commits: commitIds.length,
    excludedCommits,
    ...report,
    summary: {
      ...report.summary,
      semantics: complete
        ? ('exact' as const)
        : report.summary.totalRenders > 0
          ? ('lower-bound' as const)
          : ('unknown' as const),
      coverageDomain: 'render-measurement' as const,
    },
    coverage: { complete, semantics: complete ? ('exact' as const) : ('lower-bound' as const) },
    limitation:
      'Exclusive temporal capture, not causal attribution. Background work can be included; commits owned by newer spans are explicitly excluded.',
  }
}

/** Teardown invalidates handles; a global clear deliberately does not. */
export function clearMeasurementSpans(): void {
  spans.clear()
  commitOwner = undefined
}
