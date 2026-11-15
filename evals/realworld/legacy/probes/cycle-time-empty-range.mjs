import { check } from '../harness.mjs'

export default async function probe({ session, page }) {
  await session.open('/reports?project=DOCS')
  await page.locator('.bar-chart').waitFor()
  await session.quiesce()
  const errors = await session.call('react_error_state', {})
  const caught = errors.caughtErrors.map(
    (error) => `${error.throwingComponent} → ${error.boundaryName}: ${error.message}`,
  )
  const swallowed = errors.caughtErrors
    .filter((error) => error.rendered.output === 'nothing')
    .map((error) => `${error.boundaryName} renders nothing for "${error.message}"`)
  const titles = await page.locator('.widget h2').allTextContents()
  return [
    check('errors.caught', caught.length === 0, caught.join('; ') || 'no caught errors'),
    check(
      'errors.swallowedSilently',
      swallowed.length === 0,
      swallowed.join('; ') || 'no boundary hides a failure by rendering nothing',
    ),
    check(
      'dom.cycleTimeWidget',
      titles.includes('Cycle time'),
      `widgets on screen: ${titles.join(', ')}`,
    ),
  ]
}
