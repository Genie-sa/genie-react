// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CollectorContext } from '../client'
import { type AppStateLike, visibilityCollector } from './visibility'

const context: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}

function started(collector = visibilityCollector()) {
  const stop = collector.start?.(context)
  const tool = collector.tools?.[0]
  if (!tool) throw new Error('missing browser_visibility')
  return {
    read: () =>
      tool.handler({} as never, context) as {
        source: string
        state: string
        hiddenTransitions: number
        hiddenMs: number
      },
    stop: () => (typeof stop === 'function' ? stop() : undefined),
  }
}

function setDocumentVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
  setDocumentVisibility('visible')
  vi.useRealTimers()
})

describe('browser_visibility', () => {
  it('counts every hidden interval of the document, so a hide-and-return between two reads shows', () => {
    vi.useFakeTimers()
    const visibility = started()
    const before = visibility.read()

    setDocumentVisibility('hidden')
    vi.advanceTimersByTime(400)
    setDocumentVisibility('visible')
    const after = visibility.read()
    visibility.stop()

    expect(before).toMatchObject({ source: 'document', state: 'visible', hiddenTransitions: 0 })
    expect(after).toMatchObject({ state: 'visible', hiddenTransitions: 1, hiddenMs: 400 })
  })

  it('reports the page URL at each read, so an in-app navigation shows', () => {
    const visibility = started()
    window.history.pushState(null, '', '/orders/o-1')
    const onOrder = visibility.read()
    window.history.replaceState(null, '', '/')
    const onDashboard = visibility.read()
    visibility.stop()

    expect(onOrder).toMatchObject({ url: 'http://localhost:3000/orders/o-1' })
    expect(onDashboard).toMatchObject({ url: 'http://localhost:3000/' })
  })

  it('reports a document that is hidden right now', () => {
    const visibility = started()
    setDocumentVisibility('hidden')

    expect(visibility.read()).toMatchObject({ state: 'hidden', hiddenTransitions: 1 })
    visibility.stop()
  })

  it('treats a React Native app in the background or inactive as hidden', () => {
    const listeners: ((state: string) => void)[] = []
    const appState: AppStateLike = {
      currentState: 'active',
      addEventListener: (_type, listener) => {
        listeners.push(listener)
        return { remove: () => listeners.splice(listeners.indexOf(listener), 1) }
      },
    }
    const visibility = started(visibilityCollector({ appState }))
    for (const state of ['inactive', 'active', 'background', 'active']) {
      for (const listener of listeners) listener(state)
    }

    expect(visibility.read()).toMatchObject({
      source: 'app-state',
      state: 'visible',
      hiddenTransitions: 2,
    })
    visibility.stop()
    expect(listeners).toEqual([])
  })

  it('says visibility is unobserved instead of reporting visible before it starts', () => {
    const tool = visibilityCollector().tools?.[0]

    expect(tool?.handler({} as never, context)).toMatchObject({
      source: 'unavailable',
      state: 'unknown',
    })
  })
})
