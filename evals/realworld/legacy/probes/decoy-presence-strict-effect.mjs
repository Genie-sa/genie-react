import { check } from '../harness.mjs'

export default async function probe({ session, page }) {
  await session.open('/issues/CORE-12')
  await page.locator('.presence li').first().waitFor()
  await session.quiesce()
  const timeline = await session.call('react_effect_timeline', {
    component: 'IssuePresence',
    limit: 50,
  })
  const audit = await session.call('react_effect_audit', { component: 'IssuePresence' })
  const effects = audit.components.find((entry) => entry.name === 'IssuePresence')?.effects ?? []
  const presence = effects.find((effect) => effect.depCount === 2)
  const stages = timeline.events
    .filter((event) => event.effectIndex === presence?.index)
    .flatMap((event) => event.timeline ?? [])
    .map((stage) => `${stage.stage}:${stage.trigger ?? '-'}`)
  const replays = stages.filter((stage) => stage.endsWith('strict-mode-replay')).length
  return [
    check(
      'effects.presenceFound',
      presence !== undefined,
      `${effects.length} effects reported on IssuePresence`,
    ),
    check('effects.cleanup', presence?.hasCleanup === true, `hasCleanup=${presence?.hasCleanup}`),
    check(
      'effects.notHot',
      presence?.hotness?.label !== 'hot',
      `hotness=${presence?.hotness?.label}`,
    ),
    check('effects.strictModeReplay', replays === 2, `stages ${stages.join(' → ')}`),
  ]
}
