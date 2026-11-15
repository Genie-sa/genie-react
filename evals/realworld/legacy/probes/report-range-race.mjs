import { check } from '../harness.mjs'

const THROUGHPUT = '/api/reports/throughput'

export default async function probe({ session, page }) {
  await session.open('/reports')
  await page.locator('.bar-chart').waitFor()
  await session.quiesce()
  await session.call('app_backend_faults', {
    rules: [{ method: 'GET', path: THROUGHPUT, query: { range: '90d' }, latencyMs: 1200 }],
  })
  const events = await session.recordTimeline(
    'range switch',
    async () => {
      await page.getByRole('button', { name: 'Last 90 days' }).click()
      await page.getByRole('button', { name: 'Last 7 days' }).click()
      await page.waitForTimeout(2000)
    },
    { queryValues: 'plain' },
  )
  await session.quiesce()
  const requests = events
    .filter((event) => event.domain === 'request' && event.details.url.endsWith(THROUGHPUT))
    .sort((left, right) => left.details.startMs - right.details.startMs)
  const stale = requests.find(
    (event) => event.details.finishedAfterNewer && event.details.query?.includes('range=90d'),
  )
  const [widget] = await session.findComponents('ThroughputWidget')
  const inspected = widget ? await session.inspect(widget.id) : null
  const rendered = inspected?.props?.report?.range ?? null
  return [
    check(
      'timeline.responseRace',
      stale !== undefined,
      requests
        .map(
          (event) =>
            `${event.details.method} ${event.details.query} ${Math.round(event.details.startMs)}→${Math.round(event.details.endMs)}ms${event.details.finishedAfterNewer ? ' (finished after a newer request)' : ''}`,
        )
        .join('; ') || 'no throughput requests recorded',
    ),
    check(
      'react.widgetRange',
      rendered === '7d',
      `ThroughputWidget renders report.range=${JSON.stringify(rendered)} after choosing 7 days`,
    ),
  ]
}
