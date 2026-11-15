import { PureComponent } from 'react'
import type { Issue } from '../../api/types'
import { PriorityBadge, StatusBadge } from '../../components/badges'
import { RelativeTime } from '../../components/relative-time'
import { UserName } from '../../components/user-name'

interface IssueRowProps {
  issue: Issue
  selected: boolean
  onToggle: () => void
  onOpen: (key: string) => void
}

export class IssueRow extends PureComponent<IssueRowProps> {
  render() {
    const { issue, selected, onToggle, onOpen } = this.props
    return (
      <tr
        className={selected ? 'issue-row issue-row--selected' : 'issue-row'}
        data-issue-key={issue.key}
      >
        <td>
          <input
            type="checkbox"
            aria-label={`Select ${issue.key}`}
            checked={selected}
            onChange={onToggle}
          />
        </td>
        <td className="issue-key">{issue.key}</td>
        <td>
          <button type="button" className="link-button" onClick={() => onOpen(issue.key)}>
            {issue.title}
          </button>
        </td>
        <td>
          <StatusBadge status={issue.status} />
        </td>
        <td>
          <PriorityBadge priority={issue.priority} />
        </td>
        <td>
          <UserName userId={issue.assigneeId} />
        </td>
        <td>
          <RelativeTime iso={issue.updatedAt} />
        </td>
      </tr>
    )
  }
}
