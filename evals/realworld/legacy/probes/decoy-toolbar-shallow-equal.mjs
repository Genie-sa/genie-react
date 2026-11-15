import { check } from '../harness.mjs'

export default async function probe({ session, page }) {
  await session.open('/issues')
  await page.locator('.issue-row').first().waitFor()
  await session.clearRenders(['IssueTableToolbar'])
  await page
    .locator('input[aria-label="View name"]')
    .pressSequentially('Sprint triage', { delay: 40 })
  await session.quiesce()
  const { updates, measured } = await session.renderUpdates('IssueTableToolbar')
  return [
    check('renders.measured', measured, 'no commit fibers were skipped'),
    check(
      'renders.IssueTableToolbar',
      updates === 0,
      `updates=${updates} while typing a saved-view name`,
    ),
  ]
}
