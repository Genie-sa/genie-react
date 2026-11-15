import { useState } from 'react'
import { useUpdateIssueMutation } from '../../api/service'
import type { Issue } from '../../api/types'
import { Button } from '../../components/button'

export function IssueDescription({ issue }: { issue: Issue }) {
  const [updateIssue, { isLoading }] = useUpdateIssueMutation()
  const [draft, setDraft] = useState<string | null>(null)

  if (draft === null) {
    return (
      <div className="issue-description">
        <p>{issue.description || <span className="muted">No description</span>}</p>
        <Button size="sm" variant="ghost" onClick={() => setDraft(issue.description)}>
          Edit description
        </Button>
      </div>
    )
  }

  return (
    <div className="issue-description issue-description--editing">
      <textarea
        aria-label="Description"
        rows={5}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <Button
        size="sm"
        variant="primary"
        disabled={isLoading}
        onClick={async () => {
          await updateIssue({ key: issue.key, changes: { description: draft } }).unwrap()
          setDraft(null)
        }}
      >
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
        Cancel
      </Button>
    </div>
  )
}
