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

const ROWS = 900

const context: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}
const collector = reactCollector()
let stop: (() => void) | undefined
let unmount: (() => void) | undefined
let rerenderEveryRow: () => void = () => {}
let rerenderCounterOnly: () => void = () => {}

async function call<T>(name: string, input: unknown): Promise<T> {
  const tool = collector.tools?.find((candidate) => candidate.contract.name === name)
  if (!tool) throw new Error(`Missing tool ${name}`)
  return (await tool.handler(tool.contract.input.parse(input) as never, context)) as T
}

function Row({ tick }: { tick: number }): ReactNode {
  return createElement('li', null, tick)
}

function Counter(): ReactNode {
  const [count, setCount] = useState(0)
  rerenderCounterOnly = () => setCount((value) => value + 1)
  return createElement('output', null, count)
}

function Table(): ReactNode {
  const [tick, setTick] = useState(0)
  rerenderEveryRow = () => setTick((value) => value + 1)
  return createElement(
    'ul',
    null,
    createElement(Counter),
    Array.from({ length: ROWS }, (_, index) => createElement(Row, { key: index, tick })),
  )
}

interface ClearResult {
  observationConfig: { adaptiveScale: number; fiberLimit: number }
}

interface CausesResult {
  coverage: {
    complete: boolean
    skippedCommitFibers: number
    budgetAdvice?: {
      exhaustedLimits: string[]
      suggestedBudget: Record<string, number>
      next: string
    }
  }
}

beforeAll(async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  stop = collector.start?.(context) || undefined
  await act(async () => {
    unmount = render(createElement(Table)).unmount
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

async function rerenderAndReadCauses(): Promise<CausesResult> {
  await act(async () => rerenderEveryRow())
  return call<CausesResult>('react_render_causes', { limit: 1 })
}

describe('render budget on a tree larger than the default fiber limit', () => {
  it('sizes an adaptive window from the mounted tree, so the first full re-render is complete', async () => {
    const cleared = await call<ClearResult>('react_clear_renders', {
      budget: { adaptive: true },
    })

    expect(cleared.observationConfig.fiberLimit).toBeGreaterThanOrEqual(ROWS + 1)
    const causes = await rerenderAndReadCauses()
    expect(causes.coverage).toMatchObject({ complete: true, skippedCommitFibers: 0 })
    expect(causes.coverage.budgetAdvice).toBeUndefined()
  })

  it('keeps the tree-sized budget through a run of small commits', async () => {
    await call('react_clear_renders', { budget: { adaptive: true } })
    for (let commit = 0; commit < 40; commit += 1) {
      await act(async () => rerenderCounterOnly())
    }

    const causes = await rerenderAndReadCauses()

    expect(causes.coverage).toMatchObject({ complete: true, skippedCommitFibers: 0 })
  })

  it('names the fiber limit that ran out and suggests a budget that fits the next capture', async () => {
    await call('react_clear_renders', { budget: { adaptive: false } })

    const lossy = await rerenderAndReadCauses()

    expect(lossy.coverage.complete).toBe(false)
    expect(lossy.coverage.budgetAdvice?.exhaustedLimits).toEqual(['fiberLimit'])
    const suggestedBudget = lossy.coverage.budgetAdvice?.suggestedBudget ?? {}
    expect(suggestedBudget.fiberLimit).toBeGreaterThanOrEqual(ROWS + 1)
    expect(lossy.coverage.budgetAdvice?.next).toContain(JSON.stringify(suggestedBudget))

    await call('react_clear_renders', { budget: { ...suggestedBudget, adaptive: false } })
    const retried = await rerenderAndReadCauses()
    expect(retried.coverage).toMatchObject({ complete: true, skippedCommitFibers: 0 })
  })
})
