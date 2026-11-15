import { check } from '../harness.mjs'

export default async function probe({ session, page }) {
  await session.open('/board')
  await page.locator('.board-card').first().waitFor()
  await session.quiesce()
  await session.clearRenders(['LastSyncedLabel'])
  await page.waitForTimeout(3200)
  const report = await session.call('react_get_renders', {
    component: 'LastSyncedLabel',
    view: 'full',
    appOnly: false,
  })
  const [label] = report.components.filter((entry) => entry.name === 'LastSyncedLabel')
  const causes = [
    ...new Set(label?.causes?.map((cause) => `${cause.kind}/${cause.evidence}`) ?? []),
  ]
  return [
    check('renders.ticks', (label?.updates ?? 0) >= 2, `updates=${label?.updates}`),
    check(
      'renders.stateCause',
      causes.length === 1 && causes[0] === 'state/exact',
      `causes ${causes.join(', ')}`,
    ),
    check(
      'renders.notUnnecessary',
      (label?.unnecessary ?? 0) === 0 && (label?.noObservedInputChange ?? 0) === 0,
      `unnecessary=${label?.unnecessary}, noObservedInputChange=${label?.noObservedInputChange}`,
    ),
  ]
}
