import { hookState } from './support.mjs'

/** @param {import('../../run-storefront-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/cart')
  await ctx.call('app_reset')
  const seeded = await ctx.call('app_seed_cart', { preset: 'low-stock' })
  const [line] = seeded.cart.lines
  if (!line || line.quantity !== line.stock)
    throw new Error('low-stock preset did not seed a full line')
  await ctx.open('/cart')
  await page.getByRole('button', { name: 'Increase quantity' }).click()
  await page.getByRole('alert').filter({ hasText: 'left' }).waitFor()
  await ctx.quiesce()

  const server = await ctx.call('app_store_state')
  const serverQuantity = server.cart.lines[0]?.quantity
  const [committedLines] = await hookState(ctx, 'CartLines')
  const clientQuantity = committedLines?.[0]?.quantity
  ctx.check(
    'rejected quantity change rolls back',
    clientQuantity === serverQuantity,
    `CartLines state quantity=${clientQuantity}, server cart quantity=${serverQuantity}, stock=${line.stock}`,
  )
  await ctx.call('app_reset')
}
