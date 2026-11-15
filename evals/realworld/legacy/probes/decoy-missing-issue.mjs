import { check } from '../harness.mjs'

export default async function probe({ session, page }) {
  await session.open('/issues/NOPE-404')
  await page.getByText('Issue not found').waitFor()
  await session.quiesce()
  const errors = await session.call('react_error_state', {})
  return [
    check(
      'errors.caught',
      errors.caughtErrors.length === 0,
      `${errors.caughtErrors.length} caught errors`,
    ),
    check(
      'errors.blankTreeHint',
      !errors.blankTreeHint,
      errors.blankTreeHint ?? 'no blank tree hint',
    ),
  ]
}
