/**
 * Narrows an unknown value to an indexable record so a caller can read arbitrary keys after a single
 * runtime check. This is the one place the CLI decides "this parsed JSON or tool result is an object
 * I may index", shared by every untyped boundary (bridge discovery, package manifests, tool-result
 * summaries) so they all narrow the same way instead of each re-deriving the check.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
