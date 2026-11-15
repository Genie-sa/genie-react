import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAddCommentMutation, useGetIssueQuery } from '../../api/service'
import { EmptyState } from '../../components/empty-state'
import { Spinner } from '../../components/spinner'
import { FeatureGate } from '../../contexts/feature-flags'
import { ActivityLog } from './activity-log'
import { CommentComposer } from './comment-composer'
import { CommentThread } from './comment-thread'
import { IssueDescription } from './issue-description'
import { IssuePresence } from './issue-presence'
import { IssueSidebar } from './issue-sidebar'
import IssueTitleEditor from './issue-title-editor'

export function IssueDetailPage() {
  const { issueKey = '' } = useParams()
  const { data: issue, isLoading, isError } = useGetIssueQuery(issueKey)
  const [addComment, { isLoading: isPosting }] = useAddCommentMutation()
  const [commentDraft, setCommentDraft] = useState('')

  if (isLoading) return <Spinner label="Loading issue" />
  if (isError || !issue) {
    return (
      <EmptyState title="Issue not found">
        We could not find {issueKey}. <Link to="/issues">Back to all issues</Link>
      </EmptyState>
    )
  }

  const submitComment = async () => {
    await addComment({ key: issue.key, body: commentDraft }).unwrap()
    setCommentDraft('')
  }

  return (
    <article className="issue-detail">
      <div className="issue-detail__main">
        <div className="issue-detail__breadcrumbs">
          <Link to="/issues">Issues</Link> / <span className="issue-key">{issue.key}</span>
          {commentDraft && <span className="muted"> · unsaved comment</span>}
        </div>
        <IssueTitleEditor issue={issue} />
        <IssueDescription issue={issue} />
        <section className="issue-detail__section">
          <h2>Comments</h2>
          <CommentComposer
            value={commentDraft}
            onChange={setCommentDraft}
            onSubmit={submitComment}
            disabled={isPosting}
          />
          <CommentThread issueKey={issue.key} />
        </section>
        <section className="issue-detail__section">
          <h2>Activity</h2>
          <ActivityLog issueKey={issue.key} types={['created', 'status', 'field']} />
        </section>
      </div>
      <aside className="issue-detail__side">
        <IssueSidebar issue={issue} />
        <FeatureGate flag="issue-presence">
          <IssuePresence issueKey={issue.key} />
        </FeatureGate>
      </aside>
    </article>
  )
}
