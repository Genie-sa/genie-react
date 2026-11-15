import { check } from '../harness.mjs'

const NOTE = 'Spike caused by the billing migration'

export default async function probe({ session, page }) {
  await session.open('/reports')
  await page.locator('.bar-chart').waitFor()
  await session.quiesce()
  await session.clearRenders(['ReportNotesList', 'Connect(ReportNotesList)'])
  const since = await session.reduxLatestSequence()
  await page.locator('input[aria-label="Report note"]').fill(NOTE)
  await page.getByRole('button', { name: 'Add note' }).click()
  await session.quiesce()
  const { records, coverage } = await session.reduxActions({
    afterSequence: since,
    typePrefix: 'reports/',
    view: 'full',
  })
  const added = records.filter((record) => record.type === 'reports/NOTE_ADDED')
  const note = added.at(-1)
  const notes = await session.reduxState(['reports', 'notes'])
  const { events } = await session.call('react_render_causes', {
    component: 'ReportNotesList',
    view: 'full',
  })
  const links = events.flatMap(
    (event) =>
      event.wrappedBy?.causes.flatMap((cause) =>
        cause.kind === 'external-store' && cause.redux ? [cause.redux] : [],
      ) ?? [],
  )
  const named = links.find((link) => link.actions.includes('reports/NOTE_ADDED'))
  const shown = await page.locator('.report-note').count()
  return [
    check(
      'redux.dispatched',
      coverage.evictedRecords === 0 && added.length === 1 && note?.payload?.note?.text === NOTE,
      `NOTE_ADDED dispatched ${added.length} time(s) with ${JSON.stringify(note?.payload?.note)}`,
    ),
    check(
      'redux.stored',
      notes.found && Array.isArray(notes.value) && notes.value.at(-1)?.text === NOTE,
      `as of action ${notes.asOfSequence} the store holds ${JSON.stringify(notes.value)}`,
    ),
    check(
      'redux.immutableUpdate',
      note?.mutation.status === 'none-detected',
      `NOTE_ADDED mutation check ${note?.mutation.status}: ${JSON.stringify(note?.mutation.findings)}`,
    ),
    check(
      'redux.rootStateChanged',
      note?.rootStateChanged === true && note.changedSlices.includes('reports'),
      `NOTE_ADDED rootStateChanged=${note?.rootStateChanged}, changedSlices ${JSON.stringify(note?.changedSlices)}`,
    ),
    check(
      'renders.namedAction',
      named !== undefined,
      `${events.length} ReportNotesList render events; the connect() wrapper's store cause names ${JSON.stringify(links)}`,
    ),
    check('dom.notes', shown === 1, `${shown} notes on screen`),
  ]
}
