import { check } from '../harness.mjs'

export default async function probe({ session, page }) {
  await session.open('/issues')
  await page.locator('.issue-row').first().waitFor()
  await session.clearRenders(['IssueRow'])
  await page.locator('.issue-row input[type="checkbox"]').nth(3).click()
  await session.quiesce()
  const cohort = await session.cohort('IssueRow')
  return [
    check(
      'cohort.measured',
      cohort.mountedUnknown === 0,
      `mountedUnknown=${cohort.mountedUnknown}`,
    ),
    check(
      'cohort.IssueRow',
      cohort.mountedUpdated === 1,
      `${cohort.mountedUpdated} of ${cohort.matched} rows updated after selecting one row`,
    ),
  ]
}
