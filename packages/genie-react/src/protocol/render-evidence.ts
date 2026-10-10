/** Per-component render counters that bear on memoization; summaries list the non-zero ones. */
export const RENDER_MEMO_COUNTERS = ['noObservedInputChange', 'referenceOnlyPropRenders'] as const
export type RenderMemoCounter = (typeof RENDER_MEMO_COUNTERS)[number]
export const RENDER_CAUSE_EVIDENCE = ['exact', 'inferred', 'unknown'] as const

const CAUSE_NAME_FIELDS: Record<string, string> = {
  props: 'name',
  state: 'name',
  context: 'name',
  'external-store': 'storeLabel',
  query: 'queryHash',
  router: 'routerId',
  parent: 'parentName',
}
const MAX_CHANGED_RESULT_FIELDS = 10

export interface RenderCauseFields<Kind extends string = string, Evidence extends string = string> {
  kind: Kind
  evidence: Evidence
}

export interface CompactRenderCause<
  Kind extends string = string,
  Evidence extends string = string,
> {
  kind: Kind
  evidence: Evidence
  name?: string
  referenceOnly?: true
  reason?: string
  changedResultFields?: string[]
}

/** The memo-relevant counters that are non-zero, plus `keep` even at zero. */
export function memoCounters(
  component: Partial<Record<RenderMemoCounter, unknown>>,
  keep?: string,
): Partial<Record<RenderMemoCounter, number>> {
  return Object.fromEntries(
    RENDER_MEMO_COUNTERS.flatMap((key) => {
      const value = component[key]
      return typeof value === 'number' && (value > 0 || key === keep) ? [[key, value]] : []
    }),
  )
}

/** A render cause reduced to its kind, evidence, the input's name and how it was matched; values and diffs are dropped. */
export function compactRenderCause<Kind extends string, Evidence extends string>(
  cause: RenderCauseFields<Kind, Evidence>,
): CompactRenderCause<Kind, Evidence> {
  const fields: Record<string, unknown> = { ...cause }
  const nameField = CAUSE_NAME_FIELDS[cause.kind]
  const name = nameField === undefined ? undefined : fields[nameField]
  const reason = cause.kind === 'query' || cause.kind === 'unknown' ? fields.reason : undefined
  const notification = cause.kind === 'query' ? fields.notification : undefined
  const changed =
    typeof notification === 'object' && notification !== null
      ? Reflect.get(notification, 'changedResultFields')
      : undefined
  return {
    kind: cause.kind,
    evidence: cause.evidence,
    ...(typeof name === 'string' ? { name } : {}),
    ...(cause.kind === 'props' && fields.referenceOnly === true
      ? { referenceOnly: true as const }
      : {}),
    ...(typeof reason === 'string' ? { reason } : {}),
    ...(Array.isArray(changed)
      ? {
          changedResultFields: changed
            .filter((field): field is string => typeof field === 'string')
            .slice(0, MAX_CHANGED_RESULT_FIELDS),
        }
      : {}),
  }
}

/** Nothing when input attribution is complete; otherwise only the checks that failed. */
export function incompleteInputCoverage<Coverage extends { complete: boolean }>(
  coverage: Coverage,
): { inputCoverage?: Partial<Coverage> } {
  if (coverage.complete) return {}
  return {
    inputCoverage: Object.fromEntries(
      Object.entries(coverage).filter(
        ([key, value]) =>
          key === 'complete' || (typeof value === 'number' && value !== 0) || value === true,
      ),
    ) as Partial<Coverage>,
  }
}
