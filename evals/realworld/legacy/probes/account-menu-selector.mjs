import { check } from '../harness.mjs'

export default async function probe({ session, page }) {
  await session.open('/issues')
  await page.locator('.issue-row').first().waitFor()
  await session.clearRenders(['AccountMenu'])
  await page.locator('input[aria-label="Filter issues"]').pressSequentially('cache', { delay: 40 })
  await session.quiesce()
  const { updates, measured, records } = await session.renderUpdates('AccountMenu')
  const causes = records.flatMap(
    (record) => record.causes?.map((cause) => `${cause.kind}/${cause.evidence}`) ?? [],
  )
  return [
    check('renders.measured', measured, 'no commit fibers were skipped'),
    check(
      'renders.AccountMenu',
      updates === 0,
      `updates=${updates} while typing in the issue filter; causes ${causes.join(', ') || 'none'}`,
    ),
  ]
}
