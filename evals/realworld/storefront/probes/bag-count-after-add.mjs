import { findOne } from './support.mjs'

/** @param {import('../../run-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/product/willow-mug-set-3')
  await ctx.call('app_reset')
  await ctx.open('/product/willow-mug-set-3')
  const before = await findOne(ctx, 'CartButton')
  await page.getByRole('button', { name: 'Add to bag' }).click()
  await page.getByRole('status').filter({ hasText: 'Added to your bag' }).waitFor()
  await ctx.quiesce()
  const server = await ctx.call('app_store_state')
  const after = await findOne(ctx, 'CartButton')
  ctx.check(
    'header bag count reflects the accepted add',
    after.props.count === server.cart.itemCount,
    `CartButton count ${before.props.count} → ${after.props.count}; server cart itemCount=${server.cart.itemCount}`,
  )
  await ctx.call('app_reset')
}
