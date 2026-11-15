import { cohort } from './helpers.mjs'

/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/orders?status=processing')
  const rows = ctx.page.locator('[role=row][data-order-id]')
  await rows.nth(3).waitFor()
  await ctx.settle()
  const row = rows.nth(3)
  const number = await row.locator('a').innerText()
  await ctx.clearRenders(['OrderRow'])
  await row.getByRole('button', { name: `Actions for ${number}` }).click()
  await ctx.page.getByRole('menuitem', { name: 'Put on hold' }).click()
  await ctx.page
    .getByRole('status')
    .filter({ hasText: `${number} updated` })
    .waitFor()
  await ctx.settle()
  const result = await cohort(ctx, 'OrderRow')
  ctx.check('rows-mounted', result.matched > 10, `OrderRow instances: ${result.matched}`)
  ctx.check(
    'only-changed-row-updates',
    result.mountedUpdated === 1,
    `OrderRow instances re-rendered when ${number} went on hold: ${result.mountedUpdated} (expected 1)`,
  )
}
