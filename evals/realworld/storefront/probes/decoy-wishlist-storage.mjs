import { describeVerdicts, isClean, verdicts } from './support.mjs'

/** @param {import('../../run-storefront-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/category/home')
  await ctx.call('app_reset')
  await ctx.open('/category/home')
  const firstCard = page.locator('.product-card').first()
  await firstCard.waitFor()
  await ctx.quiesce()
  await ctx.call('react_clear_renders', {
    components: ['WishlistProvider'],
    budget: { adaptive: true },
  })
  await firstCard.getByRole('button', { name: /^Save .* to wishlist$/ }).click()
  await firstCard.getByRole('button', { name: /^Remove .* from wishlist$/ }).waitFor()
  await ctx.quiesce()
  const result = await verdicts(ctx, 'WishlistProvider')
  const stored = await page.evaluate(() => localStorage.getItem('sf-wishlist'))
  ctx.check(
    'persisting the wishlist runs once per change',
    result.updates === 1 && result.effectRuns === 1 && isClean(result),
    `${describeVerdicts('WishlistProvider', result)}; stored=${stored}`,
  )
  await ctx.call('app_reset')
}
