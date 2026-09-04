import type { Fiber } from 'bippy'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CollectorContext, GenieCollector } from '../../client'
import { hasDomLookupRuntime, reactCollector } from './collector'
import { reactGetRendersContract } from './render-contract'
import { clearRenders, isTracking, recordRender, startRenderTracking } from './render-tracker'

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
const originalElement = Object.getOwnPropertyDescriptor(globalThis, 'Element')

function setGlobalProperty(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
  })
}

const collectorContext: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}

function call<T>(collector: GenieCollector, name: string, args: unknown): T {
  const tool = collector.tools?.find((entry) => entry.contract.name === name)
  if (!tool) throw new Error(`tool not found: ${name}`)
  return tool.handler(args as never, collectorContext) as T
}

describe('hasDomLookupRuntime', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
    else Reflect.deleteProperty(globalThis, 'navigator')
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
    else Reflect.deleteProperty(globalThis, 'document')
    if (originalElement) Object.defineProperty(globalThis, 'Element', originalElement)
    else Reflect.deleteProperty(globalThis, 'Element')
  })

  it('returns false in React Native even if document-like globals exist', () => {
    setGlobalProperty('navigator', { product: 'ReactNative' })
    setGlobalProperty('document', { body: {}, querySelectorAll: () => [] })
    setGlobalProperty('Element', function Element() {})

    expect(hasDomLookupRuntime()).toBe(false)
  })

  it('requires a real DOM selector runtime', () => {
    setGlobalProperty('navigator', { product: 'Gecko' })
    setGlobalProperty('document', { body: {}, querySelectorAll: () => [] })
    setGlobalProperty('Element', function Element() {})

    expect(hasDomLookupRuntime()).toBe(true)
  })
})

describe('render measurement lifecycle', () => {
  afterEach(() => startRenderTracking())

  it('react_clear_renders resumes tracking after react_profile_stop', () => {
    const collector = reactCollector()
    startRenderTracking()

    call(collector, 'react_profile_stop', {})
    expect(isTracking()).toBe(false)

    const result = call<{ tracking: boolean }>(collector, 'react_clear_renders', {})
    expect(result.tracking).toBe(true)
    expect(isTracking()).toBe(true)
  })
})

describe('app source classification coverage', () => {
  afterEach(() => clearRenders())

  it('rejects incomplete app-only comparisons while retaining unfiltered measurement semantics', async () => {
    clearRenders()
    recordRender(
      {
        tag: 0,
        type: function Unresolved() {
          return null
        },
        memoizedProps: {},
        memoizedState: null,
        actualDuration: 1,
        selfBaseDuration: 1,
        child: null,
        alternate: null,
      } as unknown as Fiber,
      'mount',
    )
    const collector = reactCollector()
    const read = async (appOnly: boolean) =>
      reactGetRendersContract.output.parse(
        await call(collector, 'react_get_renders', { sort: 'renders', limit: 40, appOnly }),
      )

    const filtered = await read(true)
    expect(filtered.sourceClassification).toEqual({
      complete: false,
      totalCandidates: 1,
      evaluated: 1,
      app: 0,
      library: 0,
      unknown: 1,
    })
    expect(filtered.comparable).toBe(false)
    expect(filtered.notComparableReasons).toContain('app-source-classification-incomplete')
    expect(filtered.summary.semantics).toBe('unknown')
    expect(filtered.filteredNote).toContain('1 components with unknown ownership and 0 library')

    const unfiltered = await read(false)
    expect(unfiltered.summary.totalRenders).toBe(1)
    expect(unfiltered.summary.semantics).toBe('exact')
    expect(unfiltered.notComparableReasons).not.toContain('app-source-classification-incomplete')
    expect(unfiltered.components[0]?.sourceOwnership).toBe('unknown')
  })
})
