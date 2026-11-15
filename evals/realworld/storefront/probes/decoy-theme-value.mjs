import { describeVerdicts, isClean, verdicts } from './support.mjs'

/** @param {import('../../run-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/category/outerwear')
  await page.locator('.product-card').first().waitFor()
  await ctx.quiesce()
  await ctx.call('react_clear_renders', { components: ['ThemeToggle'], budget: { adaptive: true } })
  await page.getByRole('button', { name: /^Cart,/ }).click()
  await page.getByRole('complementary', { name: 'Bag preview' }).waitFor()
  await ctx.quiesce()
  const drawer = await verdicts(ctx, 'ThemeToggle')
  ctx.check(
    'bag preview leaves theme consumers alone',
    drawer.updates === 0 && isClean(drawer),
    describeVerdicts('ThemeToggle', drawer),
  )
  await page.getByRole('button', { name: 'Close bag' }).click()
  await ctx.quiesce()
  await ctx.call('react_clear_renders', { components: ['ThemeToggle'], budget: { adaptive: true } })
  await page.getByRole('button', { name: 'Toggle colour theme' }).click()
  await ctx.quiesce()
  const toggle = await verdicts(ctx, 'ThemeToggle')
  ctx.check(
    'theme change renders are not flagged',
    toggle.updates === 1 && isClean(toggle),
    describeVerdicts('ThemeToggle', toggle),
  )
  await page.getByRole('button', { name: 'Toggle colour theme' }).click()
}
