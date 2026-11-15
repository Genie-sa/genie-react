// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { fireEvent, type RenderResult, render } from '@testing-library/react'
import { type Fiber, getFiberFromHostInstance, isCompositeFiber } from 'bippy'
import { Component, createElement, type ReactNode, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectorContext } from '../../client'
import { reactCollector } from './collector'
import { getErrorState } from './error-tracker'
import { findRootFiber, registerFiber } from './fiber'
import { clearInstanceIdentityForTests } from './instance-identity'
import {
  clearMeasurementSpans,
  openMeasurementSpan,
  readMeasurementSpan,
} from './measurement-spans'
import { holdCommitAnalysis, resetObservationStateForTests } from './observation'
import { getRenderCohort } from './render-cohort'
import {
  clearRenders,
  disposeRenderTracking,
  getPausedCommitCount,
  getRenders,
  getRenderTrackingCoverage,
  getUnobservedCommitCount,
  isTracking,
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

/** The state of a page that loaded Genie and has not been asked anything yet. */
function loadWithoutWindow(): void {
  expect(startRenderTracking()).toBe(true)
  clearRenders()
  resetObservationStateForTests()
  clearInstanceIdentityForTests()
  clearMeasurementSpans()
}

const openWindow = () => clearRenders({ budget: { timeLimitMs: 500, adaptive: false } })

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  loadWithoutWindow()
})

afterEach(() => {
  view?.unmount()
  view = null
  disposeRenderTracking()
})

function Leaf(): ReactNode {
  return createElement('p', null, 'leaf')
}

function Toggle({ initiallyShown }: { initiallyShown: boolean }): ReactNode {
  const [shown, setShown] = useState(initiallyShown)
  const [bumps, setBumps] = useState(0)
  return createElement(
    'div',
    null,
    createElement('button', { type: 'button', onClick: () => setShown(!shown) }, 'toggle'),
    createElement('button', { type: 'button', onClick: () => setBumps(bumps + 1) }, 'bump'),
    shown ? createElement(Leaf, { bumps }) : null,
  )
}

const click = (label: string) => {
  if (!view) throw new Error('nothing rendered')
  fireEvent.click(view.getByText(label))
}

async function leafInstances() {
  const cohort = await getRenderCohort(
    findRootFiber(),
    { component: 'Leaf', exact: true, limit: 10 },
    {
      skippedCommitFibers: 0,
      droppedUnmountFibers: 0,
      analysisFailedFibers: 0,
      unobservedCommits: getUnobservedCommitCount(),
      truncatedInputFibers: 0,
    },
  )
  return cohort.instances
}

describe('commits before any window', () => {
  it('records no renders and says the commits were not observed, then records once a window opens', async () => {
    view = render(createElement(Toggle, { initiallyShown: true }))
    click('toggle')
    click('toggle')

    expect(isTracking()).toBe(false)
    expect(await getRenders({ sort: 'renders', limit: 10 })).toEqual([])
    const before = getRenderTrackingCoverage('measurement')
    expect(before).toMatchObject({ complete: false, unobservedCommits: 3, droppedUnmountFibers: 0 })
    expect(before.incompleteBecause?.map((entry) => entry.reason)).toEqual(['commits-not-observed'])

    openWindow()
    click('bump')

    expect(isTracking()).toBe(true)
    expect(await getRenders({ sort: 'renders', limit: 10 })).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Toggle', renders: 1 }),
        expect.objectContaining({ name: 'Leaf', renders: 1 }),
      ]),
    )
    expect(getRenderTrackingCoverage('measurement')).toMatchObject({
      complete: true,
      unobservedCommits: 0,
    })
  })

  it('does not report a mounted component idle when no window watched it', async () => {
    view = render(createElement(Toggle, { initiallyShown: true }))
    click('bump')

    const [leaf] = await leafInstances()
    expect(leaf?.status).toBe('mounted-unknown')
  })

  it.each([
    { mountedBy: 'the first commit of the root', initiallyShown: true, clicksBeforeWindow: 1 },
    { mountedBy: 'a later commit', initiallyShown: false, clicksBeforeWindow: 2 },
  ])(
    'numbers a remount in a window after an earlier mount by $mountedBy that no window saw',
    async ({ initiallyShown, clicksBeforeWindow }) => {
      view = render(createElement(Toggle, { initiallyShown }))
      for (let clicks = 0; clicks < clicksBeforeWindow; clicks += 1) click('toggle')

      openWindow()
      click('toggle')

      const [leaf] = await leafInstances()
      expect(leaf?.instance).toMatchObject({ mountGeneration: 2, mountGenerationEvidence: 'exact' })
    },
  )

  it('keeps generation 1 for an instance mounted before the window and only updated in it', async () => {
    view = render(createElement(Toggle, { initiallyShown: false }))
    click('toggle')

    openWindow()
    click('bump')

    const [leaf] = await leafInstances()
    expect(leaf?.instance).toMatchObject({ mountGeneration: 1, mountGenerationEvidence: 'exact' })
  })

  it('still records an error boundary catch', async () => {
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
      override state = { failed: false }
      static getDerivedStateFromError() {
        return { failed: true }
      }
      override render() {
        return this.state.failed ? createElement('p', null, 'fallback') : this.props.children
      }
    }
    function Thrower({ fail }: { fail: boolean }): ReactNode {
      if (fail) throw new Error('boom before any window')
      return null
    }
    function Page(): ReactNode {
      const [fail, setFail] = useState(false)
      return createElement(
        'div',
        null,
        createElement('button', { type: 'button', onClick: () => setFail(true) }, 'fail'),
        createElement(Boundary, null, createElement(Thrower, { fail })),
      )
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    view = render(createElement(Page))
    click('fail')

    const state = await getErrorState({ includeSource: false, afterDocumentCommitId: 0 })
    expect(state.caughtErrors).toMatchObject([{ boundaryName: 'Boundary', status: 'active' }])
    expect(state.catchLog?.catches).toMatchObject([
      { boundaryName: 'Boundary', observationId: null },
    ])
  })
})

describe('recordings that keep the analysis running without a window', () => {
  it('analyses commits while a hold is open and stops when it is released', async () => {
    view = render(createElement(Toggle, { initiallyShown: true }))
    const release = holdCommitAnalysis()
    click('bump')
    release()
    click('bump')

    expect(await getRenders({ sort: 'renders', limit: 10 })).toMatchObject(
      expect.arrayContaining([expect.objectContaining({ name: 'Leaf', renders: 1 })]),
    )
    expect(getUnobservedCommitCount()).toBe(2)
    expect(isTracking()).toBe(false)
  })

  it('does not resume a window that react_profile_stop froze', async () => {
    view = render(createElement(Toggle, { initiallyShown: true }))
    openWindow()
    click('bump')
    stopRenderTracking()
    const release = holdCommitAnalysis()
    click('bump')
    release()

    expect(await getRenders({ sort: 'renders', limit: 10 })).toMatchObject(
      expect.arrayContaining([expect.objectContaining({ name: 'Leaf', renders: 1 })]),
    )
    expect(getPausedCommitCount()).toBe(1)
    expect(getUnobservedCommitCount()).toBe(0)
  })

  it('gives a measurement span opened without a window complete evidence of its commits', async () => {
    view = render(createElement(Toggle, { initiallyShown: true }))
    const { handle } = openMeasurementSpan('bump without a window')
    click('bump')

    const span = await readMeasurementSpan(handle, true, { sort: 'renders', limit: 10 })
    expect(span.coverage.complete).toBe(true)
    expect(span.components).toMatchObject(
      expect.arrayContaining([expect.objectContaining({ name: 'Leaf', renders: 1 })]),
    )

    click('bump')
    expect(isTracking()).toBe(false)
  })
})

describe('tools that need a commit but no window', () => {
  const context: CollectorContext = {
    pushSnapshot() {},
    pushEvent() {},
    refreshTools() {},
    markActivity() {},
  }
  function callTool<T>(name: string, args: unknown): T {
    const tool = reactCollector().tools?.find((entry) => entry.contract.name === name)
    if (!tool) throw new Error(`tool not found: ${name}`)
    return tool.handler(args as never, context) as T
  }
  function toggleId(): number {
    const button = view?.getByText('bump')
    let fiber: Fiber | null | undefined = button ? getFiberFromHostInstance(button) : null
    while (fiber && !isCompositeFiber(fiber)) fiber = fiber.return
    if (!fiber) throw new Error('Toggle has no fiber')
    return registerFiber(fiber)
  }

  it('sees the commit a hook-state override causes', async () => {
    view = render(createElement(Toggle, { initiallyShown: true }))

    const result = await callTool<Promise<{ commitObserved: boolean | null }>>(
      'react_override_hook_state',
      { id: toggleId(), hookIndex: 1, path: [], value: 5 },
    )

    expect(result.commitObserved).toBe(true)
    expect(isTracking()).toBe(false)
  })

  it('opens a measurement span, but not while react_profile_stop has paused recording', () => {
    view = render(createElement(Toggle, { initiallyShown: true }))

    expect(callTool<{ handle: string }>('react_measure', { label: 'no window' }).handle).toEqual(
      expect.any(String),
    )
    stopRenderTracking()
    expect(() => callTool('react_measure', { label: 'paused' })).toThrow(/react_profile_stop/)
  })
})
