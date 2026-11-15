/**
 * @param {import('../../lib/probe-context.mjs').ProbeContext} ctx
 * @param {string} id
 */
async function readAllEvents(ctx, id) {
  const events = []
  let offset = 0
  for (;;) {
    const page = await ctx.genie.call('timeline_read', { id, offset })
    events.push(...(page.events ?? []))
    if (page.nextOffset === null || page.nextOffset === undefined) return events
    offset = page.nextOffset
  }
}

/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/orders')
  const link = ctx.page.locator('[role=row][data-order-id] a').first()
  await link.waitFor()
  await ctx.settle()
  const orderId = await ctx.page
    .locator('[role=row][data-order-id]')
    .first()
    .getAttribute('data-order-id')
  const recording = await ctx.genie.call('timeline_start', { name: 'open-order-detail' })
  await link.click()
  await ctx.page.getByRole('tablist', { name: 'Order sections' }).waitFor()
  await ctx.settle()
  await ctx.genie.call('timeline_stop', { id: recording.id })
  const requests = (await readAllEvents(ctx, recording.id)).filter(
    (event) => event.domain === 'request' && event.details?.url,
  )
  const find = (/** @type {string} */ suffix) =>
    requests.find(
      (event) => new URL(event.details.url).pathname === `/api/orders/${orderId}${suffix}`,
    )?.details
  const order = find('')
  const shipments = find('/shipments')
  ctx.check(
    'requests-recorded',
    Boolean(order && shipments),
    `order request ${order ? 'seen' : 'missing'}, shipments request ${shipments ? 'seen' : 'missing'}`,
  )
  if (!order || !shipments) return
  ctx.check(
    'requests-overlap',
    shipments.startMs < order.endMs,
    `shipments started at ${shipments.startMs.toFixed(1)} ms, order finished at ${order.endMs.toFixed(1)} ms (shipments must start first)`,
  )
}
