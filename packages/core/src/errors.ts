/**
 * Canonical message extraction for an unknown thrown value. Every `catch` binds `unknown`; this is
 * the single place that decides how a non-`Error` throw is rendered, so call sites read a `string`
 * without re-narrowing at each boundary.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
