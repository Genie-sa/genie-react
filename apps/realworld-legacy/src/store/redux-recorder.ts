import type { Middleware } from '@reduxjs/toolkit'

const CAPACITY = 500
const ACTION_LIMITS: CopyLimits = { depth: 6, items: 25, nodes: 400, text: 300 }

export interface CopyLimits {
  depth: number
  items: number
  nodes: number
  text: number
}

export interface RecordedAction {
  sequence: number
  at: number
  type: string
  /** A bounded copy taken at dispatch, so a later change to the action object cannot rewrite the record. */
  action: unknown
  truncated: boolean
  /** Top-level slices whose reference changed; empty means no subscriber saw the action. */
  changedSlices: string[]
}

const recorded: RecordedAction[] = []
let latestSequence = 0

/** Development-only: records every plain action that reaches the reducers. Place it after the thunk middleware, so a thunk appears as the actions it dispatches. */
export const actionRecorder: Middleware = (store) => (next) => (action) => {
  if (process.env.NODE_ENV === 'production' || !isAction(action)) return next(action)
  const before: unknown = store.getState()
  const result = next(action)
  const after: unknown = store.getState()
  const { value, truncated } = boundedCopy(action, ACTION_LIMITS)
  latestSequence += 1
  recorded.push({
    sequence: latestSequence,
    at: Date.now(),
    type: action.type,
    action: value,
    truncated,
    changedSlices: changedKeys(before, after),
  })
  if (recorded.length > CAPACITY) recorded.shift()
  return result
}

/** Actions after `sinceSequence`, oldest first; `missed` counts the ones the ring buffer already evicted. */
export function readRecordedActions(sinceSequence: number): {
  latestSequence: number
  missed: number
  actions: RecordedAction[]
} {
  const oldestRetained = recorded[0]?.sequence ?? latestSequence + 1
  return {
    latestSequence,
    missed: Math.max(0, oldestRetained - sinceSequence - 1),
    actions: recorded.filter((entry) => entry.sequence > sinceSequence),
  }
}

export function recordedSequence(): number {
  return latestSequence
}

/** A JSON-safe copy cut at the limits; `truncated` is true when any limit removed something. */
export function boundedCopy(
  value: unknown,
  limits: CopyLimits,
): { value: unknown; truncated: boolean } {
  let truncated = false
  let nodes = limits.nodes
  const ancestors = new Set<object>()
  const cut = (summary: string) => {
    truncated = true
    return summary
  }
  const copy = (item: unknown, depth: number): unknown => {
    if (typeof item === 'string') {
      return item.length <= limits.text ? item : cut(`${item.slice(0, limits.text)}…`)
    }
    if (typeof item === 'bigint') return `${item}n`
    if (typeof item === 'function') return `[function ${item.name || 'anonymous'}]`
    if (typeof item === 'symbol') return item.toString()
    if (item === null || typeof item !== 'object') return item
    if (item instanceof Date) return item.toISOString()
    if (item instanceof Map || item instanceof Set) return cut(`[${item.constructor.name} of ${item.size}]`)
    const size = Array.isArray(item) ? item.length : Object.keys(item).length
    const kind = Array.isArray(item) ? 'array' : 'object'
    if (ancestors.has(item)) return cut('[circular]')
    if (depth >= limits.depth || nodes <= 0) return cut(`[${kind} of ${size}]`)
    nodes -= 1
    ancestors.add(item)
    try {
      if (Array.isArray(item)) {
        const items = item.slice(0, limits.items).map((entry) => copy(entry, depth + 1))
        return item.length > limits.items ? [...items, cut(`[${item.length - limits.items} more]`)] : items
      }
      const entries = Object.entries(item)
      const shown = entries.slice(0, limits.items).map(([key, entry]) => [key, copy(entry, depth + 1)])
      if (entries.length > limits.items) shown.push(['…', cut(`${entries.length - limits.items} more keys`)])
      return Object.fromEntries(shown)
    } finally {
      ancestors.delete(item)
    }
  }
  return { value: copy(value, 0), truncated }
}

function isAction(value: unknown): value is { type: string } {
  return isRecord(value) && typeof value.type === 'string'
}

function changedKeys(before: unknown, after: unknown): string[] {
  if (!isRecord(before) || !isRecord(after)) return before === after ? [] : ['(root)']
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter((key) => before[key] !== after[key])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
