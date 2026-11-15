import { check } from '../harness.mjs'

export default async function probe({ session, page }) {
  await session.open('/issues')
  await page.locator('.issue-row').first().waitFor()
  await session.clearRenders(['ProjectNav'])
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
  ]
}
