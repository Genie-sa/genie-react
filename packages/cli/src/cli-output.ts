import { renderBoundedJson } from './result-selection'

export const DEFAULT_MAX_BYTES = 262_144

/** One complete JSON value per line, independent of terminal detection. */
export function writeJson(value: unknown, maxBytes = DEFAULT_MAX_BYTES): void {
  process.stdout.write(`${renderBoundedJson(value ?? null, maxBytes)}\n`)
}

/** Diagnostics are separate JSONL records; caller-supplied context stays under data. */
export function writeDiagnostic(reason: string, message: string, data?: unknown): void {
  process.stderr.write(
    `${renderBoundedJson(
      {
        schemaVersion: '1.0',
        status: 'diagnostic',
        reason,
        message,
        ...(data === undefined ? {} : { data }),
      },
      DEFAULT_MAX_BYTES,
    )}\n`,
  )
}
