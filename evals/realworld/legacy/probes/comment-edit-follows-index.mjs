import { check } from '../harness.mjs'

const EDITED_ID = 'c-CORE-12-3'

function editingState(inspection) {
  const own = inspection.hooks.filter(
    (hook) => hook.kind === 'state' && !(hook.customHooks?.length > 0),
  )
  return own[0]?.value === true
}

export default async function probe({ session, page }) {
  await session.open('/issues/CORE-12')
  await page.locator('.comment').first().waitFor()
  const before = await page.locator('.comment').count()
  await page
    .locator(`li[data-comment-id="${EDITED_ID}"]`)
    .getByRole('button', { name: 'Edit' })
    .click()
  await page.locator('textarea[aria-label="Edit comment"]').fill('Split into CORE-40 and CORE-41')
  await page.locator('textarea[aria-label="Add a comment"]').fill('Picking this up today')
  await page.locator('.comment-composer button[type="submit"]').click()
  await page.locator('.comment').nth(before).waitFor()
  await session.quiesce()
  const editing = []
  for (const match of await session.findComponents('CommentItem')) {
    const inspection = await session.inspect(match.id)
    if (editingState(inspection)) editing.push(inspection.props.comment.id)
  }
  return [
    check(
      'inspect.editingInstances',
      editing.length === 1,
      `${editing.length} comments in edit mode`,
    ),
    check(
      'inspect.editingComment',
      editing[0] === EDITED_ID,
      `edit mode is on ${editing[0] ?? 'nothing'}, expected ${EDITED_ID}`,
    ),
  ]
}
