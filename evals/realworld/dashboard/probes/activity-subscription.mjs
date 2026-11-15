import { effectOrdinal } from './helpers.mjs'

/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/orders')
  const rows = ctx.page.locator('[role=row][data-order-id]')
  await rows.nth(1).waitFor()
  await ctx.settle()
  let ordinal = -1
  for (const index of [0, 1]) {
    await rows.nth(index).locator('a').click()
    await ctx.page.getByRole('tab', { name: 'Activity' }).click()
    await ctx.page.getByRole('tab', { name: 'Activity', selected: true }).waitFor()
    await ctx.settle()
    if (ordinal === -1)
      ordinal = effectOrdinal(await ctx.inspect('OrderActivityTab'), (hooks) => hooks.length === 0)
    await ctx.page.getByRole('link', { name: 'All orders' }).click()
    await rows.nth(1).waitFor()
    await ctx.settle()
  }
  const live = await ctx.genie.call('app_live_updates', {})
  const orderTopics = Object.entries(live.topics ?? {}).filter(([topic]) =>
    topic.startsWith('order:'),
  )
  ctx.check(
    'no-orphaned-listeners',
    orderTopics.length === 0,
    `order listeners still subscribed after leaving: ${JSON.stringify(Object.fromEntries(orderTopics))}`,
  )
  const timeline = await ctx.genie.call('react_effect_timeline', {
    component: 'OrderActivityTab',
    limit: 200,
  })
  const runs = (timeline.events ?? []).filter(
    (/** @type {any} */ event) =>
      event.effectIndex === ordinal && event.execution?.status === 'observed',
  )
  const withoutCleanup = runs.filter(
    (/** @type {any} */ event) => event.cleanupExecution?.reason === 'no-cleanup-returned',
  )
  ctx.check(
    'subscribe-effect-cleans-up',
    runs.length > 0 && withoutCleanup.length === 0,
    `subscribe effect runs: ${runs.length}, runs that returned no cleanup: ${withoutCleanup.length}`,
  )
}
