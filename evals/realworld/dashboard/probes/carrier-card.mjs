import { waitForQuery } from './helpers.mjs'

/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/')
  await waitForQuery(ctx, ['dashboard', 'carriers'])
  await ctx.settle()
  const errors = await ctx.genie.call('react_error_state', {})
  const caught = errors.caughtErrors ?? []
  ctx.check(
    'no-caught-errors',
    caught.length === 0,
    caught.length === 0
      ? 'no caught render errors'
      : `caught: ${caught.map((/** @type {any} */ entry) => `${entry.throwingComponent} → ${entry.boundaryName}: ${entry.message}`).join('; ')}`,
  )
  const card = await ctx.genie.call('react_find_components', {
    component: 'CarrierPerformanceCard',
    exact: true,
  })
  ctx.check(
    'card-mounted',
    (card.matches ?? []).length > 0,
    `CarrierPerformanceCard instances mounted: ${(card.matches ?? []).length}`,
  )
}
