import { renderEnvelopeText } from './cli-output'
import { isRecord } from './guards'
import { flowText, scalarText } from './text-output'

/** `doctor`: the envelope line, then one `ok|FAIL critical|optional "label" — "detail" {fields}` line per check. */
export function renderDoctorText(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.checks) || !value.checks.every(isCheck)) {
    return renderEnvelopeText(value)
  }
  const { checks, ...rest } = value
  const [header = '', ...fields] = renderEnvelopeText(rest).split('\n')
  return [
    header,
    `checks[${checks.length}] (ok|FAIL critical|optional label — detail):`,
    ...checks.map(checkLine),
    ...fields,
  ].join('\n')
}

function isCheck(value: unknown): value is Record<string, unknown> & {
  label: string
  ok: boolean
  critical: boolean
} {
  return (
    isRecord(value) &&
    typeof value.label === 'string' &&
    typeof value.ok === 'boolean' &&
    typeof value.critical === 'boolean' &&
    (!Object.hasOwn(value, 'detail') || typeof value.detail === 'string')
  )
}

function checkLine(
  check: Record<string, unknown> & { label: string; ok: boolean; critical: boolean },
): string {
  const { label, ok, critical, detail, ...rest } = check
  const parts = [
    `  ${ok ? 'ok' : 'FAIL'} ${critical ? 'critical' : 'optional'} ${scalarText(label)}`,
  ]
  if (Object.hasOwn(check, 'detail')) parts.push(`— ${flowText(detail)}`)
  if (Object.keys(rest).length > 0) parts.push(flowText(rest))
  return parts.join(' ')
}
