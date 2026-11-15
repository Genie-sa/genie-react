import { useState } from 'react'
import { useEditCommentMutation } from '../../api/service'
import type { Comment } from '../../api/types'
import { Button } from '../../components/button'
import { RelativeTime } from '../../components/relative-time'
import { UserName } from '../../components/user-name'

export function CommentItem({ comment, canEdit }: { comment: Comment; canEdit: boolean }) {
  const [editComment, { isLoading }] = useEditCommentMutation()
  const [isEditing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)

  return (
    <li className="comment" data-comment-id={comment.id}>
      <header className="comment__header">
        <UserName userId={comment.authorId} withAvatar />
        <RelativeTime iso={comment.createdAt} />
        {comment.editedAt && <span className="muted">(edited)</span>}
        {canEdit && !isEditing && (
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setDraft(comment.body)
              setEditing(true)
            }}
          >
            Edit
          </button>
        )}
      </header>
      {isEditing ? (
        <div className="comment__editor">
          <textarea
            aria-label="Edit comment"
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button
            size="sm"
            variant="primary"
            disabled={isLoading}
            onClick={async () => {
              await editComment({
                id: comment.id,
                issueKey: comment.issueKey,
                body: draft,
              }).unwrap()
              setEditing(false)
            }}
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <p className="comment__body">{comment.body}</p>
      )}
    </li>
  )
}
