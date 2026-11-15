import { hookState } from './support.mjs'

/** @param {import('../../run-storefront-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/product/willow-field-jacket-3')
  await page.locator('.gallery').waitFor()
  await ctx.quiesce()
  await page.getByRole('button', { name: 'Slate', exact: true }).click()
  await page.getByText('Colour: Slate').waitFor()
  await ctx.quiesce()
  await page.locator('.purchase-panel h1').click()
  await page.keyboard.press('ArrowRight')
  await ctx.quiesce()
  const [activeIndex] = await hookState(ctx, 'ProductGallery')
  const effects = await ctx.call('react_effect_timeline', {
    component: 'ProductGallery',
    limit: 50,
  })
  const runs = effects.events.filter(
    (/** @type {any} */ event) => event.execution?.status === 'observed',
  ).length
  ctx.check(
    'one arrow press advances one image',
    activeIndex === 1,
    `ProductGallery activeIndex=${activeIndex} after one ArrowRight (keydown effect ran ${runs} times, each with a cleanup)`,
  )
}
