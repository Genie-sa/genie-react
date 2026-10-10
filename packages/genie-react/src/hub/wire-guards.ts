// The single runtime-checked seam for untyped wire JSON: each accessor proves its container, fields stay `unknown` for callers to narrow.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The `matches` array from a `react_find_components` result, or `undefined`. */
export function matchesOf(result: unknown): unknown[] | undefined {
  if (isRecord(result) && Array.isArray(result.matches)) return result.matches
  return undefined
}

/** The `queries` from a `query_list` result (non-record entries become `{}`), or `undefined`. */
export function parseQueryList(result: unknown): Record<string, unknown>[] | undefined {
  if (!isRecord(result) || !Array.isArray(result.queries)) return undefined
  return result.queries.map((entry) => (isRecord(entry) ? entry : {}))
}

/** One `query_get` result as a record, or `undefined`. */
export function queryStateOf(result: unknown): Record<string, unknown> | undefined {
  return isRecord(result) ? result : undefined
}

/** The `router_get_state` result as a record, or `undefined`. */
export function routerStateOf(result: unknown): Record<string, unknown> | undefined {
  return isRecord(result) ? result : undefined
}

export function recordOf(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

export function numberField(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function stringField(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key]
  return typeof value === 'string' ? value : null
}
