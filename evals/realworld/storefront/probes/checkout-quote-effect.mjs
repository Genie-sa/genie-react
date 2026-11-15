/** @param {import('../../run-storefront-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/cart')
  await ctx.call('app_reset')
  await ctx.call('app_seed_cart', { preset: 'starter' })
  await ctx.open('/checkout')
  const fill = (/** @type {string} */ label, /** @type {string} */ value) =>
    page.getByLabel(label, { exact: true }).fill(value)
  await fill('Email', 'ava@example.test')
  await fill('Full name', 'Ava Lindqvist')
  await fill('Street address', '1 Harbor Way')
  await fill('City', 'Oslo')
  await fill('Postal code', '0150')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('radio', { name: /Standard/ }).waitFor()
  await ctx.quiesce()

  await ctx.call('react_clear_renders', { budget: { adaptive: true } })
  await page
    .getByLabel('Delivery instructions (optional)')
    .pressSequentially('ring bell', { delay: 40 })
  await ctx.quiesce()
  const timeline = await ctx.call('react_effect_timeline', {
    component: 'ShippingOptions',
    limit: 100,
  })
  const runs = timeline.events.filter(
    (/** @type {any} */ event) =>
      event.componentName === 'ShippingOptions' && event.execution?.status === 'observed',
  )
  ctx.check(
    'typing instructions does not re-run the quote effect',
    runs.length === 0,
    `ShippingOptions effect executed ${runs.length} times for 9 keystrokes`,
  )
  await ctx.call('app_reset')
}
