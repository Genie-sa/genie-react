import { check } from '../harness.mjs'

const QUERY = 'webhook'

export default async function probe({ session, page }) {
  await session.open('/board')
  await page.locator('.board-card').first().waitFor()
  const events = await session.recordTimeline(
    'global search',
    async () => {
      await page
        .locator('input[aria-label="Search issues"]')
        .pressSequentially(QUERY, { delay: 40 })
      await page.waitForTimeout(800)
    },
    { queryValues: 'plain' },
  )
  const searches = events.filter(
    (event) => event.domain === 'request' && event.details.url.endsWith('/api/search'),
  )
  const last = searches.at(-1)
  return [
    check('timeline.searchSent', searches.length > 0, `${searches.length} search requests sent`),
    check(
      'timeline.searchQuery',
      last?.details.query === `?q=${QUERY}`,
      `last ${last?.details.method ?? '?'} /api/search sent query ${JSON.stringify(last?.details.query ?? null)} after typing ${JSON.stringify(QUERY)}`,
    ),
  ]
}
