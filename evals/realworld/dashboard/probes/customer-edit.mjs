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
  const detail = await queryState(ctx, ['customers', 'detail', 'c-0042'])
  ctx.check(
    'detail-query-refreshed',
    detail.data?.name === RENAMED,
    `customer detail query name: ${JSON.stringify(detail.data?.name)} (expected ${JSON.stringify(RENAMED)}), dataUpdateCount ${detail.dataUpdateCount}`,
  )
}
