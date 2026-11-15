import { renderEnvelopeText } from './cli-output'
import { CLI_OUTPUT_SCHEMA_VERSION } from './schema-version'
import { encodeText, indentLines, scalarText } from './text-output'
import { renderToolText } from './tool-text-output'

/** One batch result: `[position/total] tool ok` or `[position/total] tool <failure line>`, then its body indented; the header carries `status`, and `ok` when it agrees. */
export function renderBatchItemText(
  position: number,
  total: number,
  item: { schemaVersion: string; tool: string; ok: boolean; status: string; result?: unknown },
  selected: boolean,
): string {
  const { schemaVersion, tool, ok, status, ...rest } = withoutImplied(item)
  const label = `[${position}/${total}] ${scalarText(tool)}`
  if (status === 'ok' && ok === undefined && schemaVersion === undefined) {
    const { result, ...fields } = rest
    const body = [
      ...(Object.keys(fields).length === 0 ? [] : [encodeText(fields)]),
      ...(Object.hasOwn(rest, 'result')
        ? [selected ? renderEnvelopeText(result) : renderToolText(item.tool, result)]
        : []),
    ]
    return [`${label} ok`, ...body.map((text) => indentLines(text))].join('\n')
  }
  const [header = '', ...lines] = renderEnvelopeText({
    ...(schemaVersion === undefined ? {} : { schemaVersion }),
    status,
    ...(ok === undefined ? {} : { ok }),
    ...rest,
  }).split('\n')
  return [`${label} ${header}`, ...lines.map((line) => `  ${line}`)].join('\n')
}

/** Drops the CLI's own schemaVersion and an `ok` that matches `status`, which the header already states. */
function withoutImplied(item: Record<string, unknown>): Record<string, unknown> {
  const { schemaVersion, ok, ...rest } = item
  return {
    ...(schemaVersion === CLI_OUTPUT_SCHEMA_VERSION ? {} : { schemaVersion }),
    ...(ok === (item.status === 'ok') ? {} : { ok }),
    ...rest,
  }
}
