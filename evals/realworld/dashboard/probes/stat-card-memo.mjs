import { waitForQuery } from './helpers.mjs'

/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/')
  await waitForQuery(ctx, ['dashboard', 'orders-trend', 30])
  await ctx.settle()
  await ctx.clearRenders(['StatCard'])
  await ctx.page.getByLabel('Trend range').selectOption('90')
  await waitForQuery(ctx, ['dashboard', 'orders-trend', 90])
  await ctx.settle()
  const renders = await ctx.genie.call('react_get_renders', { component: 'StatCard', limit: 20 })
  const updated = (renders.components ?? []).filter(
    (/** @type {any} */ entry) => entry.name === 'StatCard' && entry.updates > 0,
  )
  const byTrend = updated.filter((/** @type {any} */ entry) =>
    entry.causes?.some(
      (/** @type {any} */ cause) => cause.kind === 'props' && cause.name === 'trend',
    ),
  )
  ctx.check(
    'only-trend-cards-update',
    updated.length === 2 && byTrend.length === 2,
    `StatCards updated: ${updated.length}, attributed to the trend prop: ${byTrend.length} (expected 2 and 2)`,
  )
}
