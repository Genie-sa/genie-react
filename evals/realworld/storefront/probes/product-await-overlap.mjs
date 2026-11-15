import { serverAwaits } from './support.mjs'

const CRITICAL_PATH_BUDGET_MS = 650

/** @param {import('../../run-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  await ctx.open('/product/lark-rain-shell-2')
  await ctx.page.locator('.purchase-panel h1').waitFor()
  const pageAwaits = (await serverAwaits(ctx)).filter((entry) => entry.awaitedBy === 'ProductPage')
  if (pageAwaits.length === 0)
    throw new Error('react_suspense reported no server awaits for ProductPage')
  const firstStart = Math.min(...pageAwaits.map((entry) => entry.startMs))
  const lastEnd = Math.max(...pageAwaits.map((entry) => entry.endMs))
  const timeline = pageAwaits
    .map(
      (entry) =>
        `${entry.functions[1] ?? '?'} ${Math.round(entry.startMs)}→${Math.round(entry.endMs)}ms`,
    )
    .join(', ')
  ctx.check(
    'ProductPage server critical path',
    lastEnd - firstStart <= CRITICAL_PATH_BUDGET_MS,
    `awaited ${Math.round(lastEnd - firstStart)}ms in total (budget ${CRITICAL_PATH_BUDGET_MS}ms): ${timeline}`,
  )
  const inventory = pageAwaits.find((entry) => entry.functions.includes('getInventory'))
  const ratings = pageAwaits.find((entry) => entry.functions.includes('getRatingSummary'))
  if (inventory && ratings) {
    const overlapMs =
      Math.min(inventory.endMs, ratings.endMs) - Math.max(inventory.startMs, ratings.startMs)
    ctx.check('independent reads overlap', overlapMs > 0, `overlap ${Math.round(overlapMs)}ms`)
  }
}
