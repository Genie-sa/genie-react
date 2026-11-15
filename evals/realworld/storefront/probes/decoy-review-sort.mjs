/// <reference lib="dom" />
import { describeVerdicts, isClean, verdicts } from './support.mjs'

/** @param {import('../../run-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/product/lark-rain-shell-2')
  await page.locator('#reviews').scrollIntoViewIfNeeded()
  const list = page.getByTestId('review-list')
  await list.waitFor()
  await ctx.quiesce()
  await ctx.call('react_clear_renders', { components: ['ReviewList'], budget: { adaptive: true } })
  await page.getByRole('combobox', { name: 'Sort' }).selectOption('lowest')
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="review-list"]')?.getAttribute('aria-busy') === 'false',
  )
  await ctx.quiesce()
  const result = await verdicts(ctx, 'ReviewList')
  ctx.check(
    're-sorting reviews is not flagged',
    isClean(result),
    describeVerdicts('ReviewList', result),
  )
  const { queries } = await ctx.call('query_list', { limit: 50 })
  const observed = queries.filter(
    (/** @type {any} */ query) => query.queryKey[0] === 'reviews' && query.observerCount > 0,
  )
  ctx.check(
    'exactly one reviews query is observed, for the new sort',
    observed.length === 1 &&
      observed[0].queryKey[2] === 'lowest' &&
      observed[0].status === 'success',
    `observed reviews queries: ${observed.map((/** @type {any} */ query) => `${JSON.stringify(query.queryKey)} ${query.status}`).join(', ')}`,
  )
}
