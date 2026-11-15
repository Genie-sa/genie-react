import { check } from '../harness.mjs'

export default async function probe({ session, page }) {
  await session.open('/board')
  await page.locator('.board-card').first().waitFor()
  await session.quiesce()
  await session.clearRenders(['BoardCard'])
  const select = page.locator('select[aria-label="Priority of CORE-3"]')
  const current = await select.inputValue()
  await select.selectOption(current === 'low' ? 'high' : 'low')
  await page.waitForResponse((response) => response.url().endsWith('/api/issues/CORE-3'))
  await session.quiesce()
  const cohort = await session.cohort('BoardCard')
  return [
    check(
      'cohort.measured',
      cohort.mountedUnknown === 0,
      `mountedUnknown=${cohort.mountedUnknown}`,
    ),
    check(
      'cohort.BoardCard',
      cohort.mountedUpdated === 1,
      `${cohort.mountedUpdated} of ${cohort.matched} cards updated after changing one card's priority`,
    ),
  ]
}
