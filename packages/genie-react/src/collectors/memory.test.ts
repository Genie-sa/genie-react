import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CollectorContext, ErasedCollectorTool } from '../client'
import { memoryCollector, normalizePerformanceMemory } from './memory'

const noopContext: CollectorContext = {
  pushSnapshot: vi.fn(),
  pushEvent: vi.fn(),
  refreshTools: vi.fn(),
  markActivity: vi.fn(),
}

function toolByName(tools: ErasedCollectorTool[] | undefined, name: string): ErasedCollectorTool {
  const tool = tools?.find((candidate) => candidate.contract.name === name)
  if (!tool) throw new Error(`missing tool ${name}`)
  return tool
}

afterEach(() => vi.unstubAllGlobals())

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

describe('browser_get_memory runtime contract', () => {
  it('describes numeric Hermes-compatible heap fields without claiming they are browser V8 data', () => {
    vi.stubGlobal('performance', {
      memory: {
        usedJSHeapSize: 10,
        totalJSHeapSize: 20,
        jsHeapSizeLimit: null,
      },
    })
    vi.stubGlobal('navigator', { product: 'ReactNative' })

    const collector = memoryCollector()
    const tool = toolByName(collector.tools, 'browser_get_memory')
    const result = tool.handler({} as never, noopContext)

    expect(collector.meta).toMatchObject({
      title: 'Runtime memory',
      description: 'JavaScript runtime heap readings (not React-specific memory)',
    })
    expect(tool.contract.name).toBe('browser_get_memory')
    expect(tool.contract.title).toBe('JavaScript heap usage')
    expect(tool.contract.description).toBe(
      'Read the current JavaScript heap size (used/total/limit, in bytes) via performance.memory when the runtime exposes numeric fields. This is runtime-wide, not React-specific memory. Chromium and React Native/Hermes expose different fields and precision; otherwise this returns supported:false with an explanatory note.',
    )
    expect(result).toEqual({
      supported: true,
      usedJSHeapSize: 10,
      totalJSHeapSize: 20,
      note: 'JavaScript heap reported by the current runtime, not React-specific memory. Availability and precision vary by runtime.',
    })
    expect(tool.contract.input.safeParse({}).success).toBe(true)
    expect(tool.contract.output.safeParse(result).success).toBe(true)
  })
})
