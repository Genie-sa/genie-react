import { check } from '../harness.mjs'

const TEXT = 'Looks good to me'

export default async function probe({ session, page }) {
  await session.open('/issues/CORE-12')
  await page.locator('.activity-log__event').first().waitFor()
  await session.quiesce()
  await session.clearRenders(['ActivityLog'])
  const events = await session.recordTimeline('comment-typing', async () => {
    await page
      .locator('textarea[aria-label="Add a comment"]')
      .pressSequentially(TEXT, { delay: 30 })
    await page.waitForTimeout(500)
  })
  const fetches = events.filter(
    (event) =>
      event.domain === 'request' && event.details?.url?.endsWith('/api/issues/CORE-12/activity'),
  )
  const audit = await session.call('react_effect_audit', { component: 'ActivityLog' })
  const effect = audit.components
    .find((entry) => entry.name === 'ActivityLog')
    ?.effects.find((entry) => entry.customHooks?.[0] === 'useActivity')
  return [
    check(
      'timeline.activityRequests',
      fetches.length === 0,
      `${fetches.length} activity requests while typing ${TEXT.length} characters`,
    ),
    check(
      'effects.ActivityLog',
      (effect?.fired ?? 0) === 0,
      `effect fired=${effect?.fired}, lastChangedDep=${effect?.lastChangedDep}, hotness=${effect?.hotness?.label}`,
    ),
    check(
      'effects.ActivityLog.hotness',
      effect !== undefined && effect.hotness.label !== 'hot',
      `useActivity effect hotness=${effect?.hotness?.label} (${effect?.hotness?.basis}, ${JSON.stringify(effect?.hotness?.reruns)})`,
    ),
  ]
}
