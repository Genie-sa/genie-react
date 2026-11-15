import { findOne } from './support.mjs'

const STATIC_SECTIONS = [
  'ProductInfo',
  'ProductDescription',
  'SpecificationTable',
  'CareInstructions',
]

/** @param {import('../../run-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  await ctx.open('/product/lark-rain-shell-2')
  await ctx.page.locator('.spec-table').waitFor()
  await findOne(ctx, 'ProductDetails')
  for (const component of STATIC_SECTIONS) {
    const { matches } = await ctx.call('react_find_components', { component, exact: true })
    ctx.check(
      `${component} stays on the server`,
      matches.length === 0,
      `${component}: ${matches.length} client fiber(s)`,
    )
  }
  const specRows = await ctx.page.locator('.spec-table dt').count()
  ctx.check(
    'specifications still render',
    specRows > 0,
    `${specRows} specification rows`,
    'control',
  )
}
