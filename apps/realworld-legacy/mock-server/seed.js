'use strict'

const { createRandom, hashSeed } = require('./random')

const DEFAULT_SEED = 2019
const DAY_MS = 86_400_000
const NOW = Date.parse('2026-03-02T09:00:00.000Z')

const FIRST_NAMES = [
  'Dana',
  'Priya',
  'Marcus',
  'Lena',
  'Tomás',
  'Aiko',
  'Femi',
  'Noor',
  'Oskar',
  'Rhea',
  'Jonah',
  'Mei',
  'Kwame',
  'Sofia',
  'Idris',
  'Hana',
  'Elliot',
  'Zara',
  'Mateo',
  'Ines',
  'Ravi',
  'Greta',
  'Sami',
  'Talia',
  'Bruno',
  'Yuki',
  'Amara',
  'Felix',
  'Leila',
  'Owen',
  'Nadia',
  'Hugo',
  'Chloe',
  'Arjun',
  'Maya',
  'Theo',
]
const LAST_NAMES = [
  'Whitfield',
  'Raman',
  'Okafor',
  'Brandt',
  'Ruiz',
  'Tanaka',
  'Adeyemi',
  'Haddad',
  'Lindqvist',
  'Kapoor',
  'Mercer',
  'Chen',
  'Mensah',
  'Rossi',
  'Karimi',
  'Sato',
  'Graves',
  'Malik',
  'Herrera',
  'Duarte',
  'Iyer',
  'Vogel',
  'Nasser',
  'Levi',
  'Costa',
  'Mori',
  'Eze',
  'Novak',
  'Farah',
  'Byrne',
  'Petrova',
  'Laurent',
  'Dubois',
  'Menon',
  'Ortiz',
  'Walsh',
]
const PROJECTS = [
  { key: 'CORE', name: 'Core Platform', issueCount: 420 },
  { key: 'WEB', name: 'Web App', issueCount: 520 },
  { key: 'MOB', name: 'Mobile', issueCount: 480 },
  { key: 'OPS', name: 'Operations', issueCount: 400 },
  { key: 'DATA', name: 'Data Pipeline', issueCount: 420 },
  { key: 'SEC', name: 'Security', issueCount: 360 },
  { key: 'DOCS', name: 'Documentation', issueCount: 120, completesNothing: true },
  { key: 'INFRA', name: 'Infrastructure', issueCount: 520 },
]
const VERBS = ['Fix', 'Add', 'Refactor', 'Investigate', 'Document', 'Migrate', 'Remove', 'Speed up']
const SUBJECTS = [
  'login redirect loop',
  'webhook retries',
  'invoice export',
  'SSO metadata refresh',
  'audit log pagination',
  'billing email template',
  'rate limiter headers',
  'search ranking',
  'CSV import validation',
  'avatar upload',
  'session timeout warning',
  'dark mode contrast',
  'push notification opt-out',
  'API key rotation',
  'onboarding checklist',
  'timezone handling',
  'report scheduler',
  'permission matrix',
  'feature flag cleanup',
  'cache invalidation',
  'database connection pool',
  'Kafka consumer lag',
  'deploy pipeline caching',
  'error page copy',
  'keyboard navigation',
  'mobile deep links',
  'GDPR export',
  'password reset throttling',
  'dashboard filters',
  'attachment previews',
]
const AREAS = ['backend', 'frontend', 'design', 'infra', 'docs', 'security', 'performance']
const STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done']
const STATUS_WEIGHTS = [
  ['backlog', 3],
  ['todo', 3],
  ['in_progress', 2],
  ['in_review', 1],
  ['done', 4],
]
const PRIORITIES = [
  ['urgent', 1],
  ['high', 3],
  ['medium', 5],
  ['low', 3],
]
const COMMENT_LINES = [
  'I can reproduce this on staging with a fresh account.',
  'Pushed a draft branch, would appreciate a second pair of eyes.',
  'This regressed after the last release, bisecting now.',
  'Customer success says three accounts are affected.',
  'Moved to the next sprint, blocked on the API change.',
  'Added logs, waiting for the next occurrence.',
  'The fix is behind the new flag, rolling out to 10%.',
  'Design signed off on the copy changes.',
  'Can we split this into a backend and a frontend ticket?',
  'Verified on mobile Safari and Chrome.',
]

function iso(time) {
  return new Date(time).toISOString()
}

function buildUsers(random) {
  return FIRST_NAMES.map((first, index) => {
    const last = LAST_NAMES[index]
    return {
      id: `u-${index + 1}`,
      name: `${first} ${last}`,
      email: `${first
        .toLowerCase()
        .normalize('NFD')
        .replace(/[^a-z]/g, '')}@acme.test`,
      title: random.pick(['Engineer', 'Senior Engineer', 'Staff Engineer', 'Designer', 'PM', 'QA']),
      team: random.pick(['Platform', 'Growth', 'Payments', 'Mobile', 'Infra']),
    }
  })
}

function buildIssues(random, users) {
  const issues = []
  let sequence = 0
  for (const project of PROJECTS) {
    for (let number = 1; number <= project.issueCount; number += 1) {
      sequence += 1
      const createdAt = NOW - random.int(1, 400) * DAY_MS - random.int(0, 86_000) * 1000
      const status = project.completesNothing
        ? random.pick(STATUSES.slice(0, 4))
        : random.weighted(STATUS_WEIGHTS)
      const completedAt =
        status === 'done' ? Math.min(NOW - DAY_MS, createdAt + random.int(1, 30) * DAY_MS) : null
      const updatedAt = completedAt ?? Math.min(NOW, createdAt + random.int(0, 60) * DAY_MS)
      issues.push({
        id: `iss-${sequence}`,
        key: `${project.key}-${number}`,
        projectKey: project.key,
        title: `${random.pick(VERBS)} ${random.pick(SUBJECTS)}`,
        description: `Reported by the ${random.pick(AREAS)} team. ${random.pick(COMMENT_LINES)}`,
        status,
        priority: random.weighted(PRIORITIES),
        assigneeId: random.next() < 0.15 ? null : random.pick(users).id,
        reporterId: random.pick(users).id,
        labels: random.sample(AREAS, random.int(0, 2)),
        estimate: random.pick([1, 2, 3, 5, 8, null]),
        createdAt: iso(createdAt),
        updatedAt: iso(updatedAt),
        completedAt: completedAt === null ? null : iso(completedAt),
        commentCount: 0,
      })
    }
  }
  return issues
}

function buildComments(issue, users) {
  const random = createRandom(hashSeed(`comments:${issue.key}`))
  const count = issue.key === 'CORE-12' ? 4 : random.int(0, 6)
  const created = Date.parse(issue.createdAt)
  const comments = []
  for (let index = 0; index < count; index += 1) {
    const authorId = issue.key === 'CORE-12' && index % 2 === 0 ? 'u-1' : random.pick(users).id
    const createdAt = Math.min(NOW, created + (index + 1) * random.int(1, 5) * 3_600_000)
    comments.push({
      id: `c-${issue.key}-${index + 1}`,
      issueKey: issue.key,
      authorId,
      body: random.pick(COMMENT_LINES),
      createdAt: iso(createdAt),
      editedAt: null,
    })
  }
  return comments.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

function buildActivity(issue, users) {
  const random = createRandom(hashSeed(`activity:${issue.key}`))
  const created = Date.parse(issue.createdAt)
  const events = [
    { type: 'created', actorId: issue.reporterId, detail: 'created the issue', at: created },
  ]
  const transitions = STATUSES.slice(0, STATUSES.indexOf(issue.status) + 1)
  transitions.slice(1).forEach((status, index) => {
    events.push({
      type: 'status',
      actorId: issue.assigneeId ?? random.pick(users).id,
      detail: `moved to ${status.replace('_', ' ')}`,
      at: created + (index + 1) * random.int(4, 48) * 3_600_000,
    })
  })
  for (let index = 0; index < random.int(0, 3); index += 1) {
    events.push({
      type: 'field',
      actorId: random.pick(users).id,
      detail: random.pick(['changed the priority', 'updated the description', 'added a label']),
      at: created + random.int(1, 400) * 3_600_000,
    })
  }
  return events
    .map((event, index) => ({
      id: `a-${issue.key}-${index + 1}`,
      ...event,
      at: iso(Math.min(NOW, event.at)),
    }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

function buildNotifications(random, users, issues) {
  return users.slice(0, 6).flatMap((user) =>
    Array.from({ length: 12 }, (_, index) => {
      const issue = random.pick(issues)
      return {
        id: `n-${user.id}-${index + 1}`,
        userId: user.id,
        issueKey: issue.key,
        text: `${random.pick(users).name} ${random.pick(['commented on', 'assigned you', 'mentioned you in', 'closed'])} ${issue.key}`,
        createdAt: iso(NOW - index * random.int(1, 8) * 3_600_000),
        read: index > 3,
      }
    }),
  )
}

function createDatabase(seed = DEFAULT_SEED) {
  const random = createRandom(seed)
  const users = buildUsers(random)
  const issues = buildIssues(random, users)
  const comments = new Map()
  const activity = new Map()
  const commentsFor = (issue) => {
    if (!comments.has(issue.key)) comments.set(issue.key, buildComments(issue, users))
    return comments.get(issue.key)
  }
  for (const issue of issues) issue.commentCount = commentsFor(issue).length
  return {
    seed,
    now: NOW,
    users,
    projects: PROJECTS.map(({ key, name }) => ({ key, name })),
    issues,
    issuesByKey: new Map(issues.map((issue) => [issue.key, issue])),
    commentsFor,
    activityFor: (issue) => {
      if (!activity.has(issue.key)) activity.set(issue.key, buildActivity(issue, users))
      return activity.get(issue.key)
    },
    notifications: buildNotifications(random, users, issues),
    preferences: new Map(),
    sequence: { issue: issues.length, comment: 0, notification: 0 },
  }
}

module.exports = { createDatabase, DAY_MS, DEFAULT_SEED }
