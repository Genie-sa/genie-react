// @vitest-environment jsdom
import './hook'
import { createElement, memo, type ReactNode, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, mount, startCollector, unmountAll } from '../../test-support/react-app'
import { clearRenders, disposeRenderTracking, startRenderTracking } from './render-tracker'

vi.mock('bippy/source', () => ({
  getSource: async () => null,
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
}))

const ROWS = 100

interface CohortRow {
  status: string
  mountId: string
  key?: string | null
  logicalPath: string
  outsidePrefix?: true
  parent?: { name: string }
  instance?: { logicalPath: string; mountId: string }
}

interface Cohort {
  view: 'summary' | 'full'
  matched: number
  mountedUpdated: number
  mountedIdle: number
  shared?: { componentName?: string; logicalPathPrefix: string; parent?: { name: string } }
  instances: CohortRow[]
}

beforeEach(() => {
  expect(startRenderTracking()).toBe(true)
})

afterEach(async () => {
  await unmountAll()
  disposeRenderTracking()
})

describe('react_component_cohort output', () => {
  it('states shared fields once, so a hundred-row cohort stays small without losing a row', async () => {
    const MATCHED = ROWS + 1
    const OrderRow = memo(function OrderRow({ id, selected }: { id: number; selected: boolean }) {
      return createElement('li', { className: selected ? 'selected' : undefined }, id)
    })
    let select: (id: number) => void = () => {}
    function OrdersTable(): ReactNode {
      const [selected, setSelected] = useState(-1)
      select = setSelected
      return createElement(
        'ul',
        null,
        Array.from({ length: ROWS }, (_, id) =>
          createElement(OrderRow, { key: `o-${id}`, id, selected: id === selected }),
        ),
      )
    }
    function Layout({ children }: { children: ReactNode }): ReactNode {
      return createElement('main', null, children)
    }
    function Preview(): ReactNode {
      return createElement('aside', null, createElement(OrderRow, { id: -1, selected: false }))
    }
    let tree: ReactNode = createElement(
      'div',
      null,
      createElement(OrdersTable),
      createElement(Preview),
    )
    for (let layer = 0; layer < 20; layer += 1) tree = createElement(Layout, null, tree)
    await mount(tree)
    clearRenders({ budget: { timeLimitMs: 500, adaptive: false, fiberLimit: 1_000 } })
    await act(() => select(7))
    const collector = startCollector()

    const summary = await collector.call<Cohort>('react_component_cohort', {
      component: 'OrderRow',
      limit: MATCHED,
    })
    const full = await collector.call<Cohort>('react_component_cohort', {
      component: 'OrderRow',
      limit: MATCHED,
      view: 'full',
    })
    collector.stop()

    expect(summary).toMatchObject({ view: 'summary', matched: MATCHED, mountedUpdated: 1 })
    expect(full).toMatchObject({ view: 'full', matched: MATCHED, mountedUpdated: 1 })
    expect(summary.shared).toMatchObject({
      componentName: 'OrderRow',
      parent: { name: 'OrdersTable' },
    })
    expect(summary.shared?.logicalPathPrefix).toMatch(/OrdersTable\[index=0\] > <ul>\[index=0\]$/)
    expect(summary.instances).toHaveLength(MATCHED)
    const fullPaths = new Set(full.instances.map((row) => row.instance?.logicalPath))
    for (const row of summary.instances) {
      const path = row.outsidePrefix
        ? row.logicalPath
        : `${summary.shared?.logicalPathPrefix} > ${row.logicalPath}`
      expect(fullPaths.has(path)).toBe(true)
    }
    expect(summary.instances.find((row) => row.outsidePrefix)).toMatchObject({
      parent: { name: 'Preview' },
    })
    expect(summary.instances.find((row) => row.status === 'mounted-updated')).toMatchObject({
      key: 'o-7',
      logicalPath: 'OrderRow[key="o-7"]',
    })
    const perRow = JSON.stringify(summary).length / MATCHED
    expect(perRow).toBeLessThan(250)
    expect(JSON.stringify(full).length / MATCHED).toBeGreaterThan(4 * perRow)
  })
})
