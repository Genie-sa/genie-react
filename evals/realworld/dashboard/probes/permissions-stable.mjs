import { countUpdates } from './helpers.mjs'

/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/orders')
  await ctx.page.locator('[role=row][data-order-id]').first().waitFor()
  await ctx.settle()
  await ctx.clearRenders(['PermissionGate'])
  await ctx.page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await ctx.page.getByRole('button', { name: 'Expand sidebar' }).waitFor()
  await ctx.quiesce()
  const { tracking, updates } = await countUpdates(ctx, 'PermissionGate')
  ctx.check(
    'permission-gates-idle',
    tracking && updates === 0,
    `PermissionGate updates after collapsing the sidebar: ${updates} (expected 0)`,
  )
}
