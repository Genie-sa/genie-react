import { check } from '../harness.mjs'

const DRAFT = 'Document audit log pagination and retention'

/** Every class update that changed the editor's draft, from the renders that applied them. */
async function draftUpdates(session) {
  const report = await session.call('react_render_causes', {
    component: 'IssueTitleEditor',
    appOnly: false,
    view: 'full',
    limit: 500,
  })
  return report.events.flatMap((event) =>
    event.causes
      .filter((cause) => cause.kind === 'state')
      .flatMap((cause) => cause.classUpdates ?? [])
      .filter((update) => update.fields?.includes('draft')),
  )
}

export default async function probe({ session, page }) {
  await session.open('/issues/CORE-12')
  await page.locator('.comment').first().waitFor()
  await page.locator('.issue-title__display').click()
  await session.clearRenders()
  await page.locator('input[aria-label="Issue title"]').fill(DRAFT)
  const comments = await page.locator('.comment').count()
  await page.locator('textarea[aria-label="Add a comment"]').fill('Renaming to match the epic')
  await page.locator('.comment-composer button[type="submit"]').click()
  await page.locator('.comment').nth(comments).waitFor()
  await session.quiesce()
  const updates = await draftUpdates(session)
  const typed = updates.filter((update) => update.phase === 'event')
  const resets = updates.filter(
    (update) =>
      update.phase === 'lifecycle' &&
      update.lifecycle === 'componentDidUpdate' &&
      update.evidence === 'exact',
  )
  const [editor] = (await session.findComponents('IssueTitleEditor')).filter(
    (match) => match.kind === 'class',
  )
  if (!editor)
    return [check('inspect.found', false, 'no IssueTitleEditor class instance in the tree')]
  const { state } = await session.inspect(editor.id)
  return [
    check(
      'causes.typed-draft-recorded',
      typed.length > 0,
      `${typed.length} draft setState calls recorded from the input event`,
    ),
    check(
      'causes.no-lifecycle-draft-reset',
      resets.length === 0,
      resets.length === 0
        ? 'no setState from componentDidUpdate changed the draft'
        : `componentDidUpdate called setState({ draft }) at ${resets
            .map((update) => `${update.caller?.file}:${update.caller?.line}`)
            .join(', ')}`,
    ),
    check('inspect.isEditing', state?.isEditing === true, `isEditing=${state?.isEditing}`),
    check(
      'inspect.draft',
      state?.draft === DRAFT,
      `draft=${JSON.stringify(state?.draft)} after the comment refetched the issue`,
    ),
  ]
}
