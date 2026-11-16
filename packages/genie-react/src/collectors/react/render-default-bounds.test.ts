// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { act, createElement as h, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MAXIMUM_RENDER_OBSERVATION_BUDGET } from '../../protocol/react-observation-schema'
import { freezeAnalysisClock } from '../../test-support/analysis-clock'
import { reactCollectorHarness } from '../../test-support/react-collector'

const { call, start, stop } = reactCollectorHarness()
const ROWS = 500
const CELLS = 10

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  freezeAnalysisClock()
  start()
})
afterAll(stop)

let root: Root | null = null
let host: HTMLElement | null = null

afterEach(() => {
  act(() => root?.unmount())
  root = null
  host?.remove()
  host = null
})

function Cell({ value }: { value: string }): ReactNode {
  return h('td', null, value)
}

function OrderRow({ index }: { index: number }): ReactNode {
  return h(
    'tr',
    null,
    Array.from({ length: CELLS }, (_, cell) => h(Cell, { key: cell, value: `${index}:${cell}` })),
  )
}

function OrdersTable(): ReactNode {
  return h(
    'table',
    null,
    h(
      'tbody',
      null,
      Array.from({ length: ROWS }, (_, index) => h(OrderRow, { key: index, index })),
    ),
  )
}

interface RenderReport {
  components: unknown[]
  omittedByLimit: number
  nextCursor: string | null
  sourceClassification: { totalCandidates: number }
  pagination: { snapshotId: string | null; totalComponents: number; cursorOmitted?: string }
}

describe('react_get_renders with default arguments on a 500-row table', () => {
  it('returns one bounded page that says which rows it left out, not an error', async () => {
    await call('react_clear_renders', { budget: MAXIMUM_RENDER_OBSERVATION_BUDGET })
    host = document.createElement('div')
    document.body.append(host)
    const created = createRoot(host)
    root = created
    act(() => created.render(h(OrdersTable)))
    const matched = ROWS * (CELLS + 1) + 1

    const report = await call<RenderReport>('react_get_renders', {})

    expect(report.sourceClassification.totalCandidates).toBe(matched)
    expect(report.components.length).toBeLessThanOrEqual(40)
    expect(report.omittedByLimit).toBe(report.pagination.totalComponents - report.components.length)
    expect(report.nextCursor).toBeNull()
    expect(report.pagination).toMatchObject({ snapshotId: null, cursorOmitted: 'candidate-limit' })
  })
})
