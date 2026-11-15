import type { Middleware } from '@reduxjs/toolkit'

const CAPACITY = 300
const PREVIEW_LIMIT = 240

export interface LoggedAction {
  sequence: number
  type: string
  at: number
  payload: string | null
  changedSlices: string[]
}

const entries: LoggedAction[] = []
let sequence = 0

function preview(action: Record<string, unknown>): string | null {
  const { type: _type, ...rest } = action
  if (Object.keys(rest).length === 0) return null
  try {
    const text = JSON.stringify(rest, (_key, value: unknown) =>
      Array.isArray(value) && value.length > 5 ? `[${value.length} items]` : value,
    )
    return text.length > PREVIEW_LIMIT ? `${text.slice(0, PREVIEW_LIMIT)}…` : text
  } catch {
    return '[unserializable]'
  }
}

export const actionLogMiddleware: Middleware = (api) => (next) => (action) => {
  if (process.env.NODE_ENV === 'production' || typeof action !== 'object' || action === null) {
    return next(action)
  }
  const before = api.getState() as Record<string, unknown>
  const result = next(action)
  const after = api.getState() as Record<string, unknown>
  sequence += 1
  entries.push({
    sequence,
    type: String((action as { type?: unknown }).type),
    at: Date.now(),
    payload: preview(action as Record<string, unknown>),
    changedSlices: Object.keys(after).filter((key) => after[key] !== before[key]),
  })
  if (entries.length > CAPACITY) entries.splice(0, entries.length - CAPACITY)
  return result
}

export function readActionLog(sinceSequence = 0): LoggedAction[] {
  return entries.filter((entry) => entry.sequence > sinceSequence)
}

export function latestActionSequence(): number {
  return sequence
}
