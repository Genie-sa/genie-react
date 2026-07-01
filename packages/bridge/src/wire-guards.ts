/**
 * The single runtime-checked seam for the wire shapes the hub reads but cannot import a type for:
 * the pre-parse frame discriminant, and the tool results the meta `devtools_wait` conditions poll
 * out of the connected app (`react_find_components`, `query_list`, `router_get_state`). These come
 * back as opaque {@link https://developer.mozilla.org/docs/Glossary/JSON JSON} in an
 * `AppResponse.result: unknown`, so each accessor validates its container here and hands the caller
 * a proven shape whose fields stay `unknown` — the caller narrows individual fields at the point of
 * use, so no coercion can silently change the polled condition's outcome.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Peeks the frame discriminant before schema validation, so the hub can pick the agent-vs-app
 * schema without asserting the whole frame. Returns `undefined` for a frame that is not an object
 * or whose `kind` is not a string; such a frame then falls through to normal `schema.parse`, which
 * rejects it inside the caught parse (rather than throwing an uncaught `TypeError` on `.startsWith`).
 */
export function frameKind(frame: unknown): string | undefined {
  if (isRecord(frame) && typeof frame.kind === 'string') return frame.kind
  return undefined
}

/**
 * The `matches` array from a `react_find_components` result, or `undefined` when the result is not a
 * record carrying a `matches` array.
 */
export function matchesOf(result: unknown): unknown[] | undefined {
  if (isRecord(result) && Array.isArray(result.matches)) return result.matches
  return undefined
}

/**
 * The `queries` list from a `query_list` result as validated records (each non-record entry becomes
 * an empty record so callers read absent fields as `undefined`), or `undefined` when the result is
 * not a record carrying a `queries` array.
 */
export function parseQueryList(result: unknown): Record<string, unknown>[] | undefined {
  if (!isRecord(result) || !Array.isArray(result.queries)) return undefined
  return result.queries.map((entry) => (isRecord(entry) ? entry : {}))
}

/**
 * The `router_get_state` result as a validated record whose fields the caller reads as `unknown`, or
 * `undefined` when the result is not a record.
 */
export function routerStateOf(result: unknown): Record<string, unknown> | undefined {
  return isRecord(result) ? result : undefined
}
