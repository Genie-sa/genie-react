import { check } from '../harness.mjs'

const TABLE_NAMES = ['IssueTable', 'Connect(IssueTable)', 'withRouter(Connect(IssueTable))']

export default async function probe({ session, page }) {
  await session.open('/issues')
  await page.locator('.issue-row').first().waitFor()
  await session.clearRenders(['IssueTable'])
  await page
    .locator('input[aria-label="View name"]')
    .pressSequentially('Sprint triage', { delay: 40 })
  await session.quiesce()
  const { updates, measured } = await session.renderUpdates('IssueTable', TABLE_NAMES)
  return [
    check('renders.measured', measured, 'no commit fibers were skipped'),
    check('renders.IssueTable', updates === 0, `updates=${updates} while typing a saved-view name`),
  ]
}
