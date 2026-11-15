import { shallowEqual } from 'react-redux'
import type { IssuePriority, IssueStatus } from '../../api/types'
import { PRIORITY_LABELS, STATUS_LABELS } from '../../components/badges'
import { Button } from '../../components/button'
import { useGetUsersQuery } from '../../api/service'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectIssuePage } from '../../store/issue-selectors'
import { filtersChanged, filtersReset, selectionCleared } from '../../store/issues'

export function IssueTableToolbar() {
  const dispatch = useAppDispatch()
  const { data: users = [] } = useGetUsersQuery()
  const projects = useAppSelector((state) => state.projects.byKey)
  const filters = useAppSelector((state) => state.issues.filters)
  const { total, selectedCount } = useAppSelector(
    (state) => ({
      total: selectIssuePage(state).total,
      selectedCount: state.issues.selectedIds.length,
    }),
    shallowEqual,
  )

  return (
    <div className="issue-toolbar">
      <input
        type="search"
        aria-label="Filter issues"
        placeholder="Filter by title or key"
        value={filters.text}
        onChange={(event) => dispatch(filtersChanged({ text: event.target.value }))}
      />
      <select
        aria-label="Status"
        value={filters.status}
        onChange={(event) =>
          dispatch(filtersChanged({ status: event.target.value as IssueStatus | 'all' }))
        }
      >
        <option value="all">Any status</option>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        aria-label="Priority"
        value={filters.priority}
        onChange={(event) =>
          dispatch(filtersChanged({ priority: event.target.value as IssuePriority | 'all' }))
        }
      >
        <option value="all">Any priority</option>
        {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        aria-label="Assignee"
        value={filters.assigneeId}
        onChange={(event) => dispatch(filtersChanged({ assigneeId: event.target.value }))}
      >
        <option value="all">Anyone</option>
        <option value="none">Unassigned</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Project"
        value={filters.projectKey}
        onChange={(event) => dispatch(filtersChanged({ projectKey: event.target.value }))}
      >
        <option value="all">All projects</option>
        {Object.values(projects).map((project) => (
          <option key={project.key} value={project.key}>
            {project.name}
          </option>
        ))}
      </select>
      <Button size="sm" variant="ghost" onClick={() => dispatch(filtersReset())}>
        Reset
      </Button>
      <span className="issue-toolbar__count">
        {total} issues{selectedCount > 0 && `, ${selectedCount} selected`}
      </span>
      {selectedCount > 0 && (
        <Button size="sm" variant="ghost" onClick={() => dispatch(selectionCleared())}>
          Clear selection
        </Button>
      )}
    </div>
  )
}
