import { check } from '../harness.mjs'

export default async function probe({ session, page }) {
  await session.open('/board')
  await page.locator('.board-card').first().waitFor()
  await session.call('app_backend_faults', {
    rules: [{ path: '/static/js/settings', latencyMs: 2500 }],
  })
  await page.locator('a.side-nav__link[href="/settings"]').click()
  await page.waitForTimeout(400)
  const suspense = await session.call('react_suspense', {})
  const topBarVisible = await page.locator('.top-bar').isVisible()
  await page.locator('.settings-page').waitFor({ timeout: 10_000 })
  const waiting = suspense.boundaries.filter((boundary) => boundary.state === 'fallback')
  const files = waiting.map((boundary) => boundary.source?.file ?? 'unknown')
  return [
    check(
      'suspense.fallbackObserved',
      waiting.length > 0,
      `${waiting.length} boundaries in fallback while the chunk loaded`,
    ),
    check(
      'suspense.boundaryInsideShell',
      files.length > 0 && files.every((file) => file.endsWith('/src/layout/app-shell.tsx')),
      `fallback boundary at ${files.join(', ')}`,
    ),
    check('dom.topBarVisible', topBarVisible, `top bar visible during load: ${topBarVisible}`),
  ]
}
