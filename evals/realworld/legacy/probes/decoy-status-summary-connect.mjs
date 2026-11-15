import { check } from '../harness.mjs'

export default async function probe({ session, page }) {
  await session.open('/issues')
  await page.locator('.issue-row').first().waitFor()
  await session.clearRenders(['StatusSummary'])
  await page.locator('input[aria-label="Filter issues"]').pressSequentially('cache', { delay: 40 })
  await session.quiesce()
  const { updates, measured } = await session.renderUpdates('StatusSummary', [
    'StatusSummary',
    'Connect(StatusSummary)',
  ])
  return [
    check('renders.measured', measured, 'no commit fibers were skipped'),
    check(
      'renders.StatusSummary',
      updates === 0,
      `updates=${updates} while typing in the issue filter`,
    ),
  ]
}
