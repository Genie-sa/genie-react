/// <reference lib="dom" />
import { renderRows, total } from './support.mjs'

/** @param {import('../../run-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/search?q=ch')
  await page.getByTestId('search-results').waitFor()
  await ctx.quiesce()
  await ctx.call('react_clear_renders', {
    components: ['SearchResults', 'SearchResultRow'],
    budget: { adaptive: true },
  })
  await page
    .getByRole('searchbox', { name: 'Search the shop' })
    .evaluate((/** @type {HTMLInputElement} */ input) => {
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    })
  await page.keyboard.type('arcoal', { delay: 60 })
  await page.getByRole('status').filter({ hasText: 'results for “charcoal”' }).waitFor()
  await ctx.quiesce()
  const { rows, coverage } = await renderRows(ctx, 'SearchResults')
  const wasted = total(rows, 'noObservedInputChange')
  ctx.check(
    'urgent keystroke renders skip the deferred list',
    wasted === 0,
    `SearchResults rendered ${total(rows, 'renders')} times, ${wasted} with no observed input change (input attribution complete: ${coverage.inputAttributionComplete})`,
  )
}
