const RELATED_STREAM_SETTLE_MS = 1_000

/** @param {import('../../run-storefront-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/product/harbor-weekender-1')
  await page.locator('.purchase-panel h1').waitFor()
  await page.waitForTimeout(RELATED_STREAM_SETTLE_MS)
  await ctx.quiesce()
  const { caughtErrors } = await ctx.call('react_error_state', {})
  ctx.check(
    'no section is replaced by an error boundary',
    caughtErrors.length === 0,
    caughtErrors.length === 0
      ? 'no caught errors'
      : caughtErrors
          .map(
            (/** @type {any} */ entry) =>
              `${entry.boundaryName} caught "${entry.message}" from ${entry.throwingComponent}`,
          )
          .join('; '),
  )
  const related = await page.getByTestId('related').count()
  ctx.check('related products are visible', related === 1, `related rails: ${related}`, 'control')
}
