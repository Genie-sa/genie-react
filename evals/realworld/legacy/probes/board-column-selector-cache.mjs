import { check } from '../harness.mjs'

export default async function probe({ session, page }) {
  await session.open('/board')
  await page.locator('.board-card').first().waitFor()
  await session.clearRenders(['BoardColumn'])
  await page.locator('button[aria-label="Toggle sidebar"]').click()
  await session.quiesce()
  const { updates, measured, records } = await session.renderUpdates('BoardColumn')
  return [
    check('renders.measured', measured, 'no commit fibers were skipped'),
    check(
      'renders.BoardColumn',
      updates === 0,
      `updates=${updates} across ${records.length} columns after toggling the sidebar`,
    ),
  ]
}
