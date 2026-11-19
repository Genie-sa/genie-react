// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest'

interface DevToolsHook {
  inject: (renderer: object) => number
}

const hookHolder = globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevToolsHook; Node?: unknown }
const nodeReads: string[] = []

// React Native installs DOM classes such as Node as lazy globals; the first read loads its renderer, which registers on the DevTools hook.
Object.defineProperty(globalThis, 'Node', {
  configurable: true,
  enumerable: true,
  get() {
    nodeReads.push('Node')
    hookHolder.__REACT_DEVTOOLS_GLOBAL_HOOK__?.inject({
      rendererPackageName: 'react-native-renderer',
      version: '19.2.3',
      bundleType: 1,
    })
    class ReadOnlyNode {}
    Object.defineProperty(globalThis, 'Node', { configurable: true, value: ReadOnlyNode })
    return ReadOnlyNode
  },
})

afterAll(() => {
  Reflect.deleteProperty(globalThis, 'Node')
})

describe('loading the hook on React Native', () => {
  it('leaves lazy DOM globals unread, so the renderer still registers after render tracking starts', async () => {
    await import('./hook')
    const { renderCollectionStatus } = await import('./render-tracker')

    expect(nodeReads).toEqual([])
    expect(renderCollectionStatus()).toBe('available')
  })
})
