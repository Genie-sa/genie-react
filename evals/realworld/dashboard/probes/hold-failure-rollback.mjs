import { queryState } from './helpers.mjs'

const LIST_KEY = ['orders', 'list', { status: 'processing' }]
const ROW = 3

/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/orders?status=processing&sort=placedAt&dir=asc')
  const rows = ctx.page.locator('[role=row][data-order-id]')
  await rows.nth(ROW).waitFor()
  await ctx.settle()
  const row = rows.nth(ROW)
  const orderId = await row.getAttribute('data-order-id')
  const number = await row.locator('a').innerText()
  await ctx.genie.call('app_inject_fault', {
    path: '/api/orders/*',
    method: 'PATCH',
    status: 503,
    message: 'Order service unavailable',
  })
  await row.getByRole('button', { name: `Actions for ${number}` }).click()
  await ctx.page.getByRole('menuitem', { name: 'Put on hold' }).click()
  await ctx.page
    .getByRole('alert')
    .filter({ hasText: `Could not update ${number}` })
    .waitFor()
  await ctx.settle()
  const list = await queryState(ctx, LIST_KEY)
  const cached = list.data?.items?.find((/** @type {any} */ item) => item.id === orderId)
  ctx.check(
    'order-in-cache',
    cached !== undefined,
    `${number} present in the processing list cache`,
  )
  ctx.check(
    'status-rolled-back',
    cached?.status === 'processing',
    `cached status of ${number} after the failed update: ${JSON.stringify(cached?.status)} (server kept "processing")`,
  )
  await ctx.genie.call('app_clear_faults', {})
}
