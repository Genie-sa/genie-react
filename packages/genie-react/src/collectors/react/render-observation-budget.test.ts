import type { Fiber } from 'bippy'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { consumeCommitWork } from './commit-budget'
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
      adaptiveScale: 1,
      fiberLimit: 20_001,
      operationLimit: 2_000_001,
      timeLimitMs: 500.5,
    })
  })

  it('grows only the work limits of future commits after an exhausted commit', () => {
    clearRenders({ budget: { fiberLimit: 250, operationLimit: 20_000, timeLimitMs: 8 } })
    exhaustOneCommit()

    // The operation limit ran out, not the fiber limit, so only work grows.
    expect(getRenderObservationConfig()).toMatchObject({
      adaptiveScale: 1,
      fiberLimit: 250,
      operationLimit: 40_000,
      timeLimitMs: 16,
    })
    expect(getRenderTrackingCoverage('measurement')).toMatchObject({
      complete: false,
      budgetExhaustedCommits: 1,
    })
  })

  it('names the operation limit that ran out and suggests doubling it', () => {
    clearRenders({ budget: { fiberLimit: 250, operationLimit: 20_000, timeLimitMs: 8 } })
    exhaustOneCommit()

    expect(getRenderTrackingCoverage('measurement').budgetAdvice).toMatchObject({
      exhaustedLimits: ['operationLimit'],
      suggestedBudget: { fiberLimit: 250, operationLimit: 40_000, timeLimitMs: 16 },
    })
  })

  it('suggests at least double the exhausted limit when the commit skipped no fiber', () => {
    clearRenders({ budget: { fiberLimit: 250, operationLimit: 20_000, timeLimitMs: 8 } })
    const budget = createCommitAnalysisBudget(250, { operationLimit: 1, now: () => 0 })
    consumeCommitWork(budget.work, 'pending-unmounts', 2)
    finalizeCommitAnalysisBudget(budget)

    expect(getRenderTrackingCoverage('measurement').budgetAdvice).toMatchObject({
      exhaustedLimits: ['operationLimit'],
      suggestedBudget: { operationLimit: 40_000 },
    })
  })

  it('names the target reserve when a targeted component ran out of work', () => {
    clearRenders({ components: ['Exhausting'], budget: { targetOperationReserve: 4_000 } })
    const budget = createCommitAnalysisBudget(250, { now: () => 0 }, { operationLimit: 1 })
    recordCommitFiber(
      componentFiber({ name: 'Exhausting', props: { value: 2 }, prevProps: { value: 1 } }),
      'update',
      budget,
    )
    finalizeCommitAnalysisBudget(budget)

    expect(getRenderTrackingCoverage('measurement').budgetAdvice).toMatchObject({
      exhaustedLimits: ['targetOperationReserve'],
      suggestedBudget: { targetOperationReserve: 8_000 },
    })
  })

  it('resets adaptive growth for a fresh observation window', () => {
    clearRenders({ budget: { fiberLimit: 250, operationLimit: 20_000, timeLimitMs: 8 } })
    exhaustOneCommit()
    expect(getRenderObservationConfig()).toMatchObject({ operationLimit: 40_000 })

    clearRenders()

    expect(getRenderObservationConfig()).toMatchObject({
      adaptiveScale: 1,
      fiberLimit: 250,
      operationLimit: 20_000,
      timeLimitMs: 8,
    })
  })
})

describe('the time budget on Hermes, which runs the analysis without a JIT', () => {
  beforeEach(() => {
    vi.stubGlobal('HermesInternal', {})
    clearRenders()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('gives an adaptive window eight times the time limits the defaults set for V8', () => {
    expect(getRenderObservationConfig()).toMatchObject({
      operationLimit: 20_000,
      timeLimitMs: 64,
      targetTimeReserveMs: 32,
    })
  })

  it('keeps the time limits a window that is not adaptive was given', () => {
    clearRenders({ budget: { adaptive: false } })

    expect(getRenderObservationConfig()).toMatchObject({ timeLimitMs: 8, targetTimeReserveMs: 4 })
  })

  it('advises a time limit that the factor scales to double the one that ran out', () => {
    let clock = 0
    const budget = createCommitAnalysisBudget(250, { timeLimitMs: 64, now: () => clock })
    clock = 100
    consumeCommitWork(budget.work, 'commit-fibers')
    finalizeCommitAnalysisBudget(budget)

    expect(getRenderTrackingCoverage('measurement').budgetAdvice).toMatchObject({
      exhaustedLimits: ['timeLimitMs'],
      suggestedBudget: { timeLimitMs: 16 },
    })
    expect(getRenderObservationConfig()).toMatchObject({ timeLimitMs: 128 })
  })
})
