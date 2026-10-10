// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { fireEvent, type RenderResult, render } from '@testing-library/react'
import { type Fiber, getFiberFromHostInstance, getLatestFiber } from 'bippy'
import { Component, createElement, Fragment, type ReactNode, StrictMode, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { findFiberById, findRootFiber, owningComponentFor, registerFiber } from './fiber'
import { wasInstanceObserved } from './instance-identity'
import { getRenderCohort } from './render-cohort'
import {
  clearRenders,
  disposeRenderTracking,
  getRenders,
  getRenderTrackingCoverage,
  startRenderTracking,
  stopRenderTracking,
} from './render-tracker'

vi.mock('bippy/source', () => ({
  getSource: async () => null,
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
}))

let view: RenderResult | null = null

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  expect(startRenderTracking()).toBe(true)
})

afterEach(() => {
  view?.unmount()
  view = null
  disposeRenderTracking()
  vi.restoreAllMocks()
})

// A cold first run can exceed the default 8ms commit budget and truncate the counts under test.
const observe = () => clearRenders({ budget: { timeLimitMs: 500, adaptive: false } })

async function renderCounts(): Promise<Record<string, number[]>> {
  const counts: Record<string, number[]> = {}
  for (const { name, renders } of await getRenders({ sort: 'renders', limit: 100 })) {
    counts[name] = [...(counts[name] ?? []), renders].sort((a, b) => a - b)
  }
  return counts
}

function Row({ label }: { label: string }): ReactNode {
  return createElement('li', null, label)
}

function KeyedList(): ReactNode {
  const [order, setOrder] = useState(['a', 'b'])
  return createElement(
    'ul',
    null,
    createElement('button', { type: 'button', onClick: () => setOrder(['b', 'a', 'c']) }, 'swap'),
    order.map((key) =>
      createElement(
        Fragment,
        { key },
        createElement(Row, { label: key }),
        createElement(Row, { label: `${key}!` }),
      ),
    ),
  )
}

function StrictCounter(): ReactNode {
  const [count, setCount] = useState(0)
  return createElement('button', { type: 'button', onClick: () => setCount(count + 1) }, count)
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }
  override render(): ReactNode {
    return this.state.failed ? createElement(Fallback) : this.props.children
  }
}

function Fallback(): ReactNode {
  return createElement('p', null, 'failed')
}

function InvalidChild(): ReactNode {
  return { invalid: true } as unknown as ReactNode
}

function Toggle(): ReactNode {
  const [shown, setShown] = useState(true)
  return createElement(
    Fragment,
    null,
    createElement('button', { type: 'button', onClick: () => setShown(false) }, 'hide'),
    shown ? createElement(Leaf) : null,
  )
}

function Leaf(): ReactNode {
  return createElement('span', null, 'leaf')
}

function TargetRoot(): ReactNode {
  return createElement('section', null, createElement(Leaf))
}

function Sibling(): ReactNode {
  return null
}

function TargetToggle(): ReactNode {
  const [shown, setShown] = useState(true)
  return createElement(
    Fragment,
    null,
    createElement('button', { type: 'button', onClick: () => setShown(false) }, 'hide'),
    shown ? createElement(TargetRoot) : null,
    shown ? createElement(Sibling) : null,
    shown ? createElement(Sibling) : null,
  )
}

const leafCohort = () =>
  getRenderCohort(
    findRootFiber(),
    { component: 'Leaf', exact: true, limit: 10 },
    {
      skippedCommitFibers: 0,
      droppedUnmountFibers: 0,
      analysisFailedFibers: 0,
      truncatedInputFibers: 0,
    },
  )

const firstHookState = (fiber: Fiber | null): unknown => fiber?.memoizedState?.memoizedState

describe('render tracking against a live React tree', () => {
  it('counts keyed Fragment children once per commit and never reports the Fragment', async () => {
    view = render(createElement(KeyedList))
    observe()

    fireEvent.click(view.getByText('swap'))

    expect(await renderCounts()).toEqual({ KeyedList: [1], Row: [1, 1, 1, 1, 1, 1] })
  })

  it('counts StrictMode double renders as one render per commit', async () => {
    view = render(createElement(StrictMode, null, createElement(StrictCounter)))
    observe()

    fireEvent.click(view.getByRole('button'))
    fireEvent.click(view.getByRole('button'))

    expect(view.getByRole('button').textContent).toBe('2')
    expect(await renderCounts()).toEqual({ StrictCounter: [2] })
  })

  it('records the boundary fallback without reporting the Throw fiber React inserts for an invalid child', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    observe()

    view = render(createElement(Boundary, null, createElement(InvalidChild)))

    expect(view.container.textContent).toBe('failed')
    expect(await renderCounts()).toEqual({ Boundary: [1], Fallback: [1] })
  })

  it('keeps the mounted identity when an unmount is recorded after the commit', async () => {
    view = render(createElement(Toggle))
    observe()
    const mounted = (await leafCohort()).instances[0]
    expect(mounted?.renderingState).toBe('mounted-rendering')

    fireEvent.click(view.getByText('hide'))

    const [unmounted] = (await leafCohort()).instances
    expect(unmounted?.renderingState).toBe('unmounted')
    expect(unmounted?.instance.mountId).toBe(mounted?.instance.mountId)
  })

  it('keeps descendants of an unmounted observation root targeted after bippy releases its id', async () => {
    view = render(createElement(TargetToggle))
    const section = view.container.querySelector('section')
    const targetRoot = section && getFiberFromHostInstance(section)?.return
    if (!targetRoot) throw new Error('TargetRoot has no fiber')
    clearRenders({
      roots: [registerFiber(targetRoot)],
      lifecycle: { bufferLimit: 2, targetReserve: 2 },
    })

    fireEvent.click(view.getByText('hide'))

    const [unmounted] = (await leafCohort()).instances
    expect(unmounted?.renderingState).toBe('unmounted')
    expect(getRenderTrackingCoverage('measurement').targeted?.complete).toBe(true)
  })

  it('forgets the mounted identity of an instance that unmounts while collection is paused', async () => {
    observe()
    view = render(createElement(Toggle))
    const leafId = (await leafCohort()).instances[0]?.instance.fiberId ?? -1
    expect(wasInstanceObserved(leafId)).toBe(true)

    stopRenderTracking()
    fireEvent.click(view.getByText('hide'))
    expect(startRenderTracking()).toBe(true)

    expect(wasInstanceObserved(leafId)).toBe(false)
    expect((await leafCohort()).instances).toEqual([])
  })

  it('resolves a stale alternate to the fiber React committed last', () => {
    view = render(createElement(StrictCounter))
    const button = view.getByRole('button')
    const before = owningComponentFor(button, 1)
    if (!before) throw new Error('StrictCounter has no owning fiber')

    fireEvent.click(button)

    expect(firstHookState(before.fiber)).toBe(0)
    expect(firstHookState(getLatestFiber(before.fiber))).toBe(1)
    const root = findRootFiber()
    if (!root) throw new Error('No committed root')
    expect(firstHookState(findFiberById(root, registerFiber(before.fiber)))).toBe(1)
  })
})
