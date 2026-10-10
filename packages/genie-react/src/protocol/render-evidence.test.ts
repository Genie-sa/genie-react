import { describe, expect, it } from 'vitest'
import { compactRenderCause } from './render-evidence'

describe('compactRenderCause', () => {
  it('keeps the read index so two reads of one context stay distinguishable', () => {
    const read = (contextIndex: number) =>
      compactRenderCause({
        kind: 'context',
        evidence: 'exact',
        contextIndex,
        name: 'ThemeContext',
        before: { mode: 'light' },
        after: { mode: 'dark' },
      } as { kind: string; evidence: string })

    expect([read(0), read(1)]).toEqual([
      { kind: 'context', evidence: 'exact', name: 'ThemeContext', contextIndex: 0 },
      { kind: 'context', evidence: 'exact', name: 'ThemeContext', contextIndex: 1 },
    ])
  })

  it('drops values and diffs and keeps referenceOnly only for props', () => {
    expect(
      compactRenderCause({
        kind: 'props',
        evidence: 'exact',
        name: 'onSelect',
        referenceOnly: true,
        before: 1,
        after: 2,
      } as { kind: string; evidence: string }),
    ).toEqual({ kind: 'props', evidence: 'exact', name: 'onSelect', referenceOnly: true })
  })
})
