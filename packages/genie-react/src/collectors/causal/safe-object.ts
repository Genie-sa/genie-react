import { isKnownProxy } from './proxy-tagging'

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

/** Tagged proxies are rejected; a Proxy created before Genie installed its tagging still passes. */
export function isPlainObject(value: unknown): value is object {
  if (typeof value !== 'object' || value === null || isKnownProxy(value)) return false
  try {
    if (Array.isArray(value)) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

/** False for revoked proxies, where Array.isArray throws. */
export function isArrayValue(value: unknown): value is unknown[] {
  try {
    return Array.isArray(value)
  } catch {
    return false
  }
}

/** React elements are plain objects whose owner and props reach into the fiber tree, so they stay opaque. */
export function isWalkablePlainObject(value: unknown): value is object {
  if (!isPlainObject(value)) return false
  try {
    return !Object.hasOwn(value, '$$typeof')
  } catch {
    return false
  }
}

/** Unreadable symbol keys count as present so callers never claim a complete comparison. */
export function hasOwnSymbolKeys(value: object): boolean {
  try {
    return Object.getOwnPropertySymbols(value).length > 0
  } catch {
    return true
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
