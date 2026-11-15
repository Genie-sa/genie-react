/**
 * Shared readers for Genie evidence used by the storefront probes.
 * @typedef {import('../../run-probes.mjs').ProbeContext} ProbeContext
 * @typedef {{ boundaryId: number, awaitedBy: string | null, startMs: number, endMs: number, durationMs: number, functions: string[] }} ServerAwait
 * @typedef {{ name: string, renders: number, updates: number, noObservedInputChange: number, functionIdentityPropRenders: number, referenceOnlyPropRenders: number, necessity: string, causeCounts?: Record<string, number> }} RenderRow
 */

/**
 * Every server-side await React recorded for the Suspense boundaries on screen, with the app functions on its await stack.
 * @param {ProbeContext} ctx
 * @returns {Promise<ServerAwait[]>}
 */
export async function serverAwaits(ctx) {
  const report = await ctx.call('react_suspense', { view: 'full', limit: 50, blockerLimit: 50 })
  return report.boundaries.flatMap((/** @type {any} */ boundary) =>
    boundary.blockers
      .filter((/** @type {any} */ blocker) => blocker.kind === 'server-io')
      .map((/** @type {any} */ blocker) => ({
        boundaryId: boundary.id,
        awaitedBy: blocker.awaitedBy?.name ?? null,
        startMs: blocker.startMs,
        endMs: blocker.endMs,
        durationMs: blocker.durationMs,
        functions: (blocker.awaitStack ?? [])
          .filter((/** @type {any} */ frame) => !frame.isLibrary)
          .map((/** @type {any} */ frame) => frame.functionName),
      })),
  )
}

/**
 * The single mounted instance of a component, or an error naming how many matched.
 * @param {ProbeContext} ctx
 * @param {string} component
 */
export async function findOne(ctx, component) {
  const { matches } = await ctx.call('react_find_components', { component, exact: true })
  if (matches.length !== 1) throw new Error(`expected one ${component}, found ${matches.length}`)
  return matches[0]
}

/**
 * Values of the component's stateful hooks, in declaration order.
 * @param {ProbeContext} ctx
 * @param {string} component
 */
export async function hookState(ctx, component) {
  const { id } = await findOne(ctx, component)
  const inspected = await ctx.call('react_inspect_component', { id, depth: 4 })
  return inspected.hooks
    .filter((/** @type {any} */ hook) => hook.stateful)
    .map((/** @type {any} */ hook) => hook.value)
}

/**
 * Render rows for every instance of a component in the current observation window. appOnly is off because client components rendered by server components carry unknown ownership.
 * @param {ProbeContext} ctx
 * @param {string} component
 * @returns {Promise<{ rows: RenderRow[], coverage: { inputAttributionComplete: boolean } }>}
 */
export async function renderRows(ctx, component) {
  const report = await ctx.call('react_get_renders', {
    nameFilter: component,
    limit: 200,
    view: 'full',
    appOnly: false,
  })
  if (report.tracking !== true) throw new Error('render tracking is off')
  return { rows: report.components, coverage: report.coverage }
}

/**
 * @param {readonly RenderRow[]} rows
 * @param {'renders' | 'updates' | 'noObservedInputChange' | 'functionIdentityPropRenders' | 'referenceOnlyPropRenders'} field
 */
export function total(rows, field) {
  return rows.reduce((sum, row) => sum + row[field], 0)
}

/**
 * Genie verdicts that would amount to flagging a component in the current window: renders without an observed input change, reference-only prop renders, an unnecessary verdict, or a hot effect.
 * @param {ProbeContext} ctx
 * @param {string} component
 */
export async function verdicts(ctx, component) {
  const { rows } = await renderRows(ctx, component)
  const audit = await ctx.call('react_effect_audit', { component, appOnly: false })
  const effects = audit.components.flatMap((/** @type {any} */ entry) => entry.effects)
  return {
    renders: total(rows, 'renders'),
    updates: total(rows, 'updates'),
    noObservedInputChange: total(rows, 'noObservedInputChange'),
    referenceOnly:
      total(rows, 'referenceOnlyPropRenders') + total(rows, 'functionIdentityPropRenders'),
    unnecessary: rows.filter((row) => row.necessity === 'unnecessary').length,
    hotEffects: effects.filter((/** @type {any} */ effect) => effect.hotness?.label === 'hot')
      .length,
    effectRuns: effects.reduce(
      (/** @type {number} */ sum, /** @type {any} */ effect) => sum + effect.fired,
      0,
    ),
  }
}

/**
 * @param {Awaited<ReturnType<typeof verdicts>>} result
 */
export function isClean(result) {
  return (
    result.noObservedInputChange === 0 &&
    result.referenceOnly === 0 &&
    result.unnecessary === 0 &&
    result.hotEffects === 0
  )
}

/**
 * @param {string} component
 * @param {Awaited<ReturnType<typeof verdicts>>} result
 */
export function describeVerdicts(component, result) {
  return `${component}: renders=${result.renders} updates=${result.updates} noObservedInputChange=${result.noObservedInputChange} referenceOnly=${result.referenceOnly} unnecessary=${result.unnecessary} hotEffects=${result.hotEffects} effectRuns=${result.effectRuns}`
}
