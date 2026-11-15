import { countUpdates } from './helpers.mjs'

/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/orders')
  await ctx.page.locator('[role=row][data-order-id]').nth(1).waitFor()
  await ctx.settle()
  await ctx.clearRenders(['SidebarNav'])
  await ctx.page.locator('[role=row][data-order-id]').nth(1).getByRole('checkbox').check()
  await ctx.page.getByRole('toolbar', { name: 'Bulk actions' }).waitFor()
  await ctx.quiesce()
  const { tracking, updates } = await countUpdates(ctx, 'SidebarNav')
  ctx.check(
    'sidebar-updates',
    tracking && updates === 0,
    `SidebarNav updates after selecting one order: ${updates} (expected 0)`,
  )
}
