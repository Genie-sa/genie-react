import { memo } from 'react'
import type { Issue } from '../../api/types'
import { UserName } from '../../components/user-name'
import { CardMeta } from './card-meta'
import { PriorityPicker } from './priority-picker'

interface BoardCardProps {
  issue: Issue
  onOpen: (key: string) => void
}

export const BoardCard = memo(function BoardCard({ issue, onOpen }: BoardCardProps) {
  return (
    <li className="board-card" data-issue-key={issue.key}>
      <button type="button" className="board-card__title" onClick={() => onOpen(issue.key)}>
        <span className="issue-key">{issue.key}</span>
        {issue.title}
      </button>
      <div className="board-card__footer">
        <PriorityPicker issueKey={issue.key} priority={issue.priority} />
        <UserName userId={issue.assigneeId} />
      </div>
      <CardMeta issue={issue} />
    </li>
  )
})
