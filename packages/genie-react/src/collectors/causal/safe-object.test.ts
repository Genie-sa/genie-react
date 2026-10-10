import { describe, expect, it } from 'vitest'
import { hasOwnSymbolKeys, isArrayValue, isPlainObject, plainOwnKeys } from './safe-object'

describe('safe object reflection', () => {
  it('rejects a revoked proxy without throwing', () => {
    const { proxy, revoke } = Proxy.revocable({}, {})
    revoke()

    expect(isPlainObject(proxy)).toBe(false)
    expect(isArrayValue(proxy)).toBe(false)
    expect(plainOwnKeys(proxy)).toBeUndefined()
    expect(hasOwnSymbolKeys(proxy)).toBe(true)
  })

  it('accepts plain and null-prototype objects but not arrays or instances', () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject(Object.create(null))).toBe(true)
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject(new (class Value {})())).toBe(false)
  })
})
