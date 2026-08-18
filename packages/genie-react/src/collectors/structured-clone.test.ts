import { afterEach, describe, expect, it, vi } from 'vitest'
import { safeStructuredClone } from './structured-clone'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('safeStructuredClone', () => {
  it('delegates to the native structuredClone when available', () => {
    const original = structuredClone
    const native = vi.fn((value: unknown) => original(value))
    vi.stubGlobal('structuredClone', native)
    const value = { nested: { list: [1, 2] } }
    expect(safeStructuredClone(value)).toEqual(value)
    expect(native).toHaveBeenCalledOnce()
  })

  describe('without a structuredClone global (Hermes)', () => {
    const stubMissing = () => vi.stubGlobal('structuredClone', undefined)

    it('clones plain data, Map, Set, Date and RegExp', () => {
      stubMissing()
      const value = {
        map: new Map<string, unknown>([['key', { count: 1 }]]),
        set: new Set([1, 2, 3]),
        date: new Date(1_700_000_000_000),
        pattern: /ab+c/gi,
        list: [1, 'two', null, undefined, { deep: true }],
        empty: null,
      }
      const cloned = safeStructuredClone(value)
      expect(cloned).toEqual(value)
      expect(cloned.map).not.toBe(value.map)
      expect(cloned.map.get('key')).not.toBe(value.map.get('key'))
      expect(cloned.set).not.toBe(value.set)
      expect(cloned.date).not.toBe(value.date)
      expect(cloned.pattern.flags).toBe('gi')
    })

    it('preserves circular references', () => {
      stubMissing()
      const value: { self?: unknown; name: string } = { name: 'loop' }
      value.self = value
      const cloned = safeStructuredClone(value)
      expect(cloned.self).toBe(cloned)
      expect(cloned.name).toBe('loop')
    })

    it('preserves sparse arrays', () => {
      stubMissing()
      const value: unknown[] = [1]
      value[3] = 4
      const cloned = safeStructuredClone(value)
      expect(cloned.length).toBe(4)
      expect(1 in cloned).toBe(false)
      expect(cloned[3]).toBe(4)
    })

    it('rejects functions the way structuredClone does', () => {
      stubMissing()
      expect(() => safeStructuredClone({ callback: () => undefined })).toThrowError(
        /could not be cloned/,
      )
    })
  })
})
