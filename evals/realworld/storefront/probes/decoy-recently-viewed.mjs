import { describeVerdicts, isClean, verdicts } from './support.mjs'

/** @param {import('../../run-storefront-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/product/lark-rain-shell-2')
  await ctx.call('app_reset')
  await ctx.open('/product/lark-rain-shell-2')
  await page.locator('.purchase-panel h1').waitFor()
  await ctx.quiesce()
  await ctx.call('react_clear_renders', { budget: { adaptive: true } })
  await page.getByRole('link', { name: 'Fernhill Supply' }).click()
  await page.getByTestId('recently-viewed').waitFor()
  await ctx.quiesce()
  const result = await verdicts(ctx, 'RecentlyViewed')
  ctx.check(
    'restoring recently viewed after mount is not flagged',
    result.renders >= 2 && isClean(result),
    describeVerdicts('RecentlyViewed', result),
  )
  const { caughtErrors } = await ctx.call('react_error_state', {})
  ctx.check(
    'home renders without caught errors',
    caughtErrors.length === 0,
    `caughtErrors=${caughtErrors.length}`,
  )
  await ctx.call('app_reset')
}
