// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { act, render } from '@testing-library/react'
import { createElement, type ReactNode, useState } from 'react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectorContext } from '../../client'
import { reactCollector } from './collector'

vi.mock('bippy/source', () => ({
  getSource: async () => null,
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
}))

/** A router-style app: the list sits 40 layout layers deep, and each row renders three components. */
const ROWS = 300
const LAYERS = 40

const context: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}
const collector = reactCollector()
let stop: (() => void) | undefined
let unmount: (() => void) | undefined
let selectRow: (id: number) => void = () => {}

async function call<T>(name: string, input: unknown): Promise<T> {
  const tool = collector.tools?.find((candidate) => candidate.contract.name === name)
  if (!tool) throw new Error(`Missing tool ${name}`)
  return (await tool.handler(tool.contract.input.parse(input) as never, context)) as T
}

function Cell({ value }: { value: string }): ReactNode {
  return createElement('td', null, value)
}

function Row({ id, selected }: { id: number; selected: boolean }): ReactNode {
  return createElement(
    'tr',
    { className: selected ? 'selected' : undefined },
    createElement(Cell, { value: `#${id}` }),
    createElement(Cell, { value: 'open' }),
  )
}

function IssueTable(): ReactNode {
  const [selected, setSelected] = useState(-1)
  selectRow = setSelected
  return createElement(
    'table',
    null,
    createElement(
      'tbody',
      null,
      Array.from({ length: ROWS }, (_, id) =>
        createElement(Row, { key: id, id, selected: id === selected }),
      ),
    ),
  )
}

function Layer({ children }: { children: ReactNode }): ReactNode {
  return createElement('div', null, children)
}

interface Coverage {
  complete: boolean
  skippedCommitFibers: number
  budgetAdvice?: { exhaustedLimits: string[]; suggestedBudget: Record<string, number> }
}

beforeAll(async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  stop = collector.start?.(context) || undefined
  let tree: ReactNode = createElement(IssueTable)
  for (let layer = 0; layer < LAYERS; layer += 1) tree = createElement(Layer, null, tree)
  await act(async () => {
    unmount = render(tree).unmount
  })
})

afterAll(() => {
  unmount?.()
  stop?.()
})

// A frozen clock keeps the time limit out of these cases, so only the fiber and operation limits decide coverage.
beforeEach(() => {
  vi.spyOn(performance, 'now').mockReturnValue(0)
})

let nextRow = 0
async function selectNextRowAndReadCoverage(): Promise<Coverage> {
  const row = nextRow
  nextRow += 1
  await act(async () => selectRow(row))
  return (await call<{ coverage: Coverage }>('react_render_causes', { limit: 1, appOnly: false }))
    .coverage
}

describe('render budget on a deep tree', () => {
  it('covers a commit that re-renders a few hundred rows with the default budget', async () => {
    await call('react_clear_renders', {})

    expect(await selectNextRowAndReadCoverage()).toMatchObject({
      complete: true,
      skippedCommitFibers: 0,
    })
  })

  it('suggests a budget that covers the same commit on the first retry', async () => {
    await call('react_clear_renders', { budget: { adaptive: false, fiberLimit: 2_000 } })

    const lossy = await selectNextRowAndReadCoverage()

    expect(lossy.complete).toBe(false)
    expect(lossy.budgetAdvice?.exhaustedLimits).toContain('operationLimit')
    await call('react_clear_renders', {
      budget: { ...lossy.budgetAdvice?.suggestedBudget, adaptive: false },
    })
    expect(await selectNextRowAndReadCoverage()).toMatchObject({
      complete: true,
      skippedCommitFibers: 0,
    })
  })
})
