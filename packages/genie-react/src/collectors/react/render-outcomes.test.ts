import type { Fiber } from 'bippy'
import { describe, expect, it } from 'vitest'
import { applyOutputAssessment, assessRender, inputComparisonComplete } from './render-outcomes'

const asFiber = (value: Record<string, unknown>): Fiber =>
  ({
    tag: 0,
    flags: 0,
    subtreeFlags: 0,
    memoizedState: null,
    dependencies: null,
    alternate: null,
    child: null,
    sibling: null,
    return: null,
    ...value,
  }) as unknown as Fiber

describe('render outcome evidence', () => {
  it('treats mismatched context identity as incomplete input evidence', () => {
    const currentContext = { displayName: 'Current' }
    const previousContext = { displayName: 'Previous' }
    const fiber = asFiber({
      dependencies: { firstContext: { context: currentContext, next: null } },
      alternate: asFiber({
        dependencies: { firstContext: { context: previousContext, next: null } },
      }),
    })
    expect(inputComparisonComplete(fiber)).toBe(false)
    expect(assessRender(fiber, 'update', [], 0).inputEvidence).toBe('incomplete')
  })

  it('never says an update is safe to remove when no input or host mutation was observed', () => {
    const fiber = asFiber({ alternate: asFiber({}) })
    const assessment = assessRender(fiber, 'update', [], 0)
    expect(assessment.inputEvidence).toBe('none-observed')
    expect(assessment.optimizationSafety).toBe('not-proven-safe')
    expect(assessment.requiredValidation).toContain('focus')
    expect(assessment.behaviorEvidence.unobservedDomains).toContain('transition')
  })

  it('retains exact scheduled-effect evidence without claiming execution', () => {
    const fiber = asFiber({ alternate: asFiber({}) })
    const assessment = assessRender(fiber, 'update', [], 2)
    expect(assessment.behaviorEvidence.scheduledEffects).toEqual({
      status: 'observed',
      count: 2,
    })
    expect(assessment.behaviorEvidence.unobservedDomains).toContain('effect-execution')
  })

  it('reports host writes only after the commit was attributed, never as a guess', () => {
    const assessment = assessRender(asFiber({ alternate: asFiber({}) }), 'update', [], 0)
    expect(assessment.behaviorEvidence.subtreeHostMutations.status).toBe('incomplete')

    applyOutputAssessment(assessment, {
      writes: 0,
      callbackOnlyUpdates: 1,
      effects: 0,
      complete: true,
      writeLabels: [],
      callbackLabels: ['button.onClick'],
    })
    expect(assessment.behaviorEvidence).toMatchObject({
      subtreeHostMutations: { status: 'none-observed', count: 0, callbackOnlyUpdates: 1 },
      subtreeScheduledEffects: { status: 'none-observed', count: 0 },
    })
  })
})
