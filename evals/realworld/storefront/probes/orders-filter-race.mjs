import { hookState } from './support.mjs'

const SLOWEST_ORDERS_RESPONSE_MS = 2_000

/** @param {import('../../run-storefront-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/login')
  await ctx.call('app_reset')
  await ctx.call('app_login', { email: 'ava@example.test' })
  await ctx.open('/account/orders')
  await page.getByRole('tab', { name: 'Shipped' }).click()
  await page.waitForTimeout(SLOWEST_ORDERS_RESPONSE_MS)
  await ctx.quiesce()
  const [filter, orders] = await hookState(ctx, 'OrderHistory')
  const statuses = Array.isArray(orders)
    ? orders.map((/** @type {any} */ order) => order.status)
    : []
  const mismatched = statuses.filter((status) => status !== filter)
  ctx.check(
    'orders on screen match the selected filter',
    filter === 'shipped' && statuses.length > 0 && mismatched.length === 0,
    `filter=${filter}; ${statuses.length} orders held in state, ${mismatched.length} with another status (${[...new Set(mismatched)].join(', ')})`,
  )
  await ctx.call('app_reset')
}
