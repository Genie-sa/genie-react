/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/')
  await ctx.settle()
  await ctx.page.getByRole('button', { name: /Search orders/ }).click()
  const input = ctx.page.getByRole('textbox', { name: 'Search everything' })
  await input.pressSequentially('SO')
  await ctx.page.waitForTimeout(250)
  await input.pressSequentially('-105000')
  await ctx.page.waitForTimeout(2_000)
  await ctx.settle()
  const palette = await ctx.inspect('CommandPalette')
  const states = palette.hooks.filter(
    (/** @type {any} */ hook) => hook.kind === 'state' && !hook.customHooks?.length,
  )
  const term = states.find((/** @type {any} */ hook) => typeof hook.value === 'string')?.value
  const response = states.find(
    (/** @type {any} */ hook) =>
      hook.value && typeof hook.value === 'object' && 'query' in hook.value,
  )?.value
  ctx.check('term-typed', term === 'SO-105000', `palette input state: ${JSON.stringify(term)}`)
  ctx.check(
    'results-match-term',
    response?.query === term,
    `results are for ${JSON.stringify(response?.query)} while the input holds ${JSON.stringify(term)}`,
  )
}
