export const options = { locale: 'de-DE' }

const MISMATCHES = new Set(['text-mismatch', 'html-mismatch'])

/** @param {import('../../run-storefront-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/product/lark-rain-shell-2')
  await page.locator('.delivery-estimate').waitFor()
  await ctx.quiesce()
  const hydration = await ctx.call('react_hydration', {})
  if (hydration.coverage.hydrationInProgress)
    throw new Error('react_hydration reports hydration still in progress after quiescence')
  const mismatches = hydration.reports.filter((/** @type {any} */ report) =>
    MISMATCHES.has(report.kind),
  )
  const first = mismatches[0]
  ctx.check(
    'product page hydrates without a mismatch',
    mismatches.length === 0,
    first
      ? `${first.kind} in <${first.component?.name ?? '?'}>: server ${JSON.stringify(first.differences[0]?.server)}, client ${JSON.stringify(first.differences[0]?.client)}`
      : 'no hydration mismatch reported',
  )
  const regenerated = hydration.clientRendered.filter((/** @type {any} */ entry) =>
    entry.reportIndexes.some((/** @type {number} */ index) =>
      mismatches.some((/** @type {any} */ report) => report.index === index),
    ),
  )
  ctx.check(
    'no server HTML discarded because of a mismatch',
    regenerated.length === 0,
    regenerated.map((/** @type {any} */ entry) => `${entry.scope} ${entry.name}`).join(', ') ||
      'no boundary was rendered again on the client after a mismatch',
  )
}
