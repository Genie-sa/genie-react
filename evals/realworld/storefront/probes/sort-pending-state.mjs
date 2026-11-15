import { renderRows } from './support.mjs'

/** @param {import('../../run-storefront-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/category/footwear')
  await page.locator('.product-card').first().waitFor()
  await ctx.quiesce()
  await ctx.call('react_clear_renders', {
    components: ['CatalogResults'],
    budget: { adaptive: true },
  })
  await page.getByLabel('Sort by').selectOption('price-asc')
  await page.waitForURL(/sort=price-asc/)
  await page
    .getByRole('status')
    .filter({ hasText: /^\d+ products$/ })
    .waitFor()
  await ctx.quiesce()
  const { rows } = await renderRows(ctx, 'CatalogResults')
  const [results] = rows
  if (!results) throw new Error('CatalogResults did not render during the sort navigation')
  ctx.check(
    'results show a pending state while the sorted page loads',
    (results.causeCounts?.context ?? 0) > 0,
    `CatalogResults renders=${results.renders}, causes=${JSON.stringify(results.causeCounts)}`,
  )
}
