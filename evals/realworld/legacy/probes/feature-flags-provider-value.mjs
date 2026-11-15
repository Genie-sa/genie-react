import { check } from '../harness.mjs'

export default async function probe({ session, page }) {
  await session.open('/board')
  await page.locator('.board-card').first().waitFor()
  await session.clearRenders(['FeatureGate'])
  await page.locator('button[aria-label="Toggle sidebar"]').click()
  await session.quiesce()
  const { totalUpdates, measured, records } = await session.renderUpdates('FeatureGate')
  const contextCauses = records.filter((record) =>
    record.causes?.some((cause) => cause.kind === 'context'),
  ).length
  return [
    check('renders.measured', measured, 'no commit fibers were skipped'),
    check(
      'renders.FeatureGate',
      totalUpdates === 0,
      `updates=${totalUpdates}, ${contextCauses} of the first ${records.length} gates attributed to a context change, after toggling the sidebar`,
    ),
  ]
}
