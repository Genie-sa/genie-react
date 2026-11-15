/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/customers/c-0042')
  await ctx.page.getByRole('button', { name: 'Edit account' }).waitFor()
  await ctx.settle()
  await ctx.clearRenders()
  await ctx.page.getByRole('button', { name: 'Edit account' }).click()
  await ctx.page.getByRole('dialog').waitFor()
  await ctx.quiesce()
  const timeline = await ctx.genie.call('react_effect_timeline', {
    component: 'CustomerDetailPage',
    appOnly: true,
    limit: 200,
  })
  const reruns = (timeline.events ?? []).filter(
    (/** @type {any} */ event) =>
      event.phase === 'update' && event.execution?.status === 'observed',
  )
  ctx.check(
    'no-app-effect-reruns',
    reruns.length === 0,
    `app-owned effect re-runs reported for CustomerDetailPage: ${reruns.length} (effect ordinals ${reruns.map((/** @type {any} */ event) => event.effectIndex).join(', ') || 'none'}; its only app effect has unchanged deps)`,
  )
}
