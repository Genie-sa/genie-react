/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/customers/c-0042')
  await ctx.page.getByRole('tab', { name: 'Recent orders' }).waitFor()
  await ctx.settle()
  await ctx.genie.call('app_set_latency', {
    rules: [{ path: '/api/customers/c-0042/orders', ms: 3_000 }],
  })
  await ctx.page.getByRole('tab', { name: 'Recent orders' }).click()
  await ctx.page.waitForTimeout(500)
  const suspense = await ctx.genie.call('react_suspense', {})
  const fallbacks = (suspense.boundaries ?? []).filter(
    (/** @type {any} */ boundary) => boundary.state === 'fallback',
  )
  const owners = fallbacks.map(
    (/** @type {any} */ boundary) => boundary.source?.functionName ?? 'unknown',
  )
  ctx.check(
    'suspense-observed',
    fallbacks.length > 0,
    `boundaries showing a fallback: ${fallbacks.length}`,
  )
  const blockers = fallbacks.flatMap((/** @type {any} */ boundary) => boundary.blockers)
  const waitsOn = blockers.map(
    (/** @type {any} */ blocker) => blocker.query?.queryHash ?? blocker.kind,
  )
  ctx.check(
    'blocker-names-query',
    waitsOn.includes('["customers","detail","c-0042","orders"]'),
    `fallback waits on: ${waitsOn.join(', ') || 'nothing'}`,
  )
  ctx.check(
    'fallback-inside-page',
    fallbacks.length > 0 &&
      owners.every((/** @type {string} */ owner) => owner === 'CustomerDetailPage'),
    `fallback boundaries are rendered by: ${owners.join(', ') || 'none'} (expected CustomerDetailPage, so the page header and tabs stay visible)`,
  )
  await ctx.genie.call('app_set_latency', {})
}
