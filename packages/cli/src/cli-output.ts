import { isRecord } from './guards'
import {
  type DocumentFormatter,
  JSON_FORMATTER,
  type Overflow,
  type OverflowRecovery,
  renderBoundedDocument,
  renderBoundedText,
} from './result-selection'
import { CLI_OUTPUT_SCHEMA_VERSION } from './schema-version'
import {
  asShellCommand,
  blockLines,
  encodeText,
  FieldReader,
  fieldLines,
  flowText,
  proseText,
} from './text-output'

export const DEFAULT_MAX_BYTES = 102_400

export type OutputFormat = 'text' | 'json'

/** Environment override that makes every command behave as it did before text became the default. */
export const OUTPUT_FORMAT_ENV = 'GENIE_OUTPUT'

const ENVELOPE_WORD = /^[a-z][a-z_]*$/

/** Library callers and tests get JSON; the executable selects text unless --json or GENIE_OUTPUT=json asks otherwise. */
let activeFormat: OutputFormat = 'json'

export function setOutputFormat(format: OutputFormat): void {
  activeFormat = format
}

export function outputFormat(): OutputFormat {
  return activeFormat
}

/** `--json` wins, then GENIE_OUTPUT; null means GENIE_OUTPUT holds a value the CLI does not accept. */
export function resolveOutputFormat(
  json: boolean,
  environment: string | undefined,
): OutputFormat | null {
  if (json) return 'json'
  if (environment === undefined || environment === '' || environment === 'text') return 'text'
  return environment === 'json' ? 'json' : null
}

export interface OutputOptions {
  maxBytes?: number
  recover?: (overflow: Overflow) => OverflowRecovery
  /** Text rendering of this document; the generic encoder when omitted. */
  text?: (value: unknown) => string
}

function formatterFor(text: (value: unknown) => string = encodeText): DocumentFormatter {
  if (activeFormat === 'json') return JSON_FORMATTER
  return {
    extension: 'txt',
    render: (value) => text(toPlainJson(value)),
    renderEnvelope: renderEnvelopeText,
  }
}

/** One document in the active format, bounded by `maxBytes` including its newline. */
export function renderOutput(value: unknown, options: OutputOptions = {}): string {
  return renderBoundedDocument(
    value ?? null,
    formatterFor(options.text),
    options.maxBytes ?? DEFAULT_MAX_BYTES,
    options.recover,
  )
}

/** Already-rendered lines, bounded like a document in the active format. */
export function renderOutputLines(text: string, maxBytes: number = DEFAULT_MAX_BYTES): string {
  return renderBoundedText(text, maxBytes, formatterFor())
}

/** A failure envelope; JSON keeps bounding the serialized record as text so its truncation shape is unchanged. */
export function renderFailure(
  failure: Record<string, unknown>,
  maxBytes: number = DEFAULT_MAX_BYTES,
): string {
  if (activeFormat === 'json') return renderBoundedText(JSON.stringify(failure), maxBytes)
  return renderBoundedDocument(failure, formatterFor(renderEnvelopeText), maxBytes)
}

/** `--fields` rows: JSON Lines, or one text document; zero rows emit zero bytes in both. */
export function renderRows(rows: readonly Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  if (activeFormat === 'json') return rows.map((row) => JSON.stringify(row)).join('\n')
  return encodeText(toPlainJson(rows))
}

export function writeOutput(value: unknown, options: OutputOptions = {}): void {
  process.stdout.write(`${renderOutput(value, options)}\n`)
}

/** A CLI-owned `{status, reason, message, …}` record: a receipt, a lifecycle event or a failure. */
export function writeEnvelope(envelope: Record<string, unknown>, maxBytes?: number): void {
  writeOutput(envelope, { maxBytes, text: renderEnvelopeText })
}

/** Diagnostics go to stderr: a JSONL record, or one `! reason: message {data}` line; caller-supplied context stays under data. */
export function writeDiagnostic(reason: string, message: string, data?: unknown): void {
  process.stderr.write(`${renderDiagnostic(reason, message, data)}\n`)
}

export function renderDiagnostic(reason: string, message: string, data?: unknown): string {
  if (activeFormat === 'text') {
    const context = data === undefined ? '' : ` ${flowText(toPlainJson(data))}`
    return renderBoundedText(
      `! ${diagnosticWord(reason)}: ${proseText(message)}${context}`,
      DEFAULT_MAX_BYTES,
      formatterFor(),
    )
  }
  return renderBoundedDocument(
    {
      schemaVersion: CLI_OUTPUT_SCHEMA_VERSION,
      status: 'diagnostic',
      reason,
      message,
      ...(data === undefined ? {} : { data }),
    },
    JSON_FORMATTER,
    DEFAULT_MAX_BYTES,
  )
}

/** Text form of a CLI-owned envelope: a `<status> <reason>: <message>` line no tool data can produce, then `next`, then every other field; never called with a tool result. */
export function renderEnvelopeText(value: unknown): string {
  if (!isRecord(value)) return encodeText(value)
  const { status, reason, message } = value
  if (
    typeof status !== 'string' ||
    !ENVELOPE_WORD.test(status) ||
    typeof reason !== 'string' ||
    !ENVELOPE_WORD.test(reason) ||
    typeof message !== 'string'
  ) {
    return encodeText(withoutCliVersion(value))
  }
  const fields = new FieldReader(withoutCliVersion(value))
  for (const key of ['status', 'reason', 'message']) fields.take(key)
  const lines = [`${status} ${reason}: ${proseText(message)}`]
  if (fields.has('next')) lines.push(...fieldLines('next', fields.take('next'), 0, ''))
  if (fields.has('suggestions')) lines.push(...suggestionLines(fields.take('suggestions')))
  lines.push(...blockLines(fields.rest(), 0, ''))
  return lines.join('\n')
}

/** Retry suggestions as `- reason` over its `$ command`; anything else falls back to the generic encoding. */
function suggestionLines(suggestions: unknown): string[] {
  const commands = Array.isArray(suggestions) ? suggestions : []
  const runnable = commands.every(
    (suggestion) =>
      isRecord(suggestion) &&
      Object.keys(suggestion).length === 3 &&
      typeof suggestion.reason === 'string' &&
      asShellCommand({ command: suggestion.command, argv: suggestion.argv }),
  )
  if (!runnable || commands.length === 0) return fieldLines('suggestions', suggestions, 0, '')
  return [
    `suggestions[${commands.length}]:`,
    ...(commands as Array<{ reason: string; command: string }>).flatMap(({ reason, command }) => [
      `  - ${proseText(reason)}`,
      `    $ ${command}`,
    ]),
  ]
}

/** Text is not a versioned contract, so a CLI-owned record omits its schemaVersion; any other value stays. */
function withoutCliVersion(record: Record<string, unknown>): Record<string, unknown> {
  if (record.schemaVersion !== CLI_OUTPUT_SCHEMA_VERSION) return record
  const { schemaVersion: _version, ...rest } = record
  return rest
}

/** The document `JSON.stringify` would emit, so text and JSON describe the same values (dropped undefined, toJSON). */
export function toPlainJson(value: unknown): unknown {
  const serialized = JSON.stringify(value)
  return serialized === undefined ? null : JSON.parse(serialized)
}

function diagnosticWord(reason: string): string {
  return /^[a-z][a-z0-9_-]*$/.test(reason) ? reason : 'diagnostic'
}
