import { renderRows, total } from './support.mjs'

/** @param {import('../../run-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/category/outerwear')
  await page.locator('.product-card').first().waitFor()
  await ctx.quiesce()
  await ctx.call('react_clear_renders', { components: ['Price'], budget: { adaptive: true } })
  await page.getByRole('button', { name: /^Cart,/ }).click()
  await page.getByRole('complementary', { name: 'Bag preview' }).waitFor()
  await ctx.quiesce()
  const { rows } = await renderRows(ctx, 'Price')
  const updated = rows.filter((row) => row.updates > 0)
  const contextUpdates = updated.reduce((sum, row) => sum + (row.causeCounts?.context ?? 0), 0)
  ctx.check(
    'opening the bag preview leaves existing prices alone',
    updated.length === 0,
    `${updated.length} Price instances updated (${contextUpdates} context-caused, ${total(rows, 'noObservedInputChange')} with no observed input change)`,
  )
}
