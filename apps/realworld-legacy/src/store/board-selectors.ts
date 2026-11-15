import { createSelector } from 'reselect'
import type { IssueStatus } from '../api/types'
import type { RootState } from '.'
import { selectAllIssues } from './issue-selectors'

export const BOARD_COLUMNS: { status: IssueStatus; title: string }[] = [
  { status: 'backlog', title: 'Backlog' },
  { status: 'todo', title: 'To do' },
  { status: 'in_progress', title: 'In progress' },
  { status: 'in_review', title: 'In review' },
  { status: 'done', title: 'Done' },
]

const selectBoardIssues = createSelector(
  [
    selectAllIssues,
    (state: RootState) => state.board.projectKey,
    (state: RootState) => state.board.quickFilter,
  ],
  (issues, projectKey, quickFilter) => {
    const text = quickFilter.trim().toLowerCase()
    return issues.filter(
      (issue) =>
        issue.projectKey === projectKey && (!text || issue.title.toLowerCase().includes(text)),
    )
  },
)

export const selectCardsForColumn = createSelector(
  [selectBoardIssues, (_state: RootState, status: IssueStatus) => status],
  (issues, status) => issues.filter((issue) => issue.status === status),
)
