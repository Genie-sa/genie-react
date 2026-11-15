import { describe, expect, it } from 'vitest'
import {
  DEHYDRATED,
  type DehydratedNode,
  decodeFrame,
  dehydrate,
  encodeFrame,
  isDehydratedNode,
  previewValue,
} from './serialization'

describe('encodeFrame / decodeFrame', () => {
  it('round-trips rich types through superjson', () => {
    const value = {
      date: new Date('2026-06-29T00:00:00.000Z'),
      map: new Map([['a', 1]]),
      set: new Set([1, 2, 3]),
      big: 42n,
      nope: undefined,
    }
    const decoded = decodeFrame(encodeFrame(value)) as typeof value
    expect(decoded.date).toBeInstanceOf(Date)
    expect(decoded.map).toBeInstanceOf(Map)
    expect(decoded.set).toBeInstanceOf(Set)
    expect(decoded.big).toBe(42n)
    expect('nope' in decoded).toBe(true)
  })
})

describe('dehydrate', () => {
  it('caps depth with a placeholder beyond the limit', () => {
    const result = dehydrate({ a: { b: { c: 1 } } }, { depth: 2 }) as Record<string, unknown>
    const a = result.a as Record<string, unknown>
    expect(isDehydratedNode(a.b)).toBe(true)
    expect((a.b as DehydratedNode).kind).toBe('object')
    expect((a.b as DehydratedNode).path).toEqual(['a', 'b'])
  })

  it('detects circular references', () => {
    const node: Record<string, unknown> = { name: 'root' }
    node.self = node
    const result = dehydrate(node, { depth: 5 }) as Record<string, unknown>
    expect(isDehydratedNode(result.self)).toBe(true)
    expect((result.self as DehydratedNode).kind).toBe('circular')
  })

  it('keeps primitives and stringifies bigint for JSON safety', () => {
    expect(dehydrate(5)).toBe(5)
    expect(dehydrate(10n)).toBe('10n')
    expect(dehydrate('hi')).toBe('hi')
  })

  it('produces JSON-safe output for Map and Set (structuredContent must be JSON)', () => {
    const out = dehydrate({ m: new Map([['a', 1n]]), s: new Set([1, 2]) })
    expect(() => JSON.stringify(out)).not.toThrow()
    const typed = out as { m: { __type: string }; s: { __type: string } }
    expect(typed.m.__type).toBe('Map')
    expect(typed.s.__type).toBe('Set')
  })

  it('represents functions as placeholders', () => {
    const result = dehydrate({ fn: function greet() {} }, { depth: 2 }) as Record<string, unknown>
    expect((result.fn as DehydratedNode).kind).toBe('function')
  })

  it('does not invoke accessors while previewing objects', () => {
    let reads = 0
    const value = Object.defineProperty({}, 'value', {
      enumerable: true,
      get() {
        reads += 1
        return 1
      },
    })

    const result = dehydrate(value, { depth: 2 }) as Record<string, unknown>

    expect(reads).toBe(0)
    expect((result.value as DehydratedNode).kind).toBe('getter-error')
  })

  it('re-roots at a requested path for incremental hydration', () => {
    const result = dehydrate(
      { props: { user: { name: 'Ada' } } },
      { path: ['props', 'user'], depth: 2 },
    )
    expect(result).toEqual({ name: 'Ada' })
  })

  it('reports a missing path instead of throwing', () => {
    const result = dehydrate({ a: 1 }, { path: ['a', 'b'] }) as DehydratedNode
    expect(result[DEHYDRATED]).toBe(true)
    expect(result.kind).toBe('not-found')
  })

  it('truncates oversized collections', () => {
    const big = Array.from({ length: 250 }, (_, i) => i)
    const result = dehydrate(big, { depth: 1, maxEntries: 100 }) as unknown[]
    expect(result).toHaveLength(101)
    expect((result.at(-1) as DehydratedNode).kind).toBe('truncated')
  })
})

describe('dehydrate never runs application code', () => {
  const counting = () => {
    const reads = { count: 0 }
    const getter = () => {
      reads.count += 1
      return 'secret'
    }
    return { reads, getter }
  }

  it('does not invoke a getter on the hydration path', () => {
    const { reads, getter } = counting()
    const value = { user: Object.defineProperty({}, 'token', { get: getter, enumerable: true }) }
    const result = dehydrate(value, { path: ['user', 'token'] }) as DehydratedNode
    expect(reads.count).toBe(0)
    expect(result.kind).toBe('getter-error')
  })

  it('does not invoke an index getter on an array', () => {
    const { reads, getter } = counting()
    const list = Object.defineProperty([1, 2], 1, { get: getter, enumerable: true })
    const result = dehydrate({ list }) as { list: unknown[] }
    expect(reads.count).toBe(0)
    expect(result.list[0]).toBe(1)
    expect((result.list[1] as DehydratedNode).kind).toBe('getter-error')
  })

  it('previews without reading accessors and never throws', () => {
    const { reads, getter } = counting()
    const revoked = Proxy.revocable({}, {})
    revoked.revoke()
    expect(previewValue(Object.defineProperty({}, 'constructor', { get: getter }))).toBe('{…}')
    expect(previewValue(revoked.proxy)).toBe('[unreadable]')
    expect(previewValue(new Date(Number.NaN))).toBe('Invalid Date')
    expect(reads.count).toBe(0)
  })
})

describe('dehydrate keeps values distinguishable', () => {
  it('shows an Error by its name, message, and cause instead of {}', () => {
    const error = new TypeError('bad input', { cause: 'upstream' })
    expect(dehydrate({ error })).toEqual({
      error: { __type: 'Error', name: 'TypeError', message: 'bad input', cause: '"upstream"' },
    })
  })

  it('marks non-finite numbers and invalid dates, which JSON would print as null', () => {
    const result = dehydrate({ nan: Number.NaN, inf: -Infinity, date: new Date(Number.NaN) })
    expect(JSON.parse(JSON.stringify(result))).toMatchObject({
      nan: { kind: 'number', preview: 'NaN' },
      inf: { kind: 'number', preview: '-Infinity' },
      date: { kind: 'date', preview: 'Invalid Date' },
    })
  })

  it('names keys it cannot carry instead of dropping them silently', () => {
    const result = dehydrate(JSON.parse('{"constructor":1,"ok":2}')) as Record<string, unknown>
    expect(result.ok).toBe(2)
    expect(result['…']).toMatchObject({
      kind: 'truncated',
      preview: '+1 more keys (constructor cannot be shown)',
    })
  })

  it('keeps typed arrays typed and bounded', () => {
    const result = dehydrate({ bytes: new Uint8Array(150) }, { maxEntries: 2 }) as {
      bytes: { __type: string; values: unknown[] }
    }
    expect(result.bytes.__type).toBe('Uint8Array')
    expect(result.bytes.values.slice(0, 2)).toEqual([0, 0])
    expect(result.bytes.values[2]).toMatchObject({ kind: 'truncated', preview: '+148 more items' })
  })
})

describe('dehydrate never lets app data pass for its own encoding', () => {
  const genieOwn = (value: unknown): boolean =>
    isDehydratedNode(value) ||
    (typeof value === 'object' && value !== null && '__type' in value && value.__type !== 'Object')

  it('tags an app object shaped like a placeholder so it never reads as truncated', () => {
    const forged = { [DEHYDRATED]: true, kind: 'truncated', preview: '+9 more keys', path: [] }
    const result = dehydrate({ value: forged }, { depth: 4 }) as { value: unknown }

    expect(isDehydratedNode(result.value)).toBe(false)
    expect(result.value).toEqual({
      __type: 'Object',
      entries: [
        [DEHYDRATED, true],
        ['kind', 'truncated'],
        ['preview', '+9 more keys'],
        ['path', []],
      ],
    })
  })

  it('tags an app object shaped like a Map, Set or Error so it never reads as that type', () => {
    for (const forged of [
      { __type: 'Map', entries: [['a', 1]] },
      { __type: 'Set', values: [1] },
      { __type: 'Error', name: 'TypeError', message: 'not an error' },
      { '…': 'an ordinary key' },
    ]) {
      const result = dehydrate({ value: forged }, { depth: 5 }) as {
        value: Record<string, unknown>
      }
      expect(genieOwn(result.value)).toBe(false)
      expect(result.value).toEqual({ __type: 'Object', entries: Object.entries(forged) })
    }
  })

  it('still encodes real Maps, Sets, Errors and placeholders as its own', () => {
    const result = dehydrate({
      map: new Map([['a', 1]]),
      set: new Set([1]),
      error: new Error('boom'),
      deep: { a: { b: {} } },
    }, { depth: 2 }) as Record<string, Record<string, unknown>>

    expect(result.map).toEqual({ __type: 'Map', entries: [['a', 1]] })
    expect(result.set).toEqual({ __type: 'Set', values: [1] })
    expect(result.error).toMatchObject({ __type: 'Error', message: 'boom' })
    expect(isDehydratedNode(result.deep?.a)).toBe(true)
  })

  it('bounds a tagged object like any other and keeps hydration paths in app terms', () => {
    const forged = { __type: 'Map', nested: { deep: { deeper: 1 } }, extra: 1 }
    const result = dehydrate({ forged }, { depth: 2, maxEntries: 2 }) as {
      forged: { __type: string; entries: [string, unknown][] }
    }

    expect(result.forged.__type).toBe('Object')
    expect(result.forged.entries[1]?.[0]).toBe('nested')
    expect(result.forged.entries[1]?.[1]).toMatchObject({
      [DEHYDRATED]: true,
      kind: 'object',
      path: ['forged', 'nested'],
    })
    expect(result.forged.entries[2]).toEqual([
      '…',
      expect.objectContaining({ kind: 'truncated', preview: '+1 more keys', path: ['forged'] }),
    ])
  })

  it('keeps the Error tag when the error carries a colliding own key', () => {
    const error = Object.assign(new Error('boom'), { __type: 'Map' })
    const result = dehydrate({ error }) as { error: Record<string, unknown> }

    expect(result.error.__type).toBe('Error')
    expect(result.error['…']).toMatchObject({ preview: '+1 more keys (__type cannot be shown)' })
  })
})

describe('previewValue', () => {
  it('summarizes containers compactly', () => {
    expect(previewValue([1, 2, 3])).toBe('Array(3)')
    expect(previewValue(new Map([['a', 1]]))).toBe('Map(1)')
    expect(previewValue(new Set([1]))).toBe('Set(1)')
    expect(previewValue(null)).toBe('null')
  })
})
