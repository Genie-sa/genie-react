import { check } from '../harness.mjs'

const DRAFT = 'Document audit log pagination and retention'

export default async function probe({ session, page }) {
  await session.open('/issues/CORE-12')
  await page.locator('.comment').first().waitFor()
  await page.locator('.issue-title__display').click()
  await page.locator('input[aria-label="Issue title"]').fill(DRAFT)
  const comments = await page.locator('.comment').count()
  await page.locator('textarea[aria-label="Add a comment"]').fill('Renaming to match the epic')
  await page.locator('.comment-composer button[type="submit"]').click()
  await page.locator('.comment').nth(comments).waitFor()
  await session.quiesce()
  const [editor] = (await session.findComponents('IssueTitleEditor')).filter(
    (match) => match.kind === 'class',
  )
  if (!editor)
    return [check('inspect.found', false, 'no IssueTitleEditor class instance in the tree')]
  const { state } = await session.inspect(editor.id)
  return [
    check('inspect.isEditing', state?.isEditing === true, `isEditing=${state?.isEditing}`),
    check(
      'inspect.draft',
      state?.draft === DRAFT,
      `draft=${JSON.stringify(state?.draft)} after the comment refetched the issue`,
    ),
  ]
}
