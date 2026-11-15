import { effectOrdinal } from './helpers.mjs'

/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/orders/o-105000')
  await ctx.page.getByRole('heading', { name: 'SO-105000' }).waitFor()
  await ctx.settle()
  const ordinal = effectOrdinal(
    await ctx.inspect('OrderDetailPage'),
    (hooks) => hooks[0] === 'usePageView',
  )
  await ctx.clearRenders()
  await ctx.page.getByRole('button', { name: 'Edit order' }).click()
  await ctx.page.getByRole('dialog', { name: 'Edit SO-105000' }).waitFor()
  await ctx.quiesce()
  const timeline = await ctx.genie.call('react_effect_timeline', {
    component: 'OrderDetailPage',
    limit: 200,
  })
  const reruns = (timeline.events ?? []).filter(
    (/** @type {any} */ event) =>
      event.effectIndex === ordinal &&
      event.phase === 'update' &&
      event.execution?.status === 'observed',
  )
  ctx.check(
    'effect-coverage',
    timeline.coverage?.complete === true,
    `effect timeline coverage complete: ${timeline.coverage?.complete}`,
  )
  ctx.check(
    'page-view-reruns',
    reruns.length === 0,
    `usePageView effect re-ran ${reruns.length} time(s) when the edit drawer opened (expected 0)`,
  )
}
