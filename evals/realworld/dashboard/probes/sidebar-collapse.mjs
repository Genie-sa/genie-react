import { countUpdates, waitForQuery } from './helpers.mjs'

/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/')
  await waitForQuery(ctx, ['dashboard', 'summary'])
  await ctx.settle()
  await ctx.clearRenders(['StatCard'])
  await ctx.page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await ctx.page.getByRole('button', { name: 'Expand sidebar' }).waitFor()
  await ctx.quiesce()
  const { tracking, updates } = await countUpdates(ctx, 'StatCard')
  ctx.check(
    'statcard-updates',
    tracking && updates === 0,
    `StatCard updates after collapsing the sidebar: ${updates} (expected 0)`,
  )
}
