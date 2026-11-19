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

  it('names the store fields that changed, so the default view says what moved', () => {
    expect(
      compactRenderCause({
        kind: 'external-store',
        evidence: 'inferred',
        storeLabel: 'anonymous-external-store',
        before: { selectedOrderIds: {}, density: 'comfortable' },
        after: { selectedOrderIds: { 'o-1': true }, density: 'comfortable' },
        changedFields: ['selectedOrderIds'],
      } as { kind: string; evidence: string }),
    ).toEqual({
      kind: 'external-store',
      evidence: 'inferred',
      name: 'anonymous-external-store',
      changedFields: ['selectedOrderIds'],
    })
  })
})
