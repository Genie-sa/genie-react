import { check } from '../harness.mjs'

export default async function probe({ session, page }) {
  await session.open('/reports')
  await page.locator('.bar-chart').waitFor()
  await session.quiesce()
  await session.call('app_backend_faults', {
    rules: [
      { method: 'GET', path: '/api/reports/throughput', query: { range: '90d' }, latencyMs: 1200 },
    ],
  })
  await page.getByRole('button', { name: 'Last 90 days' }).click()
  await page.getByRole('button', { name: 'Last 7 days' }).click()
  await page.waitForTimeout(2000)
  const reports = await session.reduxState('reports')
  const shown = await page.locator('.bar-chart').getAttribute('data-range')
  return [
    check('redux.range', reports.range === '7d', `reports.range=${reports.range}`),
    check(
      'redux.throughputRange',
      reports.throughput?.range === '7d',
      `reports.throughput.range=${reports.throughput?.range}`,
    ),
    check('dom.chartRange', shown === '7d', `chart shows ${shown}`),
  ]
}
