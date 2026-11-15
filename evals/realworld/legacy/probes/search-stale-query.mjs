import { check } from '../harness.mjs'

const QUERY = 'webhook'

export default async function probe({ session, page }) {
  await session.open('/board')
  await page.locator('.board-card').first().waitFor()
  const { latestSequence } = await session.reduxActions({ limit: 1 })
  await page.locator('input[aria-label="Search issues"]').pressSequentially(QUERY, { delay: 40 })
  await page.waitForTimeout(800)
  const { actions } = await session.reduxActions({
    sinceSequence: latestSequence,
    typePrefix: 'search/run/pending',
  })
  const sent = actions.map((action) => /"arg":"([^"]*)"/.exec(action.payload ?? '')?.[1] ?? null)
  const query = await session.reduxState('search.query')
  return [
    check(
      'redux.searchDispatched',
      actions.length > 0,
      `${actions.length} search requests dispatched`,
    ),
    check(
      'redux.searchArgument',
      sent.at(-1) === QUERY,
      `last search sent ${JSON.stringify(sent.at(-1))} after typing ${JSON.stringify(QUERY)}`,
    ),
    check('redux.searchQuery', query === QUERY, `search.query=${JSON.stringify(query)}`),
  ]
}
