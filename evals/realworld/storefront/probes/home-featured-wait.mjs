import { serverAwaits } from './support.mjs'

const FEATURED_BUDGET_MS = 600

/** @param {import('../../run-storefront-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  await ctx.open('/')
  await ctx.page.getByTestId('featured').waitFor()
  await ctx.page.getByTestId('picks').waitFor()
  const awaits = await serverAwaits(ctx)
  const featured = awaits.find((entry) => entry.awaitedBy === 'FeaturedCollection')
  if (!featured) throw new Error('react_suspense reported no server await for FeaturedCollection')
  const gating = awaits.filter((entry) => entry.boundaryId === featured.boundaryId)
  const slowest = gating.reduce((max, entry) => (entry.durationMs > max.durationMs ? entry : max))
  ctx.check(
    'featured boundary waits only on its own data',
    slowest.durationMs <= FEATURED_BUDGET_MS,
    `boundary ${featured.boundaryId} revealed after ${Math.round(slowest.durationMs)}ms awaited by ${slowest.awaitedBy}; FeaturedCollection itself took ${Math.round(featured.durationMs)}ms`,
  )
}
