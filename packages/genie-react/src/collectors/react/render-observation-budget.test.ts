import type { Fiber } from 'bippy'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactClearRendersContract } from './render-contract'
import {
  clearRenders,
  createCommitAnalysisBudget,
  finalizeCommitAnalysisBudget,
  getRenderObservationConfig,
  getRenderTrackingCoverage,
  recordCommitFiber,
  recordRender,
} from './render-tracker'

vi.mock('bippy/source', () => ({
  getSource: async () => null,
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
}))

const asFiber = (shape: unknown): Fiber => shape as Fiber

function componentFiber(opts: {
  name: string
  props?: Record<string, unknown> | null
  prevProps?: Record<string, unknown> | null
}): Fiber {
  const type = (): null => null
  Object.assign(type, { displayName: opts.name })
  return asFiber({
    tag: 0,
    type,
    memoizedProps: opts.props ?? null,
    memoizedState: null,
    actualDuration: 0,
    selfBaseDuration: 0,
    child: null,
    alternate:
      opts.prevProps === undefined ? null : { memoizedProps: opts.prevProps, memoizedState: null },
  })
}

function exhaustOneCommit(): void {
  const budget = createCommitAnalysisBudget(250, {
    operationLimit: 1,
    timeLimitMs: 100,
    now: () => 0,
  })
  recordCommitFiber(
    componentFiber({ name: 'Exhausting', props: { value: 2 }, prevProps: { value: 1 } }),
    'update',
    budget,
  )
  finalizeCommitAnalysisBudget(budget)
}

beforeAll(() => {
  recordRender(componentFiber({ name: '__warmup__', props: {} }), 'mount')
})

beforeEach(() => clearRenders())

describe('render observation budget regressions', () => {
  it('carries a valid contract budget above the legacy caps into the effective configuration', () => {
    const parsed = reactClearRendersContract.input.parse({
      budget: { fiberLimit: 12_000, operationLimit: 900_000, timeLimitMs: 200 },
    })

    clearRenders({ budget: parsed.budget })

    expect(getRenderObservationConfig()).toMatchObject({
      fiberLimit: 12_000,
      operationLimit: 900_000,
      timeLimitMs: 200,
    })
  })

  it('never lowers an internal budget above the adaptive ceilings', () => {
    clearRenders({
      budget: {
        fiberLimit: 20_001,
        operationLimit: 2_000_001,
        timeLimitMs: 500.5,
      },
    })
    exhaustOneCommit()

    expect(getRenderObservationConfig()).toMatchObject({
      adaptiveScale: 2,
      fiberLimit: 20_001,
      operationLimit: 2_000_001,
      timeLimitMs: 500.5,
    })
  })

  it('grows only future commit budgets after an exhausted commit', () => {
    clearRenders({ budget: { fiberLimit: 250, operationLimit: 20_000, timeLimitMs: 8 } })
    exhaustOneCommit()

    expect(getRenderObservationConfig()).toMatchObject({
      adaptiveScale: 2,
      fiberLimit: 500,
      operationLimit: 40_000,
      timeLimitMs: 16,
    })
    expect(getRenderTrackingCoverage('measurement')).toMatchObject({
      complete: false,
      budgetExhaustedCommits: 1,
    })
  })

  it('resets adaptive growth for a fresh observation window', () => {
    clearRenders({ budget: { fiberLimit: 250, operationLimit: 20_000, timeLimitMs: 8 } })
    exhaustOneCommit()
    expect(getRenderObservationConfig()).toMatchObject({ adaptiveScale: 2 })

    clearRenders()

    expect(getRenderObservationConfig()).toMatchObject({
      adaptiveScale: 1,
      fiberLimit: 250,
      operationLimit: 20_000,
      timeLimitMs: 8,
    })
  })
})
