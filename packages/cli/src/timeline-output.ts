import { isRecord } from './guards'
import { encodeText, fieldsWithLayout, flowText, scalarText } from './text-output'

const EVENT_WORD = /^[A-Za-z][A-Za-z0-9_-]*$/

/** `timeline_read`: one `#sequence atMs domain type {details}` line per event, in recorded order. */
export function renderTimelineText(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.events)) return encodeText(value)
  return fieldsWithLayout(value, 'events', (events) =>
    Array.isArray(events)
      ? [
          `events[${events.length}] (#sequence atMs domain type {details}):`,
          ...events.map((event) => `  ${eventLine(event)}`),
        ]
      : null,
  ).join('\n')
}

function eventLine(event: unknown): string {
  if (!isRecord(event)) return `- ${flowText(event)}`
  const { sequence, atMs, domain, type, details, ...rest } = event
  const compact =
    typeof sequence === 'number' &&
    typeof atMs === 'number' &&
    isEventWord(domain) &&
    isEventWord(type) &&
    Object.keys(rest).length === 0 &&
    (!Object.hasOwn(event, 'details') || isRecord(details))
  if (!compact) return `- ${flowText(event)}`
  const head = `#${sequence} ${scalarText(atMs)} ${domain} ${type}`
  return Object.hasOwn(event, 'details') ? `${head} ${flowText(details)}` : head
}

function isEventWord(value: unknown): value is string {
  return typeof value === 'string' && EVENT_WORD.test(value)
}
