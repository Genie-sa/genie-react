import { queryState } from './helpers.mjs'

const RENAMED = 'Quarry Retail Group'

/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/customers/c-0042')
  await ctx.page.getByRole('heading', { level: 1 }).waitFor()
  await ctx.settle()
  await ctx.page.getByRole('button', { name: 'Edit account' }).click()
  const dialog = ctx.page.getByRole('dialog')
  await dialog.getByLabel('Account name').fill(RENAMED)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await dialog.waitFor({ state: 'detached' })
  await ctx.settle()
  const { calls } = await ctx.genie.call('query_invalidations', { method: 'invalidateQueries' })
  const invalidation = calls.find((/** @type {any} */ call) => !call.byGenie)
  const reached = invalidation?.matched.map((/** @type {any} */ query) => query.queryHash) ?? []
  ctx.check(
    'save-invalidates-detail',
    reached.includes('["customers","detail","c-0042"]'),
    invalidation
      ? `invalidateQueries(${JSON.stringify(invalidation.filters.queryKey)}) matched ${invalidation.matchedCount} queries: ${reached.join(', ') || 'none'}${invalidation.nearMisses.length > 0 ? `; cached keys it missed: ${invalidation.nearMisses.join(', ')}` : ''}`
      : 'the save made no invalidateQueries call',
  )
  const detail = await queryState(ctx, ['customers', 'detail', 'c-0042'])
  ctx.check(
    'detail-query-refreshed',
    detail.data?.name === RENAMED,
    `customer detail query name: ${JSON.stringify(detail.data?.name)} (expected ${JSON.stringify(RENAMED)}), dataUpdateCount ${detail.dataUpdateCount}`,
  )
}
