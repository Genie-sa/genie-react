import { createSelector } from 'reselect'
import type { Issue, IssueStatus } from '../api/types'
import type { RootState } from '.'
import { type IssueFilters, type IssueSort, issuesAdapter } from './issues'

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 } as const
const STATUS_RANK = { backlog: 0, todo: 1, in_progress: 2, in_review: 3, done: 4 } as const

export const { selectAll: selectAllIssues } = issuesAdapter.getSelectors(
  (state: RootState) => state.issues,
)

const selectIssueQuery = (state: RootState) => ({
  filters: state.issues.filters,
  sort: state.issues.sort,
})

function matchesFilters(issue: Issue, filters: IssueFilters): boolean {
  if (filters.status !== 'all' && issue.status !== filters.status) return false
  if (filters.priority !== 'all' && issue.priority !== filters.priority) return false
  if (filters.projectKey !== 'all' && issue.projectKey !== filters.projectKey) return false
  if (filters.assigneeId === 'none' && issue.assigneeId !== null) return false
  if (!['all', 'none'].includes(filters.assigneeId) && issue.assigneeId !== filters.assigneeId) {
    return false
  }
  if (!filters.text) return true
  const text = filters.text.toLowerCase()
  return issue.title.toLowerCase().includes(text) || issue.key.toLowerCase().includes(text)
}

function compareIssues(a: Issue, b: Issue, { field }: IssueSort): number {
  switch (field) {
    case 'priority':
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    case 'status':
      return STATUS_RANK[a.status] - STATUS_RANK[b.status]
    case 'key':
      return (
        a.projectKey.localeCompare(b.projectKey) ||
        Number(a.key.split('-')[1]) - Number(b.key.split('-')[1])
      )
    default:
      return a[field].localeCompare(b[field])
  }
}

export const selectVisibleIssues = createSelector(
  [selectAllIssues, selectIssueQuery],
  (issues, { filters, sort }) => {
    const direction = sort.direction === 'asc' ? 1 : -1
    return issues
      .filter((issue) => matchesFilters(issue, filters))
      .sort((a, b) => direction * compareIssues(a, b, sort))
  },
)

export const selectIssuePage = createSelector(
  [
    selectVisibleIssues,
    (state: RootState) => state.issues.page,
    (state: RootState) => state.issues.pageSize,
  ],
  (issues, page, pageSize) => ({
    rows: issues.slice(page * pageSize, (page + 1) * pageSize),
    total: issues.length,
    pageCount: Math.max(1, Math.ceil(issues.length / pageSize)),
  }),
)

export const selectStatusCounts = createSelector([selectAllIssues], (issues) => {
  const counts: Record<IssueStatus, number> = {
    backlog: 0,
    todo: 0,
    in_progress: 0,
    in_review: 0,
    done: 0,
  }
  for (const issue of issues) counts[issue.status] += 1
  return counts
})
