export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done'
export type IssuePriority = 'urgent' | 'high' | 'medium' | 'low'

export interface User {
  id: string
  name: string
  email: string
  title: string
  team: string
}

export interface Project {
  key: string
  name: string
}

export interface Issue {
  id: string
  key: string
  projectKey: string
  title: string
  description: string
  status: IssueStatus
  priority: IssuePriority
  assigneeId: string | null
  reporterId: string
  labels: string[]
  estimate: number | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  commentCount: number
}

export interface Comment {
  id: string
  issueKey: string
  authorId: string
  body: string
  createdAt: string
  editedAt: string | null
}

export interface ActivityEvent {
  id: string
  type: 'created' | 'status' | 'field' | 'comment'
  actorId: string
  detail: string
  at: string
}

export interface Notification {
  id: string
  userId: string
  issueKey: string
  text: string
  createdAt: string
  read: boolean
}

export interface NotificationFeed {
  items: Notification[]
  unreadCount: number
}

export interface AppConfig {
  notificationPollMs: number
  flags: Record<string, boolean>
}

export interface Preferences {
  theme: 'light' | 'dark'
  density: 'comfortable' | 'compact'
  emailDigest: 'off' | 'daily' | 'weekly'
  displayName: string
}

export interface SearchResults {
  query: string
  total: number
  items: Issue[]
}

export type ReportRange = '7d' | '30d' | '90d'

export interface ThroughputReport {
  project: string
  range: ReportRange
  total: number
  buckets: { label: string; completed: number }[]
}

export interface CycleTimeReport {
  project: string
  range: ReportRange
  samples: { issueKey: string; days: number }[]
}

export interface WorkloadReport {
  project: string
  rows: { assigneeId: string | null; count: number }[]
}
