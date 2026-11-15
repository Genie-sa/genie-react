// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement as h, type ReactNode, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MAXIMUM_RENDER_OBSERVATION_BUDGET } from '../../protocol/react-observation-schema'
import { reactCollectorHarness } from '../../test-support/react-collector'
import {
  cohortProblems,
  coverageProblems,
  getRendersProblems,
  renderCausesProblems,
  rendersDiffProblems,
  rendersSinceProblems,
} from '../../test-support/render-result-consistency'
import {
  reactProfileReportContract,
  reactProfileSnapshotContract,
  reactRendersDiffContract,
} from './contracts'
import {
  reactComponentCohortContract,
  reactGetRendersContract,
  reactRenderCausesContract,
  reactRendersSinceContract,
} from './render-contract'

const { call, start, stop } = reactCollectorHarness()
const client = new QueryClient()

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
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

function Cell({ value }: { value: string }): ReactNode {
  return h('td', null, value)
}

function Row({ index, cells, tick }: { index: number; cells: number; tick: number }): ReactNode {
  return h(
    'tr',
    null,
    Array.from({ length: cells }, (_, cell) =>
      h(Cell, { key: cell, value: `${index}:${cell}:${tick}` }),
    ),
  )
}

/** App rows first and one library component last, so the library component sits past the in-call source classification budget. */
function Table({ rows, cells }: { rows: number; cells: number }): ReactNode {
  const [tick, setTick] = useState(0)
  bump = () => setTick((value) => value + 1)
  return h(
    'div',
    null,
    h(
      'table',
      null,
      h(
        'tbody',
        null,
        Array.from({ length: rows }, (_, index) => h(Row, { key: index, index, cells, tick })),
      ),
    ),
    h(QueryClientProvider, { client }, h('span', null, 'library-owned')),
  )
}

async function mountTable(rows: number, cells: number): Promise<void> {
  await call('react_clear_renders', { budget: MAXIMUM_RENDER_OBSERVATION_BUDGET })
  host = document.createElement('div')
  document.body.append(host)
  const created = createRoot(host)
  root = created
  act(() => created.render(h(Table, { rows, cells })))
}

type Result = Record<string, unknown> & {
  sourceClassification: { complete: boolean; unknown: number; affects: string }
  pagination: { totalComponents: number }
  coverage: { complete: boolean; semantics: string }
}

async function rendersUntilClassified(): Promise<Result> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const report = await call<Result>('react_get_renders', { includeCursor: false })
    if (report.sourceClassification.complete) return report
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error('Source classification never completed')
}

describe('render results never contradict themselves', () => {
  it('appOnly membership resolved later changes the count, which is why the partial read could not be exact', async () => {
    await mountTable(70, 2)

    const partial = await call<Result>('react_get_renders', { includeCursor: false })
    const resolved = await rendersUntilClassified()

    expect(partial.sourceClassification.complete).toBe(false)
    expect(resolved.pagination.totalComponents).toBeLessThan(partial.pagination.totalComponents)
    expect(partial.coverage.semantics).not.toBe('exact')
    expect(resolved.coverage).toMatchObject({ complete: true, semantics: 'exact' })
    expect(getRendersProblems(partial)).toEqual([])
    expect(getRendersProblems(resolved)).toEqual([])
  })

  it('every render tool agrees with itself while classification is partial and after an update', async () => {
    await mountTable(70, 2)
    const span = await call<{ handle: string }>('react_measure', { label: 'tick' })
    await call('react_profile_snapshot', { label: 'before' })
    act(() => bump?.())

    for (const appOnly of [true, false]) {
      const renders = await call<Result>('react_get_renders', { appOnly, view: 'full' })
      expect(getRendersProblems(renders), `get_renders appOnly:${appOnly}`).toEqual([])
      reactGetRendersContract.output.parse(renders)

      const causes = await call<Result>('react_render_causes', { appOnly, limit: 500 })
      expect(renderCausesProblems(causes), `render_causes appOnly:${appOnly}`).toEqual([])
      reactRenderCausesContract.output.parse(causes)

      const cohort = await call<Result>('react_component_cohort', {
        component: 'Cell',
        appOnly,
        view: 'full',
      })
      expect(cohortProblems(cohort), `cohort appOnly:${appOnly}`).toEqual([])
      reactComponentCohortContract.output.parse(cohort)

      const since = await call<Result>('react_renders_since', { handle: span.handle, appOnly })
      expect(rendersSinceProblems(since), `renders_since appOnly:${appOnly}`).toEqual([])
      reactRendersSinceContract.output.parse(since)

      const report = await call<Result>('react_profile_report', { appOnly })
      expect(
        coverageProblems('coverage', report.coverage),
        `profile_report appOnly:${appOnly}`,
      ).toEqual([])
      reactProfileReportContract.output.parse(report)
    }

    const snapshot = await call<Result>('react_profile_snapshot', { label: 'after' })
    reactProfileSnapshotContract.output.parse(snapshot)
    const diff = await call<Result>('react_renders_diff', { baseline: 'before' })
    expect(rendersDiffProblems(diff)).toEqual([])
    reactRendersDiffContract.output.parse(diff)
  })

  it('a starved analysis budget is reported as a lower bound everywhere, never as exact', async () => {
    await call('react_clear_renders', { budget: { fiberLimit: 50 } })
    host = document.createElement('div')
    document.body.append(host)
    const created = createRoot(host)
    root = created
    act(() => created.render(h(Table, { rows: 100, cells: 2 })))
    act(() => bump?.())

    const renders = await call<Result>('react_get_renders', { appOnly: false })
    const causes = await call<Result>('react_render_causes', { appOnly: false })

    expect(renders.coverage.complete).toBe(false)
    expect(getRendersProblems(renders)).toEqual([])
    expect(renderCausesProblems(causes)).toEqual([])
  })

  // React 19 records owner stacks for 10,000 elements a second; a 500-row table spends them, so smaller trees run before it to keep their sources.
  it('react_get_renders on a 500-row table does not call app-only coverage exact while most ownership is unresolved', async () => {
    await mountTable(500, 10)

    const report = await call<Result>('react_get_renders', {})

    expect(report.sourceClassification).toMatchObject({ complete: false, affects: 'result' })
    expect(report.coverage).toMatchObject({ complete: false, semantics: 'unknown' })
    expect(getRendersProblems(report)).toEqual([])
    expect(() => reactGetRendersContract.output.parse(report)).not.toThrow()
  })

  it('appOnly:false keeps every component, so unresolved ownership is only a label and coverage stays exact', async () => {
    await mountTable(500, 10)

    const report = await call<Result>('react_get_renders', { appOnly: false })

    expect(report.sourceClassification).toMatchObject({
      complete: false,
      affects: 'ownership-labels',
    })
    expect(report.coverage).toMatchObject({ complete: true, semantics: 'exact' })
    expect(getRendersProblems(report)).toEqual([])
  })
})
