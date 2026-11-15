import { describe, expect, it } from 'vitest'
import { probeClaims } from './probe.mjs'

describe('probeClaims', () => {
  it('turns a render budget into an exact updates claim that also fails on remounts', () => {
    expect(
      probeClaims({
        steps: [['click', 'button']],
        renders: { component: 'StatusBadge', maxUpdates: 0 },
      }),
    ).toEqual(['render StatusBadge max 0 counting updates'])
  })

  it('adds boundaries clean when the task forbids caught errors', () => {
    expect(probeClaims({ steps: [['click', 'button']], noCaughtErrors: true })).toEqual([
      'boundaries clean',
    ])
  })

  it('makes no claims without an interaction, which a window could not observe', () => {
    expect(
      probeClaims({
        steps: [],
        noCaughtErrors: true,
        renders: { component: 'Row', maxUpdates: 0 },
      }),
    ).toEqual([])
  })

  it('leaves a text-only probe to the UI check', () => {
    expect(
      probeClaims({ steps: [['click', 'button']], text: { selector: 'main', includes: 'Ready' } }),
    ).toEqual([])
  })
})
