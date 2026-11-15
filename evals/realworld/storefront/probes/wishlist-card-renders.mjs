import { renderRows, total } from './support.mjs'

/** @param {import('../../run-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/category/knitwear')
  await ctx.call('app_reset')
  await ctx.open('/category/knitwear')
  const cards = page.locator('.product-card')
  await cards.first().waitFor()
  const cardCount = await cards.count()
  await ctx.quiesce()
  await ctx.call('react_clear_renders', { components: ['ProductCard'], budget: { adaptive: true } })
  await cards
    .first()
    .getByRole('button', { name: /^Save .* to wishlist$/ })
    .click()
  await cards
    .first()
    .getByRole('button', { name: /^Remove .* from wishlist$/ })
    .waitFor()
  await ctx.quiesce()
  const { rows } = await renderRows(ctx, 'ProductCard')
  const updated = rows.filter((row) => row.updates > 0)
  ctx.check(
    'saving one product re-renders one card',
    updated.length <= 1,
    `${updated.length} of ${cardCount} ProductCard instances updated; ${total(rows, 'functionIdentityPropRenders')} renders where only a function prop changed identity`,
  )
  await ctx.call('app_reset')
}
