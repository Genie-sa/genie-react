import { describe, expect, it } from 'vitest'
import { balancedJson, parseJsonValues } from './json.mjs'

describe('balancedJson', () => {
  it('returns the matching object or array and ignores brackets in strings', () => {
    expect(balancedJson('x {"a":"}]","b":[1,{"c":2}]} y', 2)).toBe('{"a":"}]","b":[1,{"c":2}]}')
    expect(balancedJson('[1, [2]] tail', 0)).toBe('[1, [2]]')
    expect(balancedJson('{"a":[1}', 0)).toBeNull()
    expect(balancedJson('{"a":1', 0)).toBeNull()
  })
})

describe('parseJsonValues', () => {
  it('reads JSONL, pretty-printed values and values mixed with other output', () => {
    const text = [
      'log line [ref=e1]',
      '{"a":1}',
      '{',
      '  "b": [',
      '    2',
      '  ]',
      '}',
      'truncated {"c":',
      '[{"d":3}]',
    ].join('\n')
    expect(parseJsonValues(text)).toEqual([{ a: 1 }, { b: [2] }, [{ d: 3 }]])
  })
})
