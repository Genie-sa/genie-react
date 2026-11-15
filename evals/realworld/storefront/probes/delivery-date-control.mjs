/// <reference lib="dom" />
export const options = { locale: 'de-DE' }

/** @param {import('../../run-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/')
  await page.addInitScript(() => {
    const reported = /** @type {string[]} */ ([])
    Object.assign(window, { __reportedErrors: reported })
    const original = window.reportError.bind(window)
    window.reportError = (/** @type {unknown} */ error) => {
      reported.push(String(error instanceof Error ? error.message : error))
      original(error)
    }
  })
  await ctx.open('/product/lark-rain-shell-2')
  await page.locator('.delivery-estimate').waitFor()
  await ctx.quiesce()
  const reported = await page.evaluate(
    () => /** @type {{ __reportedErrors?: string[] }} */ (window).__reportedErrors ?? [],
  )
  const hydration = reported.filter((message) => message.includes('Hydration failed'))
  ctx.check(
    'product page hydrates without regenerating the tree',
    hydration.length === 0,
    hydration[0]?.slice(0, 160) ?? 'no hydration errors reported',
    'control',
  )
  const { caughtErrors } = await ctx.call('react_error_state', {})
  ctx.check(
    'react_error_state stays silent either way',
    caughtErrors.length === 0,
    `caughtErrors=${caughtErrors.length}; Genie has no hydration evidence to assert on`,
    'control',
  )
}
