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
  const swallowed = caughtErrors.filter(
    (/** @type {any} */ entry) => entry.rendered.output === 'nothing',
  )
  ctx.check(
    'no failure is hidden by a boundary that renders nothing',
    swallowed.length === 0,
    swallowed
      .map(
        (/** @type {any} */ entry) =>
          `${entry.boundaryName} renders nothing for "${entry.message}"`,
      )
      .join('; ') || 'no boundary hides a failure by rendering nothing',
  )
  const related = await page.getByTestId('related').count()
  ctx.check('related products are visible', related === 1, `related rails: ${related}`, 'control')
}
