/** Every way two parts of one render tool result can contradict each other, as readable problems; an empty list means the result agrees with itself. */

type Value = Record<string, unknown>

const MEASUREMENT_REASONS = new Set([
  'budget-exhausted',
  'unmounts-dropped',
  'commits-after-profile-stop',
  'renderer-not-analyzed',
  'traversal-failed',
  'analysis-failed',
  'source-classification-incomplete',
])

const record = (value: unknown): Value =>
  typeof value === 'object' && value !== null ? (value as Value) : {}

const list = (value: unknown): Value[] => (Array.isArray(value) ? value.map(record) : [])

function reasonsOf(coverage: Value): string[] {
  return list(coverage.incompleteBecause).map((entry) => String(entry.reason))
}

function classificationProblems(at: string, classification: Value, coverage: Value): string[] {
  const problems: string[] = []
  const total = Number(classification.totalCandidates)
  const app = Number(classification.app)
  const library = Number(classification.library)
  const unknown = Number(classification.unknown)
  if (app + library + unknown !== total) {
    problems.push(`${at}: app ${app} + library ${library} + unknown ${unknown} != ${total}`)
  }
  if (Number(classification.evaluated) > total) {
    problems.push(`${at}: evaluated ${classification.evaluated} exceeds ${total} candidates`)
  }
  if (classification.complete !== (unknown === 0)) {
    problems.push(`${at}: complete ${classification.complete} with ${unknown} unknown`)
  }
  const affects = classification.affects
  if (affects !== 'result' && affects !== 'ownership-labels') {
    problems.push(`${at}: affects is ${String(affects)}, so a reader cannot tell what it changes`)
  }
  const classificationGap = reasonsOf(coverage).includes('source-classification-incomplete')
  if (affects === 'result' && classification.complete === false) {
    if (coverage.complete !== false) {
      problems.push(`${at}: incomplete and it decides the result, yet coverage.complete is true`)
    }
    if (coverage.semantics === 'exact') {
      problems.push(`${at}: incomplete and it decides the result, yet coverage is exact`)
    }
    if (coverage.coverageDomain !== undefined && !classificationGap) {
      problems.push(`${at}: incomplete, yet coverage.incompleteBecause does not say so`)
    }
  } else if (classificationGap) {
    problems.push(`${at}: coverage blames source classification that does not decide the result`)
  }
  return problems
}

/** A render coverage block: completeness, semantics and the reasons given must say the same thing. */
export function coverageProblems(at: string, coverage: Value): string[] {
  const problems: string[] = []
  const reasons = reasonsOf(coverage)
  if (coverage.complete === true && coverage.semantics !== 'exact') {
    problems.push(`${at}: complete but semantics ${String(coverage.semantics)}`)
  }
  if (coverage.semantics === 'exact' && coverage.complete !== true) {
    problems.push(`${at}: exact but not complete`)
  }
  if (coverage.complete === true && reasons.length > 0) {
    problems.push(`${at}: complete but incomplete because ${reasons.join(', ')}`)
  }
  if (
    coverage.coverageDomain === 'render-causality' &&
    coverage.complete === true &&
    coverage.inputAttributionComplete !== true
  ) {
    problems.push(`${at}: causal coverage complete without complete input attribution`)
  }
  if (
    coverage.complete === true &&
    typeof coverage.droppedRenderEvents === 'number' &&
    coverage.droppedRenderEvents > 0
  ) {
    problems.push(`${at}: complete while ${coverage.droppedRenderEvents} render events dropped`)
  }
  if (coverage.sourceClassification !== undefined) {
    problems.push(
      ...classificationProblems(
        `${at}.sourceClassification`,
        record(coverage.sourceClassification),
        coverage,
      ),
    )
  }
  return problems
}

function comparabilityProblems(result: Value, coverage: Value): string[] {
  const problems: string[] = []
  const reasons = Array.isArray(result.notComparableReasons) ? result.notComparableReasons : []
  if (result.comparable !== (reasons.length === 0)) {
    problems.push(`comparable ${result.comparable} with reasons [${reasons.join(', ')}]`)
  }
  if (result.comparable === true && coverage.complete !== true) {
    problems.push('comparable while coverage is incomplete')
  }
  return problems
}

function summaryProblems(summary: Value, coverage: Value, classification: Value): string[] {
  const problems: string[] = []
  const classificationDecides = classification.affects === 'result' && !classification.complete
  if (classificationDecides && summary.semantics !== 'unknown') {
    problems.push(`summary semantics ${String(summary.semantics)} over unresolved app membership`)
  }
  if (summary.semantics === 'exact') {
    const lossy = reasonsOf(coverage).filter((reason) => MEASUREMENT_REASONS.has(reason))
    if (lossy.length > 0) problems.push(`summary exact while coverage lost ${lossy.join(', ')}`)
    if (summary.coverageDomain === coverage.coverageDomain && coverage.semantics !== 'exact') {
      problems.push('summary exact while coverage of the same domain is not')
    }
  }
  return problems
}

export function getRendersProblems(result: Value): string[] {
  const coverage = record(result.coverage)
  const classification = record(result.sourceClassification)
  const pagination = record(result.pagination)
  const summary = record(result.summary)
  const components = list(result.components)
  const problems = [
    ...coverageProblems('coverage', coverage),
    ...classificationProblems('sourceClassification', classification, coverage),
    ...comparabilityProblems(result, coverage),
    ...summaryProblems(summary, coverage, classification),
  ]
  const remaining =
    Number(pagination.totalComponents) - Number(pagination.offset) - components.length
  if (result.omittedByLimit !== remaining) {
    problems.push(`omittedByLimit ${result.omittedByLimit} but ${remaining} rows remain`)
  }
  if (pagination.cursorOmitted !== undefined && result.nextCursor !== null) {
    problems.push('cursorOmitted is set but a cursor was returned')
  }
  if (Number(pagination.offset) === 0 && summary.trackedComponents !== pagination.totalComponents) {
    problems.push(
      `summary tracks ${summary.trackedComponents} components but the report has ${pagination.totalComponents}`,
    )
  }
  if (
    classification.affects === 'ownership-labels' &&
    classification.totalCandidates !== pagination.totalComponents
  ) {
    problems.push('appOnly:false hid components')
  }
  return problems
}

export function renderCausesProblems(result: Value): string[] {
  const coverage = record(result.coverage)
  const retention = record(result.renderEventRetention)
  const problems = coverageProblems('coverage', coverage)
  if (coverage.complete === true && Number(retention.evictedEvents) > 0) {
    problems.push(`coverage complete while ${retention.evictedEvents} events were evicted`)
  }
  if (result.sourceClassification !== undefined) {
    problems.push(
      ...classificationProblems(
        'sourceClassification',
        record(result.sourceClassification),
        coverage,
      ),
    )
  }
  return problems
}

export function rendersSinceProblems(result: Value): string[] {
  const coverage = record(result.coverage)
  const classification = record(result.sourceClassification)
  const summary = record(result.summary)
  const problems = [
    ...coverageProblems('coverage', coverage),
    ...classificationProblems('sourceClassification', classification, coverage),
  ]
  if ((summary.semantics === 'exact') !== (coverage.complete === true)) {
    problems.push(
      `summary ${String(summary.semantics)} while coverage complete ${coverage.complete}`,
    )
  }
  if (
    classification.affects === 'result' &&
    !classification.complete &&
    summary.semantics !== 'unknown'
  ) {
    problems.push(`summary semantics ${String(summary.semantics)} over unresolved membership`)
  }
  return problems
}

export function cohortProblems(result: Value): string[] {
  const coverage = record(result.coverage)
  const ownership = record(result.ownershipCoverage)
  const problems: string[] = []
  if (
    coverage.complete === true &&
    (coverage.scanTruncated === true || coverage.rootScopeComplete !== true)
  ) {
    problems.push('cohort coverage complete over a truncated scan')
  }
  if (ownership.affects === 'result' && ownership.complete === false && coverage.complete) {
    problems.push('cohort coverage complete while appOnly membership is unresolved')
  }
  if (ownership.affects !== 'result' && ownership.affects !== 'ownership-labels') {
    problems.push(`ownershipCoverage.affects is ${String(ownership.affects)}`)
  }
  const statuses =
    Number(result.mountedUpdated) +
    Number(result.mountedIdle) +
    Number(result.mountedUnknown) +
    Number(result.unmounted)
  if (statuses !== result.matched) {
    problems.push(`statuses add to ${statuses} but ${result.matched} matched`)
  }
  if (Number(result.returned) + Number(result.omittedByLimit) !== result.matched) {
    problems.push(
      `returned ${result.returned} + omitted ${result.omittedByLimit} != ${result.matched}`,
    )
  }
  return problems
}

export function rendersDiffProblems(result: Value): string[] {
  const coverage = record(result.coverage)
  return [
    ...coverageProblems('coverage.baseline', record(coverage.baseline)),
    ...coverageProblems('coverage.current', record(coverage.current)),
  ]
}
