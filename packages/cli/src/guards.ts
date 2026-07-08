/** The CLI's single unknown→indexable-record narrowing, shared by every untyped boundary so none re-derives it. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** An array (possibly empty) whose every element is a plain record — `--fields` row detection without a cast. */
export function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord)
}
