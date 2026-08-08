import { describe, expect, it } from 'vitest'
import { consumeCommitWork } from './commit-budget'
import { createCommitAnalysisBudget } from './render-commit-budget'

describe('commit analysis budget', () => {
  it('places the target deadline a full reserve past the general deadline', () => {
    const budget = createCommitAnalysisBudget(
      250,
      { timeLimitMs: 10, now: () => 0 },
      { timeLimitMs: 5, now: () => 0 },
    )

    expect(budget.work.deadlineAt).toBe(10)
    expect(budget.targetWork.deadlineAt).toBe(15)
  })

  it('anchors the target deadline to the general deadline when construction advances the clock', () => {
    let clock = 0
    const now = () => {
      const current = clock
      clock += 100
      return current
    }
    const budget = createCommitAnalysisBudget(250, { timeLimitMs: 10, now }, { timeLimitMs: 5 })

    expect(budget.work.deadlineAt).toBe(10)
    expect(budget.targetWork.deadlineAt).toBe(15)
    expect(budget.targetWork.now).toBe(budget.work.now)
  })

  it('applies the default reserve on top of the default general limit', () => {
    const budget = createCommitAnalysisBudget(250, { now: () => 0 }, { now: () => 0 })

    expect(budget.work.deadlineAt).toBe(8)
    expect(budget.targetWork.deadlineAt).toBe(12)
  })

  it('applies an explicit reserve on top of the default general limit', () => {
    const budget = createCommitAnalysisBudget(
      250,
      { now: () => 0 },
      { timeLimitMs: 25, now: () => 0 },
    )

    expect(budget.targetWork.deadlineAt).toBe(33)
  })

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])('falls back to the default target reserve for non-finite internal duration %s', (timeLimitMs) => {
    const budget = createCommitAnalysisBudget(250, { now: () => 0 }, { timeLimitMs })

    expect(budget.work.deadlineAt).toBe(8)
    expect(budget.targetWork.deadlineAt).toBe(12)
  })

  it.each([
    { timeLimitMs: 0, expectedDeadline: 8.1 },
    { timeLimitMs: -5, expectedDeadline: 8.1 },
  ])('clamps finite target reserve $timeLimitMs to a positive duration', ({
    timeLimitMs,
    expectedDeadline,
  }) => {
    const budget = createCommitAnalysisBudget(250, { now: () => 0 }, { timeLimitMs })

    expect(budget.targetWork.deadlineAt).toBeCloseTo(expectedDeadline)
  })

  it.each([
    { timeLimitMs: Number.NaN, expectedGeneralDeadline: 8 },
    { timeLimitMs: Number.POSITIVE_INFINITY, expectedGeneralDeadline: 8 },
    { timeLimitMs: Number.NEGATIVE_INFINITY, expectedGeneralDeadline: 8 },
    { timeLimitMs: 0, expectedGeneralDeadline: 0.1 },
    { timeLimitMs: -5, expectedGeneralDeadline: 0.1 },
  ])('adds the reserve after normalized general duration $timeLimitMs', ({
    timeLimitMs,
    expectedGeneralDeadline,
  }) => {
    const budget = createCommitAnalysisBudget(250, { timeLimitMs, now: () => 0 })

    expect(budget.work.deadlineAt).toBeCloseTo(expectedGeneralDeadline)
    expect(budget.targetWork.deadlineAt).toBeCloseTo(expectedGeneralDeadline + 4)
  })

  it('uses a target-only injected clock as the shared clock', () => {
    const now = () => 5
    const budget = createCommitAnalysisBudget(250, { timeLimitMs: 8 }, { timeLimitMs: 4, now })

    expect(budget.work.deadlineAt).toBe(13)
    expect(budget.targetWork.deadlineAt).toBe(17)
    expect(budget.work.now).toBe(now)
    expect(budget.targetWork.now).toBe(now)
  })

  it('leaves the reserve spendable once the general deadline has passed', () => {
    let clock = 0
    const budget = createCommitAnalysisBudget(
      250,
      { timeLimitMs: 10, now: () => clock },
      { timeLimitMs: 5, now: () => clock },
    )
    clock = 12

    expect(consumeCommitWork(budget.work, 'commit-fibers')).toBe(false)
    expect(consumeCommitWork(budget.targetWork, 'target-fibers')).toBe(true)
  })

  it('exhausts the reserve once the general limit plus the reserve has passed', () => {
    let clock = 0
    const budget = createCommitAnalysisBudget(
      250,
      { timeLimitMs: 10, now: () => clock },
      { timeLimitMs: 5, now: () => clock },
    )
    clock = 15

    expect(consumeCommitWork(budget.targetWork, 'target-fibers')).toBe(false)
  })

  it('keeps the target operation reserve independent of the general operation limit', () => {
    const budget = createCommitAnalysisBudget(
      250,
      { operationLimit: 1, timeLimitMs: 1_000, now: () => 0 },
      { operationLimit: 3, timeLimitMs: 1_000, now: () => 0 },
    )

    expect(consumeCommitWork(budget.work, 'commit-fibers')).toBe(true)
    expect(consumeCommitWork(budget.work, 'commit-fibers')).toBe(false)
    expect(consumeCommitWork(budget.targetWork, 'target-fibers')).toBe(true)
    expect(consumeCommitWork(budget.targetWork, 'target-fibers')).toBe(true)
    expect(consumeCommitWork(budget.targetWork, 'target-fibers')).toBe(true)
    expect(consumeCommitWork(budget.targetWork, 'target-fibers')).toBe(false)
  })
})
