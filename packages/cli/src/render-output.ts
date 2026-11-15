import { isRecord } from './guards'
import {
  encodeText,
  fieldsWithLayout,
  flowText,
  hoistSharedFields,
  scalarText,
} from './text-output'

interface RecordLayout {
  list: string
  name: string
  id: string
}

const RENDER_REPORT: RecordLayout = { list: 'components', name: 'name', id: 'id' }
const RENDER_CAUSES: RecordLayout = { list: 'events', name: 'componentName', id: 'componentId' }
const CAUSE_WORD = /^[a-z][a-z0-9-]*$/

/** `react_get_renders`: one line per component, then one `← kind evidence name` line per cause. */
export function renderRenderReportText(value: unknown): string {
  return renderRecordsText(value, RENDER_REPORT)
}

/** `react_render_causes`: one line per render event, then one `← kind evidence name` line per cause. */
export function renderRenderCausesText(value: unknown): string {
  return renderRecordsText(value, RENDER_CAUSES)
}

function renderRecordsText(value: unknown, layout: RecordLayout): string {
  if (!isRecord(value)) return encodeText(value)
  const records = value[layout.list]
  if (!Array.isArray(records) || !records.every((record) => isRenderRecord(record, layout))) {
    return encodeText(value)
  }
  return fieldsWithLayout(value, layout.list, () => recordLines(records, layout)).join('\n')
}

function isRenderRecord(value: unknown, layout: RecordLayout): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value[layout.name] === 'string' &&
    (typeof value[layout.id] === 'number' || typeof value[layout.id] === 'string')
  )
}

function recordLines(records: Record<string, unknown>[], layout: RecordLayout): string[] {
  const heads = records.map((record) => {
    const { [layout.name]: name, [layout.id]: id, causes, ...fields } = record
    return { name, id, causes: Object.hasOwn(record, 'causes') ? causes : undefined, fields }
  })
  const { shared, rest } = hoistSharedFields(heads.map(({ fields }) => fields))
  return [
    `${layout.list}[${records.length}] (${layout.name} #${layout.id} {fields}, then ← kind evidence name {fields} per cause):`,
    ...(shared === null ? [] : [`  each: ${flowText(shared)}`]),
    ...heads.flatMap(({ name, id, causes }, index) => {
      const fields = rest[index] as Record<string, unknown>
      const extra = Object.keys(fields).length === 0 ? '' : ` ${flowText(fields)}`
      return [`  ${scalarText(name)} #${scalarText(id)}${extra}`, ...causeLines(causes)]
    }),
  ]
}

/** Absent `causes` adds no line; any other non-array value keeps its exact form on a `causes:` line. */
function causeLines(causes: unknown): string[] {
  if (causes === undefined) return []
  if (!Array.isArray(causes)) return [`    causes: ${flowText(causes)}`]
  if (causes.length === 0) return ['    causes: []']
  return causes.map((cause) => {
    if (!isRecord(cause) || !isCauseWord(cause.kind) || !isCauseWord(cause.evidence)) {
      return `    ← ${flowText(cause)}`
    }
    const { kind, evidence, name, ...fields } = cause
    const parts = [`    ← ${kind} ${evidence}`]
    if (Object.hasOwn(cause, 'name')) parts.push(nameToken(name))
    if (Object.keys(fields).length > 0) parts.push(flowText(fields))
    return parts.join(' ')
  })
}

function isCauseWord(value: unknown): value is string {
  return typeof value === 'string' && CAUSE_WORD.test(value)
}

/** A name never starts with `{`, so it cannot be read as the fields that may follow it. */
function nameToken(name: unknown): string {
  const text = flowText(name)
  return text.startsWith('{') ? `name:${text}` : text
}
