import { describe, expect, it } from 'vitest'
import {
  buildRenderTrackingCoverage,
  renderEvidenceComparability,
  renderSummarySemantics,
} from './render-snapshots'

const counters = {
  skippedCommitFibers: 0,
  droppedUnmountFibers: 0,
  analysisFailedFibers: 0,
  pausedCommits: 0,
  unobservedCommits: 0,
  truncatedInputFibers: 0,
  propsNotEnumeratedFibers: 0,
  budgetExhaustedCommits: 0,
  budgetExhaustedSubsystems: [],
}

describe('render evidence semantics', () => {
  it('marks complete causal coverage exact and comparable', () => {
    const coverage = buildRenderTrackingCoverage(counters, 'causal')

    expect(coverage).toMatchObject({
      complete: true,
      semantics: 'exact',
      coverageDomain: 'render-causality',
    })
    expect(renderSummarySemantics(coverage, 0)).toBe('exact')
    expect(renderEvidenceComparability(coverage, 'current')).toEqual({
      comparable: true,
      notComparableReasons: [],
    })
  })

  it('makes an incomplete zero unknown rather than a zero-render pass', () => {
    const coverage = buildRenderTrackingCoverage({ ...counters, skippedCommitFibers: 2 }, 'causal')

    expect(coverage.semantics).toBe('lower-bound')
    expect(renderSummarySemantics(coverage, 0)).toBe('unknown')
    expect(renderEvidenceComparability(coverage, 'current')).toEqual({
      comparable: false,
      notComparableReasons: ['skipped-commit-fibers'],
    })
  })

  it('keeps commits after a profile stop out of an exact count', () => {
    const coverage = buildRenderTrackingCoverage({ ...counters, pausedCommits: 1 }, 'measurement')

    expect(coverage).toMatchObject({ complete: false, semantics: 'lower-bound' })
    expect(renderSummarySemantics(coverage, 0)).toBe('unknown')
    expect(renderEvidenceComparability(coverage, 'current').notComparableReasons).toEqual([
      'commits-after-profile-stop',
    ])
  })

  it('turns commits no window observed into an unknown result that says how to capture them', () => {
    const coverage = buildRenderTrackingCoverage({ ...counters, unobservedCommits: 3 }, 'causal')

    expect(coverage).toMatchObject({
      complete: false,
      inputAttributionComplete: false,
      semantics: 'lower-bound',
    })
    expect(renderSummarySemantics(coverage, 0)).toBe('unknown')
    expect(coverage.incompleteBecause).toEqual([
      expect.objectContaining({
        reason: 'commits-not-observed',
        detail: expect.stringContaining('3 commits'),
        next: expect.stringContaining('react_clear_renders'),
      }),
    ])
    expect(renderEvidenceComparability(coverage, 'current').notComparableReasons).toEqual([
      'commits-not-observed',
    ])
  })

  it('discloses stale attribution separately from coverage gaps', () => {
    const coverage = buildRenderTrackingCoverage(counters, 'measurement')

    expect(renderEvidenceComparability(coverage, 'stale')).toEqual({
      comparable: false,
      notComparableReasons: ['report-attribution-stale'],
    })
  })
})
