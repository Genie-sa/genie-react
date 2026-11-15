import { check } from '../harness.mjs'

const THROUGHPUT = '/api/reports/throughput'

export default async function probe({ session, page }) {
  await session.open('/reports')
  await page.locator('.bar-chart').waitFor()
  await session.quiesce()
  await session.call('app_backend_faults', {
    rules: [{ method: 'GET', path: THROUGHPUT, query: { range: '90d' }, latencyMs: 1200 }],
  })
  const since = await session.reduxLatestSequence()
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
  const { records } = await session.reduxActions({
    afterSequence: since,
    typePrefix: 'reports/',
    view: 'full',
  })
  const requestedRange = new Map(
    records
      .filter((record) => record.type === 'reports/REQUESTED' && record.parentActionId)
      .map((record) => [record.parentActionId, record.payload?.range]),
  )
  const received = records.filter((record) => record.type === 'reports/RECEIVED')
  const appliedFor = received.map((record) => requestedRange.get(record.parentActionId) ?? null)
  const { value: storedRange } = await session.reduxState(['reports', 'range'])
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
      'redux.lastReceivedMatchesRange',
      appliedFor.length > 0 && appliedFor.at(-1) === storedRange,
      `RECEIVED applied for the thunks loading ${JSON.stringify(appliedFor)}, in order; the store's range is ${JSON.stringify(storedRange)}`,
    ),
    check(
      'react.widgetRange',
      rendered === '7d',
      `ThroughputWidget renders report.range=${JSON.stringify(rendered)} after choosing 7 days`,
    ),
  ]
}
