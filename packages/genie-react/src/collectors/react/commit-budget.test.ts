import { describe, expect, it } from 'vitest'
import { commitWorkExhaustions, consumeCommitWork, createCommitWorkBudget } from './commit-budget'

describe('commit work budget', () => {
  it('shares one operation limit across subsystems and names the exhausted work', () => {
    const budget = createCommitWorkBudget({
      operationLimit: 2,
      timeLimitMs: 100,
      now: () => 0,
    })

    expect(consumeCommitWork(budget, 'props')).toBe(true)
    expect(consumeCommitWork(budget, 'effects')).toBe(true)
    expect(consumeCommitWork(budget, 'context')).toBe(false)
    expect(commitWorkExhaustions(budget)).toEqual(['context'])
  })

  it('stops new work after the shared deadline', () => {
    let now = 0
    const budget = createCommitWorkBudget({
      operationLimit: 100,
      timeLimitMs: 5,
      now: () => now,
    })
    now = 5

    expect(consumeCommitWork(budget, 'identity')).toBe(false)
    expect(commitWorkExhaustions(budget)).toEqual(['identity'])
  })

  it('reads the clock once per batch of operations and stays exhausted after the deadline', () => {
    let now = 0
    let clockReads = 0
    const budget = createCommitWorkBudget({
      operationLimit: 1_000,
      timeLimitMs: 5,
      now: () => {
        clockReads += 1
        return now
      },
    })
    clockReads = 0

    for (let operation = 0; operation < 32; operation += 1) consumeCommitWork(budget, 'scan')
    expect(clockReads).toBe(2)

    now = 5
    let allowedAfterDeadline = 0
    while (consumeCommitWork(budget, 'scan')) allowedAfterDeadline += 1
    expect(allowedAfterDeadline).toBeLessThan(16)
    expect(consumeCommitWork(budget, 'late')).toBe(false)
    expect(commitWorkExhaustions(budget)).toEqual(['late', 'scan'])
  })
})
