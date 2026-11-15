import { useGetUsersQuery, useUpdateIssueMutation } from '../../api/service'
import type { Issue, IssuePriority, IssueStatus } from '../../api/types'
import { PRIORITY_LABELS, STATUS_LABELS } from '../../components/badges'
import { RelativeTime } from '../../components/relative-time'
import { UserName } from '../../components/user-name'

export function IssueSidebar({ issue }: { issue: Issue }) {
  const { data: users = [] } = useGetUsersQuery()
  const [updateIssue] = useUpdateIssueMutation()
  const update = (changes: Partial<Issue>) => updateIssue({ key: issue.key, changes })

  return (
    <dl className="issue-sidebar">
      <dt>Status</dt>
      <dd>
        <select
          aria-label="Status"
          value={issue.status}
          onChange={(event) => update({ status: event.target.value as IssueStatus })}
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </dd>
      <dt>Priority</dt>
      <dd>
        <select
          aria-label="Priority"
          value={issue.priority}
          onChange={(event) => update({ priority: event.target.value as IssuePriority })}
        >
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </dd>
      <dt>Assignee</dt>
      <dd>
        <select
          aria-label="Assignee"
          value={issue.assigneeId ?? ''}
          onChange={(event) => update({ assigneeId: event.target.value || null })}
        >
          <option value="">Unassigned</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </dd>
      <dt>Reporter</dt>
      <dd>
        <UserName userId={issue.reporterId} withAvatar />
      </dd>
      <dt>Created</dt>
      <dd>
        <RelativeTime iso={issue.createdAt} />
      </dd>
      <dt>Updated</dt>
      <dd>
        <RelativeTime iso={issue.updatedAt} />
      </dd>
    </dl>
  )
}
