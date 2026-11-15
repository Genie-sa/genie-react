import { check } from '../harness.mjs'

const NOTE = 'Spike caused by the billing migration'

export default async function probe({ session, page }) {
  await session.open('/reports')
  await page.locator('.bar-chart').waitFor()
  await session.quiesce()
  await session.clearRenders(['ReportNotesList'])
  const { latestSequence } = await session.reduxActions({ limit: 1 })
  await page.locator('input[aria-label="Report note"]').fill(NOTE)
  await page.getByRole('button', { name: 'Add note' }).click()
  await session.quiesce()
  const notes = await session.reduxState('reports.notes')
  const { actions } = await session.reduxActions({
    sinceSequence: latestSequence,
    typePrefix: 'reports/NOTE_ADDED',
  })
  const { updates } = await session.renderUpdates('ReportNotesList', [
    'ReportNotesList',
    'Connect(ReportNotesList)',
  ])
  const shown = await page.locator('.report-note').count()
  return [
    check(
      'redux.notes',
      Array.isArray(notes) && notes.length === 1,
      `store holds ${notes?.length} notes`,
    ),
    check(
      'redux.changedSlices',
      actions.at(-1)?.changedSlices.includes('reports'),
      `NOTE_ADDED changed ${JSON.stringify(actions.at(-1)?.changedSlices)}`,
    ),
    check('renders.ReportNotesList', updates > 0, `ReportNotesList updates=${updates}`),
    check('dom.notes', shown === 1, `${shown} notes on screen`),
  ]
}
