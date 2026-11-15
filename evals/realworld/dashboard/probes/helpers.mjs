/**
 * @typedef {import('../../lib/probe-context.mjs').ProbeContext} ProbeContext
 */

/**
 * Sums updates (re-renders, not mounts) across every instance of `component` in the current observation.
 * @param {ProbeContext} ctx
 * @param {string} component
 */
export async function countUpdates(ctx, component) {
  const renders = await ctx.genie.call('react_get_renders', { component, limit: 200 })
  const instances = (renders.components ?? []).filter(
    (/** @type {{ name: string }} */ entry) => entry.name === component,
  )
  return {
    tracking: renders.tracking === true,
    updates: instances.reduce(
      (/** @type {number} */ sum, /** @type {{ updates?: number }} */ entry) =>
        sum + (entry.updates ?? 0),
      0,
    ),
  }
}

/**
 * @param {ProbeContext} ctx
 * @param {string} component
 */
export async function cohort(ctx, component) {
  return ctx.genie.call('react_component_cohort', { component })
}

/**
 * @param {ProbeContext} ctx
 * @param {unknown[]} queryKey
 */
export async function queryState(ctx, queryKey) {
  return ctx.genie.call('query_get', { queryKey })
}

/**
 * Waits until one exact query key has settled.
 * @param {ProbeContext} ctx
 * @param {unknown[]} queryKey
 */
export async function waitForQuery(ctx, queryKey) {
  const result = await ctx.genie.call('devtools_wait', {
    condition: 'query-settled',
    queryKey,
    timeoutMs: 15_000,
  })
  if (result.ok === false) throw new Error(`Query ${JSON.stringify(queryKey)} did not settle`)
  return result
}

/**
 * Returns the effect-hook ordinal `react_effect_timeline` reports for the first effect whose custom-hook chain matches.
 * @param {{ hooks: { kind: string, customHooks?: string[] }[] }} inspection
 * @param {(customHooks: string[]) => boolean} matches
 */
export function effectOrdinal(inspection, matches) {
  const effects = inspection.hooks.filter((hook) => hook.kind === 'effect')
  const ordinal = effects.findIndex((hook) => matches(hook.customHooks ?? []))
  if (ordinal === -1) throw new Error('No matching effect hook')
  return ordinal
}
