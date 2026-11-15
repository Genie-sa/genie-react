import { queryState } from './helpers.mjs'

/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/customers/c-0042')
  const related = ctx.page
    .locator('section', { hasText: 'Related accounts' })
    .getByRole('link')
    .first()
  await related.waitFor()
  await ctx.settle()
  const name = await related.innerText()
  await related.click()
  await ctx.page.getByRole('heading', { level: 1, name }).waitFor()
  await ctx.settle()
  const customerId = new URL(ctx.page.url()).pathname.split('/').at(-1) ?? ''
  const detail = await queryState(ctx, ['customers', 'detail', customerId])
  const notes = await ctx.inspect('CustomerNotes')
  const draft = notes.hooks.find(
    (/** @type {any} */ hook) => hook.kind === 'state' && !hook.customHooks?.length,
  )?.value
  ctx.check(
    'navigated',
    customerId !== 'c-0042' && typeof detail.data?.notes === 'string',
    `now viewing ${customerId}`,
  )
  ctx.check(
    'notes-match-customer',
    draft === detail.data?.notes,
    `notes editor holds ${JSON.stringify(draft)}; ${customerId} notes are ${JSON.stringify(detail.data?.notes)}`,
  )
}
