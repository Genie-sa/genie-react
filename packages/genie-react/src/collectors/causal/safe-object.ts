/** Undefined means lookup failed; null means the own property is absent. */
export function safeOwnPropertyDescriptor(
  value: object,
  key: PropertyKey,
): PropertyDescriptor | null | undefined {
  try {
    return Object.getOwnPropertyDescriptor(value, key) ?? null
  } catch {
    return undefined
  }
}

export function isDataDescriptor(
  descriptor: PropertyDescriptor | null | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return descriptor !== undefined && descriptor !== null && Object.hasOwn(descriptor, 'value')
}

/** Browsers expose no Proxy brand check, so a Proxy over an object literal still passes. */
export function isPlainObject(value: unknown): value is object {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  try {
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

/** Undefined means the value is not a plain object or its keys could not be listed. */
export function plainOwnKeys(value: unknown): string[] | undefined {
  if (!isPlainObject(value)) return undefined
  try {
    return Object.keys(value)
  } catch {
    return undefined
  }
}
