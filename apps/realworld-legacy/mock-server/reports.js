'use strict'

const { DAY_MS } = require('./seed')

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 }

function completedWithin(db, projectKey, range) {
  const days = RANGE_DAYS[range]
  if (!days) return null
  const since = db.now - days * DAY_MS
  return db.issues.filter(
    (issue) =>
      issue.projectKey === projectKey &&
      issue.completedAt !== null &&
      Date.parse(issue.completedAt) >= since,
  )
}

function throughput(db, projectKey, range) {
  const completed = completedWithin(db, projectKey, range)
  if (!completed) return null
  const bucketDays = range === '7d' ? 1 : 7
  const bucketCount = Math.ceil(RANGE_DAYS[range] / bucketDays)
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const end = db.now - index * bucketDays * DAY_MS
    const start = end - bucketDays * DAY_MS
    return {
      label: new Date(start).toISOString().slice(0, 10),
      completed: completed.filter((issue) => {
        const at = Date.parse(issue.completedAt)
        return at >= start && at < end
      }).length,
    }
  }).reverse()
  return { project: projectKey, range, total: completed.length, buckets }
}

function cycleTime(db, projectKey, range) {
  const completed = completedWithin(db, projectKey, range)
  if (!completed) return null
  return {
    project: projectKey,
    range,
    samples: completed.map((issue) => ({
      issueKey: issue.key,
      days: Math.max(
        1,
        Math.round((Date.parse(issue.completedAt) - Date.parse(issue.createdAt)) / DAY_MS),
      ),
    })),
  }
}

function workload(db, projectKey) {
  const open = db.issues.filter(
    (issue) => issue.projectKey === projectKey && issue.status !== 'done',
  )
  const byAssignee = new Map()
  for (const issue of open) {
    const key = issue.assigneeId ?? 'unassigned'
    byAssignee.set(key, (byAssignee.get(key) ?? 0) + 1)
  }
  return {
    project: projectKey,
    rows: [...byAssignee.entries()]
      .map(([assigneeId, count]) => ({
        assigneeId: assigneeId === 'unassigned' ? null : assigneeId,
        count,
      }))
      .sort((a, b) => b.count - a.count),
  }
}

module.exports = { cycleTime, throughput, workload }
