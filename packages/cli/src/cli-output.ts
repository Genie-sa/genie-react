import { renderBoundedJson } from './result-selection'
import { CLI_OUTPUT_SCHEMA_VERSION } from './schema-version'

export const DEFAULT_MAX_BYTES = 102_400

/** One complete JSON value per line, independent of terminal detection. */
export function writeJson(value: unknown, maxBytes = DEFAULT_MAX_BYTES): void {
  process.stdout.write(`${renderBoundedJson(value ?? null, maxBytes)}\n`)
}

/** Diagnostics are separate JSONL records; caller-supplied context stays under data. */
export function writeDiagnostic(reason: string, message: string, data?: unknown): void {
  process.stderr.write(
    `${renderBoundedJson(
      {
        schemaVersion: CLI_OUTPUT_SCHEMA_VERSION,
        status: 'diagnostic',
        reason,
        message,
        ...(data === undefined ? {} : { data }),
      },
      DEFAULT_MAX_BYTES,
    )}\n`,
  )
}
