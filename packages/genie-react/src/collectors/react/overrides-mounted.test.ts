// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { act, cleanup, render } from '@testing-library/react'
import { type Fiber, getFiberFromHostInstance } from 'bippy'
import { createElement, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { findRootFiber, nearestCompositeFiber } from './fiber'
import {
  applyHookStateOverride,
  type DevRenderer,
  listOverrides,
  overrideFiberProps,
  resetOverrides,
} from './overrides'

// A no-op renderer: mounted-detection and registry bookkeeping go through the real jsdom fiber tree, not the renderer, so it need not actually mutate anything.
function recordingRenderer(): { renderer: DevRenderer; propsCalls: unknown[] } {
  const propsCalls: unknown[] = []
  return {
    propsCalls,
    renderer: {
      scheduleUpdate: () => {},
      overrideProps: (f, path, value) => void propsCalls.push([f, path, value]),
    },
  }
}

const asFiber = (shape: unknown): Fiber => shape as Fiber

afterEach(() => {
  resetOverrides(recordingRenderer().renderer)
  cleanup()
})

function Panel(): ReturnType<typeof createElement> {
  return createElement('div', { 'data-testid': 'host' }, 'x')
}

describe('override registry against a live tree', () => {
  it('lists a props override as mounted with a real componentId, and reset restores it', () => {
    const { getByTestId } = render(createElement(Panel))
    const host = getFiberFromHostInstance(getByTestId('host'))
    const owner = nearestCompositeFiber(asFiber(host))
    expect(owner).not.toBeNull()
    expect(findRootFiber()).not.toBeNull()

    const harness = recordingRenderer()
    overrideFiberProps(asFiber(owner), { title: 'GENIE OVERRIDE' }, harness.renderer)

    const listed = listOverrides()
    expect(listed.total).toBe(1)
    expect(listed.overrides[0]?.mounted).toBe(true)
    expect(typeof listed.overrides[0]?.componentId).toBe('number')

    const reset = resetOverrides(harness.renderer)
    expect(reset.cleared[0]?.outcome).toBe('restored')
    // Restore re-applies via the renderer: one call for the override, one for the reset.
    expect(harness.propsCalls).toHaveLength(2)
    expect(listOverrides().total).toBe(0)
  })

  it('restores a hook override on screen through the buffer React committed last', () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    function Flag(): ReturnType<typeof createElement> {
      const [label] = useState('real')
      return createElement('span', { 'data-testid': 'flag' }, label)
    }
    const { getByTestId } = render(createElement(Flag))
    const owner = asFiber(
      nearestCompositeFiber(asFiber(getFiberFromHostInstance(getByTestId('flag')))),
    )

    act(() => {
      applyHookStateOverride(owner, { stateIndex: 0 }, [], 'forced')
    })
    expect(getByTestId('flag').textContent).toBe('forced')

    let outcome: string | undefined
    act(() => {
      outcome = resetOverrides().cleared[0]?.outcome
    })
    expect(outcome).toBe('restored')
    expect(getByTestId('flag').textContent).toBe('real')
  })
})
