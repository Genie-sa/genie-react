import { cohort } from './helpers.mjs'

/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/orders')
  const rows = ctx.page.locator('[role=row][data-order-id]')
  await rows.nth(1).waitFor()
  await ctx.settle()
  await ctx.clearRenders(['OrderRow'])
  await rows.nth(1).getByRole('checkbox').check()
  await ctx.quiesce()
  const result = await cohort(ctx, 'OrderRow')
  ctx.check(
    'one-row-updated',
    result.mountedUpdated === 1,
    `OrderRow instances re-rendered by selecting one order: ${result.mountedUpdated} of ${result.matched} (expected 1)`,
  )
}
