import { check } from '../harness.mjs'

const POLL_MS = 300
const QUIET_MS = 1800

const requestsTo = (events, suffix) =>
  events.filter((event) => event.domain === 'request' && event.details?.url?.endsWith(suffix))

export default async function probe({ app, session, page }) {
  await app.resetBackend({ notificationPollMs: POLL_MS })
  await session.open('/board')
  await page.locator('.board-card').first().waitFor()
  const events = await session.recordTimeline('sign-out', async () => {
    await session.call('app_sign_out')
    await page.locator('#field-email').waitFor()
    await page.waitForTimeout(QUIET_MS)
  })
  const signOut = requestsTo(events, '/api/session').at(-1)
  if (!signOut)
    return [check('timeline.signOutRequest', false, 'no /api/session request was recorded')]
  const polls = requestsTo(events, '/api/notifications').filter(
    (event) => event.details.startMs > signOut.details.endMs + POLL_MS,
  )
  const statuses = [...new Set(polls.map((event) => event.details.responseStatus))]
  return [
    check('timeline.signOutRequest', true, `sign-out request ended at ${signOut.details.endMs} ms`),
    check(
      'timeline.pollsAfterSignOut',
      polls.length === 0,
      `${polls.length} notification polls started after sign-out (statuses ${statuses.join(', ') || 'none'})`,
    ),
  ]
}
