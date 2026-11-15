import { cohort } from './helpers.mjs'

/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/customers')
  await ctx.page.locator('tr[data-customer-id]').first().waitFor()
  await ctx.settle()
  await ctx.clearRenders(['CustomerRow'])
  await ctx.page.getByRole('button', { name: 'Refresh customers' }).click()
  await ctx.settle()
  const rows = await cohort(ctx, 'CustomerRow')
  ctx.check(
    'rows-mounted',
    rows.matched === 25,
    `CustomerRow instances: ${rows.matched} (expected 25)`,
  )
  ctx.check(
    'rows-idle-after-refresh',
    rows.mountedUpdated === 0,
    `CustomerRow instances re-rendered by an unchanged refresh: ${rows.mountedUpdated} (expected 0)`,
  )
}
