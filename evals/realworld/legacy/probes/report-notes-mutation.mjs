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
  const { actions, missed } = await session.reduxActions({
    sinceSequence: latestSequence,
    typePrefix: 'reports/NOTE_ADDED',
  })
  const added = actions.at(-1)
  const later = await session.reduxActions({
    sinceSequence: added?.sequence ?? latestSequence,
    typePrefix: 'reports/',
  })
  const { updates } = await session.renderUpdates('ReportNotesList', [
    'ReportNotesList',
    'Connect(ReportNotesList)',
  ])
  const shown = await page.locator('.report-note').count()
  return [
    check(
      'redux.dispatched',
      missed === 0 && actions.length === 1 && added?.action.note?.text === NOTE,
      `NOTE_ADDED dispatched ${actions.length} time(s) with ${JSON.stringify(added?.action.note)}`,
    ),
    check(
      'redux.notes',
      notes.asOfSequence >= (added?.sequence ?? Infinity) &&
        later.actions.length === 0 &&
        Array.isArray(notes.value) &&
        notes.value.length === 1 &&
        notes.value[0].text === NOTE,
      `as of action ${notes.asOfSequence}, with ${later.actions.length} reports action(s) after NOTE_ADDED, the store holds ${JSON.stringify(notes.value)}`,
    ),
    check(
      'redux.changedSlices',
      added?.changedSlices.includes('reports'),
      `NOTE_ADDED changed ${JSON.stringify(added?.changedSlices)}`,
    ),
    check('renders.ReportNotesList', updates > 0, `ReportNotesList updates=${updates}`),
    check('dom.notes', shown === 1, `${shown} notes on screen`),
  ]
}
