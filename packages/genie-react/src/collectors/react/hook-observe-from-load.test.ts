// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { freezeAnalysisClock } from '../../test-support/analysis-clock'

vi.mock('bippy/source', () => ({
  getSource: async () => null,
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
}))

let unmount: () => void = () => {}

beforeAll(async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  freezeAnalysisClock()
  window.history.replaceState(null, '', '/issues/CORE-12?_genie=agent&_genie_observe')
  await import('./hook')
  const { createElement, StrictMode, useEffect } = await import('react')
  const { render } = await import('@testing-library/react')
  function Presence() {
    useEffect(() => () => {}, [])
    return createElement('p', null, 'viewing now')
  }
  unmount = render(createElement(StrictMode, null, createElement(Presence))).unmount
})

afterAll(() => unmount())

describe('_genie_observe in the page URL', () => {
  it('observes the page load, so the first mount and its StrictMode replay are recorded without a tool call', async () => {
    const { getActiveObservation } = await import('./observation')
    const { getRenders, getRenderTrackingCoverage, isTracking } = await import('./render-tracker')
    const { getEffectScheduleEventsWithOwnership } = await import('./effect-events')

    expect(isTracking()).toBe(true)
    expect(getActiveObservation()).toMatchObject({ startedAfterDocumentCommitId: 0 })
    expect(await getRenders({ sort: 'renders', limit: 10 })).toMatchObject([
      { name: 'Presence', mounts: 1 },
    ])
    expect(getRenderTrackingCoverage('measurement')).toMatchObject({
      complete: true,
      unobservedCommits: 0,
    })
    const { events } = await getEffectScheduleEventsWithOwnership({
      component: 'Presence',
      exact: true,
      limit: 10,
      appOnly: false,
    })
    expect(
      events.flatMap((event) => event.timeline.map((stage) => stage.trigger ?? null)),
    ).toContain('strict-mode-replay')
  })
})
