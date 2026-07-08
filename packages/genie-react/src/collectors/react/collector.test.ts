import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasDomLookupRuntime } from './collector'

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
const originalElement = Object.getOwnPropertyDescriptor(globalThis, 'Element')

function setGlobalProperty(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
  })
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
