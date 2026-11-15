import { waitForQuery } from './helpers.mjs'

const MAX_AVERAGE_SELF_MS = 8
const TYPED = 'Leave at dock 4, call ahead'

/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/orders/new')
  await waitForQuery(ctx, ['reference', 'products'])
  await ctx.settle()
  await ctx.clearRenders(['ProductPicker'])
  await ctx.page.getByLabel('Notes for the warehouse team').pressSequentially(TYPED)
  await ctx.quiesce()
  const renders = await ctx.genie.call('react_get_renders', {
    component: 'ProductPicker',
    limit: 5,
  })
  const picker = (renders.components ?? []).find(
    (/** @type {any} */ entry) => entry.name === 'ProductPicker',
  )
  const count = picker?.renders ?? 0
  const average = count > 0 ? (picker.cumulativeSelfTime ?? 0) / count : Number.POSITIVE_INFINITY
  ctx.check(
    'typing-observed',
    count >= TYPED.length / 2,
    `ProductPicker renders while typing ${TYPED.length} characters: ${count}`,
  )
  ctx.check(
    'render-cost',
    average < MAX_AVERAGE_SELF_MS,
    `average ProductPicker self time: ${average.toFixed(1)} ms per render (budget ${MAX_AVERAGE_SELF_MS} ms, ${renders.bundle} bundle)`,
  )
}
