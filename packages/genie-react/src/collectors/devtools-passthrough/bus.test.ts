import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DevtoolsBusEvent } from './bus'
import { emitToDevtoolsBus, pluginIdFromEvent, subscribeToDevtoolsBus } from './bus'

function installBusTarget(): EventTarget {
  const target = new EventTarget()
  globalThis.__TANSTACK_EVENT_TARGET__ = target
  return target
}

function respondToConnect(target: EventTarget): void {
  target.addEventListener('tanstack-connect', () => {
    target.dispatchEvent(new CustomEvent('tanstack-connect-success'))
  })
}

afterEach(() => {
  globalThis.__TANSTACK_EVENT_TARGET__ = undefined
})

describe('emitToDevtoolsBus', () => {
  it('returns false when no bus target exists', () => {
    expect(emitToDevtoolsBus({ type: 'demo:ping' })).toBe(false)
  })

  it('returns false and stays silent when nothing acknowledges the connect probe', () => {
    const target = installBusTarget()
    const received = vi.fn()
    target.addEventListener('tanstack-dispatch-event', received)

    expect(emitToDevtoolsBus({ type: 'demo:ping' })).toBe(false)
    expect(received).not.toHaveBeenCalled()
  })

  it('dispatches on the bus once a live bus acknowledges the probe', () => {
    const target = installBusTarget()
    respondToConnect(target)
    const received: DevtoolsBusEvent[] = []
    target.addEventListener('tanstack-dispatch-event', (event) => {
      received.push((event as CustomEvent<DevtoolsBusEvent>).detail)
    })

    const emitted = emitToDevtoolsBus({ pluginId: 'demo', type: 'demo:ping', payload: { n: 1 } })

    expect(emitted).toBe(true)
    expect(received).toEqual([{ pluginId: 'demo', type: 'demo:ping', payload: { n: 1 } }])
  })
})

describe('subscribeToDevtoolsBus', () => {
  it('receives well-formed global-channel events and ignores malformed details', () => {
    const target = installBusTarget()
    const seen: DevtoolsBusEvent[] = []
    const unsubscribe = subscribeToDevtoolsBus((event) => seen.push(event))

    target.dispatchEvent(
      new CustomEvent('tanstack-devtools-global', { detail: { type: 'demo:tick', payload: 1 } }),
    )
    target.dispatchEvent(new CustomEvent('tanstack-devtools-global', { detail: 'garbage' }))
    unsubscribe()
    target.dispatchEvent(
      new CustomEvent('tanstack-devtools-global', { detail: { type: 'demo:late' } }),
    )

    expect(seen).toEqual([{ type: 'demo:tick', payload: 1 }])
  })
})

describe('pluginIdFromEvent', () => {
  it('prefers the explicit pluginId, then the type prefix, then unknown', () => {
    expect(pluginIdFromEvent({ type: 'a:b', pluginId: 'explicit' })).toBe('explicit')
    expect(pluginIdFromEvent({ type: 'cart-devtools:cart-updated' })).toBe('cart-devtools')
    expect(pluginIdFromEvent({ type: 'no-separator' })).toBe('unknown')
  })
})
