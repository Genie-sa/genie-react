'use strict'

const { createFaults } = require('./faults')
const { cycleTime, throughput, workload } = require('./reports')
const { createDatabase, DEFAULT_SEED } = require('./seed')

const DEFAULT_POLL_MS = 15_000
const SEARCH_LIMIT = 8
const FEATURE_FLAGS = {
  'card-estimates': true,
  'card-labels': true,
  'inline-priority': true,
  'reports-workload': true,
  'issue-presence': true,
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body === undefined ? '' : JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new HttpError(400, 'Request body is not valid JSON'))
      }
    })
    req.on('error', reject)
  })
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function route(method, pattern, handler) {
  const names = []
  const source = pattern.replace(/:([a-zA-Z]+)/g, (_, name) => {
    names.push(name)
    return '([^/]+)'
  })
  const expression = new RegExp(`^${source}$`)
  return {
    method,
    handler,
    match(path) {
      const found = expression.exec(path)
      if (!found) return null
      return Object.fromEntries(
        names.map((name, index) => [name, decodeURIComponent(found[index + 1])]),
      )
    },
  }
}

function createMockApi({ latencyMs = 0 } = {}) {
  const faults = createFaults()
  const runtime = { db: createDatabase(), pollMs: DEFAULT_POLL_MS, latencyMs }

  const requireUser = (req) => {
    const header = req.headers.authorization ?? ''
    const userId = header.startsWith('Bearer tok-') ? header.slice('Bearer tok-'.length) : null
    const user = runtime.db.users.find((candidate) => candidate.id === userId)
    if (!user) throw new HttpError(401, 'Sign in to continue')
    return user
  }
  const findIssue = (key) => {
    const issue = runtime.db.issuesByKey.get(key)
    if (!issue) throw new HttpError(404, `Issue ${key} not found`)
    return issue
  }
  const touch = (issue) => {
    issue.updatedAt = new Date(Math.max(Date.now(), runtime.db.now)).toISOString()
  }

  const routes = [
    route('POST', '/api/session', ({ body }) => {
      const user = runtime.db.users.find((candidate) => candidate.email === body.email)
      if (!user || body.password !== 'password')
        throw new HttpError(401, 'Email or password is incorrect')
      return { token: `tok-${user.id}`, user }
    }),
    route('GET', '/api/session', ({ user }) => ({ user })),
    route('DELETE', '/api/session', () => undefined),
    route('GET', '/api/config', () => ({
      notificationPollMs: runtime.pollMs,
      flags: FEATURE_FLAGS,
    })),
    route('GET', '/api/users', () => runtime.db.users),
    route('GET', '/api/projects', () => runtime.db.projects),
    route('GET', '/api/issues', ({ query }) => {
      const project = query.get('project')
      return project
        ? runtime.db.issues.filter((issue) => issue.projectKey === project)
        : runtime.db.issues
    }),
    route('POST', '/api/issues', ({ body, user }) => {
      if (!body.title || !body.projectKey)
        throw new HttpError(422, 'Title and project are required')
      runtime.db.sequence.issue += 1
      const number =
        runtime.db.issues.filter((issue) => issue.projectKey === body.projectKey).length + 1
      const now = new Date(runtime.db.now).toISOString()
      const issue = {
        id: `iss-${runtime.db.sequence.issue}`,
        key: `${body.projectKey}-${number}`,
        projectKey: body.projectKey,
        title: body.title,
        description: body.description ?? '',
        status: 'todo',
        priority: body.priority ?? 'medium',
        assigneeId: body.assigneeId ?? null,
        reporterId: user.id,
        labels: body.labels ?? [],
        estimate: body.estimate ?? null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        commentCount: 0,
      }
      runtime.db.issues.push(issue)
      runtime.db.issuesByKey.set(issue.key, issue)
      return issue
    }),
    route('GET', '/api/issues/:key', ({ params }) => findIssue(params.key)),
    route('PATCH', '/api/issues/:key', ({ params, body }) => {
      const issue = findIssue(params.key)
      for (const field of [
        'title',
        'description',
        'status',
        'priority',
        'assigneeId',
        'estimate',
      ]) {
        if (field in body) issue[field] = body[field]
      }
      touch(issue)
      return issue
    }),
    route('GET', '/api/issues/:key/comments', ({ params }) =>
      runtime.db.commentsFor(findIssue(params.key)),
    ),
    route('POST', '/api/issues/:key/comments', ({ params, body, user }) => {
      const issue = findIssue(params.key)
      if (!body.body?.trim()) throw new HttpError(422, 'Comment cannot be empty')
      runtime.db.sequence.comment += 1
      const comment = {
        id: `c-new-${runtime.db.sequence.comment}`,
        issueKey: issue.key,
        authorId: user.id,
        body: body.body.trim(),
        createdAt: new Date(runtime.db.now + runtime.db.sequence.comment * 1000).toISOString(),
        editedAt: null,
      }
      runtime.db.commentsFor(issue).unshift(comment)
      issue.commentCount += 1
      touch(issue)
      return comment
    }),
    route('PATCH', '/api/comments/:id', ({ params, body }) => {
      const comment = runtime.db.issues
        .flatMap((issue) => runtime.db.commentsFor(issue))
        .find((candidate) => candidate.id === params.id)
      if (!comment) throw new HttpError(404, 'Comment not found')
      comment.body = body.body
      comment.editedAt = new Date(runtime.db.now).toISOString()
      return comment
    }),
    route('GET', '/api/issues/:key/activity', ({ params, query }) => {
      const types = query.get('types')?.split(',').filter(Boolean)
      const events = runtime.db.activityFor(findIssue(params.key))
      return types?.length ? events.filter((event) => types.includes(event.type)) : events
    }),
    route('GET', '/api/search', ({ query }) => {
      const text = (query.get('q') ?? '').trim().toLowerCase()
      const matches = text
        ? runtime.db.issues.filter(
            (issue) => issue.title.toLowerCase().includes(text) || issue.key.toLowerCase() === text,
          )
        : [...runtime.db.issues].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      return { query: text, total: matches.length, items: matches.slice(0, SEARCH_LIMIT) }
    }),
    route('GET', '/api/notifications', ({ user }) => {
      const items = runtime.db.notifications
        .filter((notification) => notification.userId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return { items, unreadCount: items.filter((item) => !item.read).length }
    }),
    route('POST', '/api/notifications/read', ({ body, user }) => {
      for (const notification of runtime.db.notifications) {
        if (notification.userId === user.id && (!body.ids || body.ids.includes(notification.id))) {
          notification.read = true
        }
      }
      return { ok: true }
    }),
    route(
      'GET',
      '/api/preferences',
      ({ user }) =>
        runtime.db.preferences.get(user.id) ?? {
          theme: 'light',
          density: 'comfortable',
          emailDigest: 'daily',
          displayName: user.name,
        },
    ),
    route('PUT', '/api/preferences', ({ body, user }) => {
      runtime.db.preferences.set(user.id, body)
      return body
    }),
    route('GET', '/api/reports/throughput', ({ query }) => {
      const report = throughput(runtime.db, query.get('project'), query.get('range'))
      if (!report) throw new HttpError(400, 'Unknown range')
      return report
    }),
    route('GET', '/api/reports/cycle-time', ({ query }) => {
      const report = cycleTime(runtime.db, query.get('project'), query.get('range'))
      if (!report) throw new HttpError(400, 'Unknown range')
      return report
    }),
    route('GET', '/api/reports/workload', ({ query }) =>
      workload(runtime.db, query.get('project')),
    ),
  ]

  const control = [
    route('POST', '/api/__control/reset', ({ body }) => {
      runtime.db = createDatabase(body.seed ?? DEFAULT_SEED)
      runtime.pollMs = body.notificationPollMs ?? DEFAULT_POLL_MS
      faults.clear()
      return {
        seed: runtime.db.seed,
        issues: runtime.db.issues.length,
        notificationPollMs: runtime.pollMs,
      }
    }),
    route('GET', '/api/__control/faults', () => ({ rules: faults.list() })),
    route('PUT', '/api/__control/faults', ({ body }) => {
      faults.replace(Array.isArray(body.rules) ? body.rules : [])
      return { rules: faults.list() }
    }),
    route('POST', '/api/__control/notify', ({ body }) => {
      runtime.db.sequence.notification += 1
      const notification = {
        id: `n-new-${runtime.db.sequence.notification}`,
        userId: body.userId ?? 'u-1',
        issueKey: body.issueKey ?? 'CORE-1',
        text: body.text ?? 'You have a new notification',
        createdAt: new Date(runtime.db.now + runtime.db.sequence.notification * 1000).toISOString(),
        read: false,
      }
      runtime.db.notifications.push(notification)
      return notification
    }),
  ]

  return async function mockApi(req, res, next) {
    const url = new URL(req.url, 'http://mock.local')
    const fault = faults.take(req.method, url.pathname, url.searchParams)
    const isApi = url.pathname.startsWith('/api/')
    const wait =
      (fault?.latencyMs ?? 0) +
      (isApi && !url.pathname.startsWith('/api/__control') ? runtime.latencyMs : 0)
    if (wait > 0) await delay(wait)
    if (fault?.status) return sendJson(res, fault.status, { message: `Injected ${fault.status}` })
    if (!isApi) return next()
    const isControl = url.pathname.startsWith('/api/__control/')
    for (const candidate of isControl ? control : routes) {
      if (candidate.method !== req.method) continue
      const params = candidate.match(url.pathname)
      if (!params) continue
      try {
        const body = req.method === 'GET' ? {} : await readBody(req)
        const isPublic =
          isControl ||
          (candidate.method === 'POST' && url.pathname === '/api/session') ||
          url.pathname === '/api/config'
        const user = isPublic ? null : requireUser(req)
        const result = await candidate.handler({ params, query: url.searchParams, body, user })
        return sendJson(res, result === undefined ? 204 : 200, result)
      } catch (error) {
        const status = error instanceof HttpError ? error.status : 500
        return sendJson(res, status, {
          message: error instanceof Error ? error.message : 'Unexpected error',
        })
      }
    }
    return sendJson(res, 404, { message: `No mock route for ${req.method} ${url.pathname}` })
  }
}

module.exports = { createMockApi }
