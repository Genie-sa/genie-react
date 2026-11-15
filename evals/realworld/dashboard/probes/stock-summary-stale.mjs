import { queryState, waitForQuery } from './helpers.mjs'

const STOCK_KEY = ['dashboard', 'stock-summary']

/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/')
  await waitForQuery(ctx, STOCK_KEY)
  const before = await queryState(ctx, STOCK_KEY)
  const target = before.data.items[0]
  await ctx.page.getByRole('link', { name: 'View all' }).click()
  const row = ctx.page.locator(`tr[data-product-id="${target.productId}"]`)
  await row.waitFor()
  await ctx.settle()
  await row.getByRole('button', { name: `Adjust ${target.sku}` }).click()
  const dialog = ctx.page.getByRole('dialog')
  await dialog.getByLabel('Warehouse').selectOption('wh-reno')
  await dialog.getByLabel('Adjustment').fill(String(target.reorderPoint + 500))
  await dialog.getByRole('button', { name: 'Apply adjustment' }).click()
  await dialog.waitFor({ state: 'detached' })
  await ctx.settle()
  await ctx.page
    .getByRole('complementary', { name: 'Primary' })
    .getByRole('link', { name: 'Dashboard' })
    .click()
  await ctx.page.getByTestId('low-stock-count').waitFor()
  await ctx.settle()
  const after = await queryState(ctx, STOCK_KEY)
  ctx.check(
    'low-stock-count',
    after.data?.lowStock === before.data.lowStock - 1,
    `dashboard low-stock count after restocking ${target.sku}: ${after.data?.lowStock} (expected ${before.data.lowStock - 1}), staleTime ${after.staleTime}`,
  )
}
