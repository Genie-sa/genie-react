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
  const { events } = await ctx.genie.call('react_render_causes', {
    component: 'SidebarNav',
    view: 'full',
  })
  const storeEvidence = events.map(
    (
      /** @type {{ necessity: string, causes: { kind: string, changedFields?: string[] }[] }} */ event,
    ) => {
      const store = event.causes.find((cause) => cause.kind === 'external-store')
      return `${event.necessity}:${store?.changedFields?.join('+') ?? 'no-store-cause'}`
    },
  )
  ctx.check(
    'sidebar-store-cause-named',
    storeEvidence.every((/** @type {string} */ entry) => entry === 'unnecessary:selectedOrderIds'),
    `SidebarNav renders: ${storeEvidence.join(', ') || 'none'} (the store field that changed is one the sidebar never shows)`,
  )
}
