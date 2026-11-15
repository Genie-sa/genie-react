import { check } from '../harness.mjs'

export default async function probe({ session, page }) {
  await session.open('/issues')
  await page.locator('.issue-row').first().waitFor()
  await session.clearRenders(['ProjectNav', 'Connect(ProjectNav)'])
  const since = await session.reduxLatestSequence()
  await page.locator('input[aria-label="Filter issues"]').pressSequentially('cache', { delay: 40 })
  await session.quiesce()
  const { updates, measured, records } = await session.renderUpdates('ProjectNav', [
    'Connect(ProjectNav)',
    'ProjectNav',
  ])
  const causes = records.flatMap(
    (record) => record.causes?.map((cause) => `${record.name}:${cause.kind}`) ?? [],
  )
  const { events } = await session.call('react_render_causes', {
    component: 'Connect(ProjectNav)',
    view: 'full',
  })
  const explained = events.every(
    (event) =>
      event.causes.some(
        (cause) =>
          cause.kind === 'external-store' &&
          cause.subscriptionFired === true &&
          cause.changedFields?.includes('projects'),
      ) &&
      event.wraps?.causes.some(
        (cause) => cause.kind === 'props' && cause.name === 'projects' && cause.referenceOnly,
      ),
  )
  const { events: navEvents } = await session.call('react_render_causes', {
    component: 'ProjectNav',
    view: 'full',
  })
  const named = new Set(
    navEvents.flatMap(
      (event) =>
        event.wrappedBy?.causes.flatMap((cause) =>
          cause.kind === 'external-store' ? (cause.redux?.actions ?? []) : [],
        ) ?? [],
    ),
  )
  const { records: dispatched } = await session.reduxActions({ afterSequence: since })
  // The compact cause names a change no recorded dispatch explains, such as RTK Query's own middleware dispatch, as "unrecorded change".
  const namedRecords = dispatched.filter((record) =>
    named.has(record.kind === 'unrecorded-change' ? 'unrecorded change' : record.type),
  )
  return [
    check('renders.measured', measured, 'no commit fibers were skipped'),
    check(
      'renders.ProjectNav',
      updates === 0,
      `updates=${updates} while typing in the issue filter; causes ${causes.join(', ') || 'none'}`,
    ),
    check(
      'renders.cause',
      explained,
      `${events.length} Connect(ProjectNav) render events; each must show the store selection changing projects and the wrapped ProjectNav receiving it by reference only`,
    ),
    check(
      'redux.projectsUntouched',
      updates === 0 ||
        (namedRecords.length > 0 &&
          namedRecords.every((record) => !record.changedSlices.includes('projects'))),
      `the connect() wrapper's store causes name ${JSON.stringify([...named])}; those actions changed ${JSON.stringify([...new Set(namedRecords.flatMap((record) => record.changedSlices))])}, never projects`,
    ),
  ]
}
