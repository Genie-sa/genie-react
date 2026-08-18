// Hermes lacks structuredClone; the fallback covers the types genie events carry, resolved per call so the module never throws at import and a late polyfill still wins.
export function safeStructuredClone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return cloneValue(value, new WeakMap()) as T
}

function cloneValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'function' || typeof value === 'symbol') {
      throw new Error(`${typeof value} could not be cloned`)
    }
    return value
  }
  const existing = seen.get(value)
  if (existing !== undefined) return existing
  if (value instanceof Date) return new Date(value.getTime())
  if (value instanceof RegExp) return new RegExp(value.source, value.flags)
  if (value instanceof Map) {
    const clone = new Map()
    seen.set(value, clone)
    for (const [key, entry] of value) clone.set(cloneValue(key, seen), cloneValue(entry, seen))
    return clone
  }
  if (value instanceof Set) {
    const clone = new Set()
    seen.set(value, clone)
    for (const entry of value) clone.add(cloneValue(entry, seen))
    return clone
  }
  if (Array.isArray(value)) {
    const clone: unknown[] = []
    seen.set(value, clone)
    for (let index = 0; index < value.length; index += 1) {
      if (index in value) clone[index] = cloneValue(value[index], seen)
    }
    return clone
  }
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    throw new Error('binary values are not supported by the structuredClone fallback')
  }
  const clone: Record<string, unknown> = {}
  seen.set(value, clone)
  for (const key of Object.keys(value)) {
    clone[key] = cloneValue((value as Record<string, unknown>)[key], seen)
  }
  return clone
}
