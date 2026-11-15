/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/orders')
  await ctx.page.locator('[role=row][data-order-id]').first().waitFor()
  await ctx.settle()
  await ctx.clearRenders(['SyncStatus'])
  await ctx.page.waitForTimeout(2_600)
  const causes = await ctx.genie.call('react_render_causes', {
    component: 'SyncStatus',
    limit: 10,
    view: 'full',
  })
  const events = causes.events ?? []
  const unexplained = events.filter(
    (/** @type {any} */ event) =>
      event.necessity === 'unnecessary' ||
      !event.causes?.some(
        (/** @type {any} */ cause) => cause.kind === 'state' && cause.evidence === 'exact',
      ),
  )
  ctx.check('ticks-observed', events.length >= 2, `SyncStatus renders in 2.6 s: ${events.length}`)
  ctx.check(
    'ticks-attributed-to-state',
    unexplained.length === 0,
    `renders not attributed to its own clock state or marked unnecessary: ${unexplained.length}`,
  )
}
