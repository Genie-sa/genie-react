import { describe, expect, it } from 'vitest'
import { normalizePerformanceMemory } from './memory'

describe('normalizePerformanceMemory', () => {
  it('drops null heap fields so browser_get_memory stays schema-valid', () => {
    expect(
      normalizePerformanceMemory({
        usedJSHeapSize: null,
        totalJSHeapSize: null,
        jsHeapSizeLimit: null,
      }),
    ).toEqual({ supported: false })
  })

  it('keeps finite numeric heap fields', () => {
    expect(
      normalizePerformanceMemory({
        usedJSHeapSize: 10,
        totalJSHeapSize: 20,
        jsHeapSizeLimit: 30,
      }),
    ).toEqual({
      supported: true,
      usedJSHeapSize: 10,
      totalJSHeapSize: 20,
      jsHeapSizeLimit: 30,
    })
  })
})
