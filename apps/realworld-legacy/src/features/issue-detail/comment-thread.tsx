import { useGetCommentsQuery } from '../../api/service'
import { Spinner } from '../../components/spinner'
import { useAppSelector } from '../../store/hooks'
import { CommentItem } from './comment-item'

export function CommentThread({ issueKey }: { issueKey: string }) {
  const currentUserId = useAppSelector((state) => state.session.user?.id)
  const { data: comments, isLoading } = useGetCommentsQuery(issueKey)

  if (isLoading || !comments) return <Spinner label="Loading comments" />
  if (comments.length === 0) return <p className="muted">No comments yet</p>
  return (
    <ol className="comment-thread">
      {comments.map((comment, index) => (
        <CommentItem key={index} comment={comment} canEdit={comment.authorId === currentUserId} />
      ))}
    </ol>
  )
}
