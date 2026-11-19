// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { act, createElement as h, type ReactNode, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MAXIMUM_RENDER_OBSERVATION_BUDGET } from '../../protocol/react-observation-schema'
import { freezeAnalysisClock } from '../../test-support/analysis-clock'
import { reactCollectorHarness } from '../../test-support/react-collector'
import { renderCausesProblems } from '../../test-support/render-result-consistency'
import { reactRenderCausesContract } from './render-contract'

const { call, start, stop } = reactCollectorHarness()

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  freezeAnalysisClock()
  start()
})
afterAll(stop)

let root: Root | null = null
let host: HTMLElement | null = null
let bump: (() => void) | null = null

afterEach(() => {
  act(() => root?.unmount())
  root = null
  bump = null
  host?.remove()
  host = null
})

const ROWS = 200
const KEYSTROKES = 6

function AccountMenu({ tick }: { tick: number }): ReactNode {
  return h('span', null, `account ${tick}`)
}

function IssueRow({ index, tick }: { index: number; tick: number }): ReactNode {
  return h('li', null, `${index}:${tick}`)
}

/** Every keystroke re-renders the menu first and a 200-row table after it, the shape of the Acme Tracker issue filter. */
function IssuesPage(): ReactNode {
  const [tick, setTick] = useState(0)
  bump = () => setTick((value) => value + 1)
  return h(
    'main',
    null,
    h(AccountMenu, { tick }),
    h(
      'ul',
      null,
      Array.from({ length: ROWS }, (_, index) => h(IssueRow, { key: index, index, tick })),
    ),
  )
}

interface CausesResult extends Record<string, unknown> {
  events: unknown[]
  renderEventRetention: { evictedEvents: number }
  coverage: {
    complete: boolean
    incompleteBecause?: {
      reason: string
      fibers: number
      components?: string[]
      detail: string
      next?: string
    }[]
  }
}

async function typeIntoFilter(window: Record<string, unknown>): Promise<CausesResult> {
  await call('react_clear_renders', { ...window, budget: MAXIMUM_RENDER_OBSERVATION_BUDGET })
  host = document.createElement('div')
  document.body.append(host)
  const created = createRoot(host)
  root = created
  act(() => created.render(h(IssuesPage)))
  for (let keystroke = 0; keystroke < KEYSTROKES; keystroke += 1) act(() => bump?.())
  return call<CausesResult>('react_render_causes', {
    component: 'AccountMenu',
    appOnly: false,
    limit: 50,
  })
}

const evictionOf = (result: CausesResult) =>
  result.coverage.incompleteBecause?.find((entry) => entry.reason === 'render-events-evicted')

describe('render events past the 1000-event history', () => {
  it('keeps every render of the component the window names while a busy table overflows the history', async () => {
    const result = await typeIntoFilter({ component: 'AccountMenu' })

    expect(result.renderEventRetention.evictedEvents).toBeGreaterThan(0)
    expect(result.events).toHaveLength(1 + KEYSTROKES)
    expect(evictionOf(result)).toMatchObject({ fibers: 0 })
    expect(evictionOf(result)?.detail).toContain('none of them renders of the components')
    expect(renderCausesProblems(result)).toEqual([])
    reactRenderCausesContract.output.parse(result)
  })

  it('says which component the read selects lost events, and how to keep them, when the window names none', async () => {
    const result = await typeIntoFilter({})

    expect(result.events.length).toBeLessThan(1 + KEYSTROKES)
    expect(result.coverage.complete).toBe(false)
    expect(evictionOf(result)).toMatchObject({
      fibers: 1 + KEYSTROKES - result.events.length,
      components: ['AccountMenu'],
      next: expect.stringContaining('react_clear_renders with component'),
    })
    expect(renderCausesProblems(result)).toEqual([])
    reactRenderCausesContract.output.parse(result)
  })
})
