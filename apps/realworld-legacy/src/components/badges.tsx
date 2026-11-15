import type { IssuePriority, IssueStatus } from '../api/types'

export const STATUS_LABELS: Record<IssueStatus, string> = {
  backlog: 'Backlog',
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  done: 'Done',
}

export const PRIORITY_LABELS: Record<IssuePriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export function StatusBadge({ status }: { status: IssueStatus }) {
  return <span className={`badge badge--status-${status}`}>{STATUS_LABELS[status]}</span>
}

export function PriorityBadge({ priority }: { priority: IssuePriority }) {
  return <span className={`badge badge--priority-${priority}`}>{PRIORITY_LABELS[priority]}</span>
}
