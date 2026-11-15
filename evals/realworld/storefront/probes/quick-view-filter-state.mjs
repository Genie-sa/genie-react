import { hookState } from './support.mjs'

/** @param {import('../../run-storefront-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/category/outerwear')
  await page.getByRole('button', { name: /^Show all \d+ colours$/ }).click()
  await page.getByRole('button', { name: 'Show fewer colours' }).waitFor()
  await ctx.quiesce()
  await ctx.call('react_clear_renders', { components: ['FilterPanel'], budget: { adaptive: true } })
  await page.locator('.product-card .card-link').first().click()
  await page.getByTestId('quick-view').waitFor()
  await ctx.quiesce()
  const cohort = await ctx.call('react_component_cohort', { component: 'FilterPanel' })
  ctx.check(
    'filters stay mounted under the quick view',
    cohort.unmounted === 0 && cohort.matched >= 1,
    `FilterPanel cohort status=${cohort.status}, matched=${cohort.matched}, unmounted=${cohort.unmounted}`,
  )
  const [showAllColors] = await hookState(ctx, 'FilterPanel')
  ctx.check(
    'expanded colour list survives',
    showAllColors === true,
    `FilterPanel showAllColors=${showAllColors}`,
  )
}
