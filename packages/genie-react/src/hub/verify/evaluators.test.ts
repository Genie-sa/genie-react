import { describe, expect, it } from 'vitest'
import type { VerifyClaimInput } from '../../protocol'
import {
  claim,
  effectRun,
  effects,
  events,
  guardInputs,
  instance,
  mixedPageGuards,
  renderEvent,
  rendered,
  SETTLED,
  START,
  suspenseHide,
  targetEvidence,
  windowEvidence,
} from '../../test-support/verify-evidence'
import type { RenderCause, TargetEvidence, VerificationEvidence } from './evidence'
import { evaluateGuards } from './guards'
import { combine, decide, evaluateClaim } from './verdict'

const badgeMax0: VerifyClaimInput = {
  kind: 'renders',
  target: { component: 'StatusBadge' },
  max: 0,
}
const badgeMin1: VerifyClaimInput = {
  kind: 'renders',
  target: { component: 'StatusBadge' },
  min: 1,
}

function outcome(input: VerifyClaimInput, evidence: VerificationEvidence) {
  return evaluateClaim(claim(input), evidence)
}

const verdictOf = (input: VerifyClaimInput, evidence: VerificationEvidence) =>
  outcome(input, evidence).verdict
const reasonOf = (input: VerifyClaimInput, evidence: VerificationEvidence) =>
  outcome(input, evidence).refusal?.reason

function withCoverage(changes: Partial<NonNullable<VerificationEvidence['coverage']>>) {
  const base = windowEvidence()
  return { ...base, coverage: base.coverage ? { ...base.coverage, ...changes } : null }
}

function withSettle(outcomeName: 'timed-out' | 'failed') {
  const base = windowEvidence([
    targetEvidence({ records: [rendered({ latestDocumentCommitId: 59 })] }),
  ])
  return {
    ...base,
    window: { ...base.window, settle: { ...base.window.settle, outcome: outcomeName } },
  }
}

describe('renders decision table', () => {
  it('passes max N on an exact count within N with an active instance', () => {
    expect(verdictOf(badgeMax0, windowEvidence())).toBe('pass')
  })

  it('fails max N whenever the count exceeds N, even on a lower bound', () => {
    const lowerBound = withCoverage({
      complete: false,
      semantics: 'lower-bound',
      skippedCommitFibers: 9,
    })
    lowerBound.targets = windowEvidence([
      targetEvidence({ records: [rendered({ renders: 3 })] }),
    ]).targets

    expect(verdictOf({ ...badgeMax0, max: 1 }, lowerBound)).toBe('fail')
  })

  it('passes min N on a lower-bound count that reaches N', () => {
    const lowerBound = withCoverage({
      complete: false,
      semantics: 'lower-bound',
      skippedCommitFibers: 9,
    })
    lowerBound.targets = windowEvidence([
      targetEvidence({ records: [rendered({ renders: 2 })] }),
    ]).targets

    expect(outcome(badgeMin1, lowerBound)).toMatchObject({
      verdict: 'pass',
      caveats: ['count-is-a-lower-bound'],
    })
  })

  it('fails min N only on an exact count below N', () => {
    expect(verdictOf(badgeMin1, windowEvidence())).toBe('fail')
    expect(
      reasonOf(
        badgeMin1,
        withCoverage({ complete: false, semantics: 'lower-bound', skippedCommitFibers: 2 }),
      ),
    ).toBe('coverage_incomplete')
  })

  it('refuses a count while commits after a Fast Refresh went unanalysed, and names them', () => {
    const refreshTail = withCoverage({
      complete: false,
      semantics: 'lower-bound',
      refreshCommitsExcluded: 2,
    })

    expect(outcome(badgeMax0, refreshTail)).toMatchObject({
      verdict: 'refused',
      refusal: {
        reason: 'coverage_incomplete',
        message: expect.stringContaining('refreshCommitsExcluded 2'),
      },
    })
  })

  it('does not advise beginning again when the window itself unmounted more than Genie keeps', () => {
    const unmountedBoard = withCoverage({
      complete: false,
      semantics: 'lower-bound',
      droppedUnmountFibers: 3057,
    })

    expect(outcome(badgeMax0, unmountedBoard).refusal).toMatchObject({
      reason: 'coverage_incomplete',
      message: expect.stringContaining('fewer components'),
      fix: { action: 'change-claim' },
    })
  })

  it('counts updates only with counting updates, but fails on a key-change remount', () => {
    const remount = windowEvidence([
      targetEvidence({
        begin: [instance({ mountId: 'mount:1' })],
        end: [instance({ mountId: 'mount:2' })],
        records: [rendered({ mountId: 'mount:2', renders: 1, mounts: 1, updates: 0 })],
      }),
    ])
    const updates: VerifyClaimInput = { ...badgeMax0, counting: 'updates' }

    expect(outcome(updates, remount)).toMatchObject({ verdict: 'fail', observed: { remounts: 1 } })
    expect(verdictOf({ ...updates, allowRemount: true }, remount)).toBe('pass')
  })

  it('refuses counting updates when a mount generation is unknown', () => {
    const unknown = windowEvidence([
      targetEvidence({
        begin: [],
        end: [instance()],
        records: [
          rendered({ renders: 1, mounts: 1, updates: 0, mountGenerationEvidence: 'unknown' }),
        ],
      }),
    ])

    expect(reasonOf({ ...badgeMax0, max: 1, counting: 'updates' }, unknown)).toBe(
      'evidence_inferred',
    )
  })

  it.each([
    [
      'budget_exhausted',
      withCoverage({
        complete: false,
        semantics: 'lower-bound',
        budgetExhaustedCommits: 1,
        budgetAdvice: { exhaustedLimits: ['fiberLimit'], suggestedBudget: { fiberLimit: 1200 } },
      }),
    ],
    [
      'coverage_incomplete',
      withCoverage({ complete: false, semantics: 'lower-bound', droppedUnmountFibers: 1 }),
    ],
    ['coverage_incomplete', withCoverage({ targeted: { complete: false, skippedFibers: 4 } })],
    ['evidence_unavailable', { ...windowEvidence(), coverage: null }],
    ['evidence_truncated', windowEvidence([targetEvidence({ omittedByLimit: 3 })])],
    ['coverage_incomplete', windowEvidence([targetEvidence({ attributionStale: true })])],
    ['target_not_found', windowEvidence([targetEvidence({ begin: [], end: [] })])],
    [
      'target_inactive',
      windowEvidence([targetEvidence({ begin: [instance({ renderingState: 'mounted-hidden' })] })]),
    ],
    ['target_ambiguous', windowEvidence([targetEvidence({ status: 'ambiguous' })])],
    [
      'not_quiescent',
      windowEvidence([
        targetEvidence({ records: [rendered({ latestDocumentCommitId: SETTLED + 1 })] }),
      ]),
    ],
    ['not_quiescent', withSettle('timed-out')],
  ] as const)('refuses max N with %s', (reason, evidence) => {
    expect(reasonOf({ ...badgeMax0, max: 5 }, evidence)).toBe(reason)
  })

  it('counts an instance mounted at both begin and end as one active instance', () => {
    expect(outcome(badgeMax0, windowEvidence())).toMatchObject({
      observed: { instances: 1, activeInstances: 1 },
    })

    const replaced = windowEvidence([
      targetEvidence({ begin: [instance()], end: [instance({ mountId: 'mount:13' })] }),
    ])
    expect(outcome(badgeMax0, replaced)).toMatchObject({
      observed: { instances: 2, activeInstances: 2 },
    })
  })

  it('sees an instance whose source ownership is unknown, since reads use appOnly false', () => {
    const unknownOwnership = windowEvidence([
      targetEvidence({ records: [rendered({ sourceFile: null, sourceLocation: null })] }),
    ])

    expect(verdictOf(badgeMax0, unknownOwnership)).toBe('fail')
  })

  it('refuses a source-narrowed target when a same-named instance has no resolved source', () => {
    const narrowed = windowEvidence([
      targetEvidence({
        target: { component: 'StatusBadge', source: 'src/screens/search/StatusBadge.tsx' },
        records: [rendered({ mountId: 'mount:99', sourceFile: null })],
      }),
    ])

    expect(
      reasonOf(
        {
          ...badgeMax0,
          target: { component: 'StatusBadge', source: 'src/screens/search/StatusBadge.tsx' },
        },
        narrowed,
      ),
    ).toBe('target_ambiguous')
  })

  describe('when a cohort read left instances of the name out past its limit', () => {
    const truncated = (records = [rendered({ renders: 0 })]) =>
      windowEvidence([targetEvidence({ records, cohortOmittedByLimit: 640 })])

    it('refuses max N instead of passing on the instances it listed, and counts the rest', () => {
      expect(outcome(badgeMax0, truncated())).toMatchObject({
        verdict: 'refused',
        observed: { semantics: 'lower-bound', instances: 1, omittedInstances: 640 },
        refusal: { reason: 'evidence_truncated', evidence: { omittedInstances: 640 } },
      })
    })

    it('still fails max N on renders past N', () => {
      expect(verdictOf(badgeMax0, truncated([rendered({ renders: 3 })]))).toBe('fail')
    })

    it('passes min N only as a lower bound', () => {
      expect(outcome(badgeMin1, truncated([rendered({ renders: 2 })]))).toMatchObject({
        verdict: 'pass',
        observed: { semantics: 'lower-bound', omittedInstances: 640 },
        caveats: ['count-is-a-lower-bound'],
      })
    })

    it('refuses min N with the truncation, not a fail', () => {
      expect(reasonOf(badgeMin1, truncated())).toBe('evidence_truncated')
    })
  })

  it('refuses when instances of the name come from two source files during the window', () => {
    const twoFiles = windowEvidence([
      targetEvidence({
        records: [
          rendered({ mountId: 'mount:7', renders: 0, sourceFile: 'src/other/StatusBadge.tsx' }),
        ],
      }),
    ])

    expect(reasonOf(badgeMax0, twoFiles)).toBe('target_ambiguous')
  })
})

describe('render-causes decision table', () => {
  const onlyState: VerifyClaimInput = {
    kind: 'render-causes',
    target: { component: 'StatusBadge' },
    allow: [{ kind: 'state', name: 'state[0]' }],
  }
  const withEvents = (list = [renderEvent()], read = {}) =>
    windowEvidence([
      targetEvidence({ records: [rendered({ renders: list.length })], events: events(list, read) }),
    ])

  it('passes when every exact cause is allowed and every render has its event', () => {
    expect(verdictOf(onlyState, withEvents())).toBe('pass')
  })

  it('fails on any exact cause outside the allowed set, even beside an allowed one', () => {
    const mixed = renderEvent({
      causes: [
        { kind: 'state', evidence: 'exact', name: 'state[0]', reason: null },
        { kind: 'props', evidence: 'exact', name: 'appearance', reason: null },
      ],
    })

    expect(verdictOf(onlyState, withEvents([mixed]))).toBe('fail')
  })

  it.each([
    [
      'evidence_inferred',
      withEvents([
        renderEvent({
          causes: [
            {
              kind: 'parent',
              evidence: 'inferred',
              name: null,
              reason: 'nearest-rendered-ancestor',
            },
          ],
        }),
      ]),
    ],
    [
      'evidence_inferred',
      withEvents([
        renderEvent({
          causes: [
            { kind: 'query', evidence: 'exact', name: '["tasks"]', reason: 'query-result-shape' },
          ],
        }),
      ]),
    ],
    ['coverage_incomplete', withEvents([renderEvent({ inputCoverageComplete: false })])],
    ['evidence_truncated', withEvents([renderEvent()], { droppedRenderEvents: 2 })],
    ['evidence_truncated', withEvents([renderEvent()], { omittedByLimit: 1 })],
    [
      'evidence_truncated',
      windowEvidence([
        targetEvidence({ records: [rendered({ renders: 2 })], events: events([renderEvent()]) }),
      ]),
    ],
    [
      'evidence_unavailable',
      windowEvidence([targetEvidence({ records: [rendered()], events: null })]),
    ],
  ] as const)('refuses with %s', (reason, evidence) => {
    expect(reasonOf(onlyState, evidence)).toBe(reason)
  })

  describe('on a class inside a connect() wrapper, which re-renders whenever the wrapper does', () => {
    const onlyIssue: VerifyClaimInput = {
      ...onlyState,
      allow: [{ kind: 'props', name: 'issue' }],
    }
    const wrapped = (wrapperCause: RenderCause, parentId = 41) =>
      withEvents([
        renderEvent({
          causes: [
            {
              kind: 'parent',
              evidence: 'inferred',
              name: null,
              reason: 'nearest-rendered-ancestor',
              parentId,
            },
            { kind: 'props', evidence: 'exact', name: 'issue', reason: null },
          ],
          wrappedBy: {
            componentId: 41,
            componentName: 'Connect(StatusBadge)',
            causes: [wrapperCause],
          },
        }),
      ])
    const issueChanged: RenderCause = {
      kind: 'props',
      evidence: 'exact',
      name: 'issue',
      reason: null,
    }

    it('passes when the parent is the wrapper and it rendered for an exact allowed cause', () => {
      expect(outcome(onlyIssue, wrapped(issueChanged))).toMatchObject({
        verdict: 'pass',
        deciding: [
          {
            wrappedBy: { component: 'Connect(StatusBadge)', causes: ['props.issue'] },
          },
        ],
      })
    })

    it.each([
      [
        'the wrapper rendered for an inferred store cause',
        wrapped({ kind: 'external-store', evidence: 'inferred', name: null, reason: null }),
      ],
      [
        'the wrapper rendered for a cause the claim does not allow',
        wrapped({ ...issueChanged, name: 'theme' }),
      ],
      ['the rendered parent is not the wrapper', wrapped(issueChanged, 7)],
    ])('still refuses when %s', (_, evidence) => {
      expect(reasonOf(onlyIssue, evidence)).toBe('evidence_inferred')
    })
  })

  it('labels observed causes the way a claim names them', () => {
    const allowAll: VerifyClaimInput = {
      ...onlyState,
      allow: [
        { kind: 'state' },
        { kind: 'props' },
        { kind: 'context' },
        { kind: 'external-store' },
      ],
    }
    const result = outcome(
      allowAll,
      withEvents([
        renderEvent({
          causes: [
            { kind: 'state', evidence: 'exact', name: 'state[0]', reason: null },
            { kind: 'state', evidence: 'exact', name: 'this.state.count', reason: null },
            { kind: 'props', evidence: 'exact', name: 'appearance', reason: null },
            { kind: 'context', evidence: 'exact', name: 'Theme', reason: null },
            { kind: 'external-store', evidence: 'inferred', name: null, reason: null },
          ],
        }),
      ]),
    )

    expect(result.observed).toMatchObject({
      causes: [
        'context.Theme',
        'external-store',
        'props.appearance',
        'state[0]',
        'this.state.count',
      ],
    })
  })

  it('treats a Query cause as exact only when it joins a delivered notification', () => {
    const allowQuery: VerifyClaimInput = { ...onlyState, allow: [{ kind: 'query' }] }
    const delivered = renderEvent({
      causes: [
        {
          kind: 'query',
          evidence: 'exact',
          name: '["tasks"]',
          reason: 'query-notification-delivered',
        },
      ],
    })

    expect(verdictOf(allowQuery, withEvents([delivered]))).toBe('pass')
  })
})

describe('effect-runs decision table', () => {
  const runsMax1: VerifyClaimInput = {
    kind: 'effect-runs',
    target: { component: 'StatusBadge' },
    max: 1,
  }
  const withRuns = (list = [effectRun()], read = {}) =>
    windowEvidence([targetEvidence({ records: [rendered()], effects: effects(list, read) })])

  it('passes on observed executions within N', () => {
    expect(verdictOf(runsMax1, withRuns())).toBe('pass')
  })

  it('fails when observed executions exceed N', () => {
    expect(
      verdictOf(
        runsMax1,
        withRuns([effectRun(), effectRun({ effectEventId: 'effect:59:2', documentCommitId: 59 })]),
      ),
    ).toBe('fail')
  })

  it('is inconclusive when only StrictMode replays push the raw count past N', () => {
    expect(
      outcome(
        runsMax1,
        withRuns([effectRun({ execution: { status: 'observed', trigger: 'strict-mode-replay' } })]),
      ),
    ).toMatchObject({
      verdict: 'inconclusive',
      inconclusive: { reason: 'strict_mode_replay' },
    })
  })

  it('does not count a scheduled run that was never observed as an execution', () => {
    const scheduledOnly = withRuns([
      effectRun({ execution: { status: 'unobserved', reason: 'unsupported-effect-kind' } }),
    ])

    expect(reasonOf({ ...runsMax1, max: 0 }, scheduledOnly)).toBe('evidence_unavailable')
  })

  it.each([
    [
      'evidence_unavailable',
      withRuns([
        effectRun({ execution: { status: 'unobserved', reason: 'instrumentation-unavailable' } }),
      ]),
    ],
    [
      'not_quiescent',
      withRuns([effectRun({ execution: { status: 'unobserved', reason: 'not-yet-observed' } })]),
    ],
    ['evidence_truncated', withRuns([effectRun()], { evictedEvents: 1 })],
    ['evidence_truncated', withRuns([effectRun()], { omittedByLimit: 1 })],
    ['target_not_found', withRuns([], { declaredEffectIndexes: [] })],
    [
      'coverage_incomplete',
      {
        ...withRuns(),
        coverage: {
          ...(withRuns().coverage ?? windowEvidence().coverage),
          truncatedEffectLists: 2,
        } as VerificationEvidence['coverage'],
      },
    ],
    [
      'evidence_unavailable',
      windowEvidence([targetEvidence({ records: [rendered()], effects: null })]),
    ],
  ] as const)('refuses with %s', (reason, evidence) => {
    expect(reasonOf(runsMax1, evidence)).toBe(reason)
  })

  it('refuses an effect position the component does not declare', () => {
    expect(
      reasonOf({ ...runsMax1, target: { component: 'StatusBadge', effectIndex: 3 } }, withRuns()),
    ).toBe('target_not_found')
  })
})

describe('effect-settles decision table', () => {
  const settles: VerifyClaimInput = { kind: 'effect-settles', target: { component: 'StatusBadge' } }
  const tail = (count: number) =>
    windowEvidence([
      targetEvidence({
        records: [rendered()],
        effects: effects(
          Array.from({ length: count }, (_, index) =>
            effectRun({ effectEventId: `effect:t${index}`, documentCommitId: SETTLED + 1 + index }),
          ),
        ),
      }),
    ])

  it('passes with no run after settle, and states its horizon', () => {
    expect(outcome(settles, tail(0))).toMatchObject({
      verdict: 'pass',
      caveats: ['horizon'],
      observed: { horizonMs: 500 },
    })
  })

  it('fails on two or more runs after the agent stopped driving', () => {
    expect(verdictOf(settles, tail(2))).toBe('fail')
  })

  it('refuses one run in the tail, which cannot tell a last run from a slow loop', () => {
    expect(reasonOf(settles, tail(1))).toBe('not_quiescent')
  })

  it('refuses when the app never settled and the effect was not looping', () => {
    const base = tail(0)
    expect(
      reasonOf(settles, {
        ...base,
        window: { ...base.window, settle: { ...base.window.settle, outcome: 'timed-out' } },
      }),
    ).toBe('not_quiescent')
  })
})

describe('boundaries-clean decision table', () => {
  const clean: VerifyClaimInput = { kind: 'boundaries-clean' }
  const atEnd: VerifyClaimInput = { kind: 'boundaries-clean', scope: 'end' }
  const catchEntry = {
    catchId: 'catch:58:1',
    documentCommitId: 58,
    boundaryName: 'Boundary',
    boundaryKind: 'error-boundary' as const,
    forced: false,
    message: 'save failed',
    throwingComponent: 'Form',
  }
  const boundaries = (changes: Partial<NonNullable<VerificationEvidence['boundaries']>>) => {
    const base = windowEvidence()
    return { ...base, boundaries: base.boundaries ? { ...base.boundaries, ...changes } : null }
  }

  it('passes with a complete catch log and nothing in an error state, with the uncaught-errors caveat', () => {
    expect(outcome(clean, windowEvidence())).toMatchObject({
      verdict: 'pass',
      caveats: ['uncaught-errors-outside-boundaries-unobserved'],
    })
  })

  it('fails on a catch in the window even after the boundary reset', () => {
    expect(verdictOf(clean, boundaries({ catches: [catchEntry] }))).toBe('fail')
    expect(verdictOf(atEnd, boundaries({ catches: [catchEntry] }))).toBe('pass')
  })

  it('fails on a boundary in its error state at the end', () => {
    const active = {
      boundaryName: 'Boundary',
      boundaryKind: 'error-boundary' as const,
      message: 'x',
      forced: false,
      status: 'active' as const,
    }
    expect(verdictOf(atEnd, boundaries({ atEnd: [active] }))).toBe('fail')
  })

  it('excludes forced boundaries from the count', () => {
    expect(verdictOf(clean, boundaries({ catches: [{ ...catchEntry, forced: true }] }))).toBe(
      'pass',
    )
  })

  it.each([
    ['capability_unavailable', boundaries({ catchLog: null })],
    [
      'evidence_truncated',
      boundaries({
        catchLog: { complete: false, incompleteReasons: ['catches-evicted'], omittedByLimit: 0 },
      }),
    ],
    [
      'coverage_incomplete',
      boundaries({
        catchLog: { complete: false, incompleteReasons: ['commit-not-scanned'], omittedByLimit: 0 },
      }),
    ],
    ['evidence_truncated', boundaries({ scanTruncated: true })],
    [
      'evidence_inferred',
      boundaries({
        atEnd: [
          {
            boundaryName: 'B',
            boundaryKind: 'error-boundary',
            message: null,
            forced: false,
            status: 'unknown',
          },
        ],
      }),
    ],
    ['evidence_unavailable', { ...windowEvidence(), boundaries: null }],
  ] as const)('refuses with %s', (reason, evidence) => {
    expect(reasonOf(clean, evidence)).toBe(reason)
  })
})

describe('suspense-hidden decision table', () => {
  const neverHidden: VerifyClaimInput = {
    kind: 'suspense-hidden',
    target: { component: 'StatusBadge' },
    max: 0,
  }
  const withHides = (
    changes: Partial<NonNullable<VerificationEvidence['boundaries']>>,
    targets?: TargetEvidence[],
  ) => {
    const base = windowEvidence(targets)
    return { ...base, boundaries: base.boundaries ? { ...base.boundaries, ...changes } : null }
  }

  it('passes on a complete hide log in which no fallback covered the target', () => {
    const elsewhere = suspenseHide({ hiddenTargets: [] })

    expect(outcome(neverHidden, withHides({ hides: [elsewhere] }))).toMatchObject({
      verdict: 'pass',
      observed: { hidden: 0, hidesInWindow: 1 },
      deciding: [{ kind: 'suspense-hide-log', complete: true, afterDocumentCommitId: START }],
    })
  })

  it('fails when a fallback covered the target, though the target never rendered', () => {
    expect(outcome(neverHidden, withHides({ hides: [suspenseHide()] }))).toMatchObject({
      verdict: 'fail',
      observed: { hidden: 1 },
      deciding: [{ kind: 'suspense-hide', hideId: 'hide:58:1', boundary: 'Suspense' }],
    })
  })

  it('counts commits that hid the target against max N, and fails on an incomplete log once it exceeds N', () => {
    const twice = [suspenseHide(), suspenseHide({ hideId: 'hide:60:2', documentCommitId: 60 })]
    const incomplete = { complete: false, incompleteReasons: ['hides-evicted'], omittedByLimit: 0 }

    expect(verdictOf({ ...neverHidden, max: 2 }, withHides({ hides: twice }))).toBe('pass')
    expect(
      verdictOf({ ...neverHidden, max: 1 }, withHides({ hides: twice, hideLog: incomplete })),
    ).toBe('fail')
  })

  it('excludes forced fallbacks, which the override guard reports', () => {
    expect(verdictOf(neverHidden, withHides({ hides: [suspenseHide({ forced: true })] }))).toBe(
      'pass',
    )
  })

  it('ignores a same-named instance from another source file only on exact render coverage', () => {
    const target = { component: 'StatusBadge', source: 'src/screens/search/StatusBadge.tsx' }
    const narrowed: VerifyClaimInput = { ...neverHidden, target }
    const targets = [targetEvidence({ target })]
    const other = suspenseHide({
      hiddenTargets: [{ componentName: 'StatusBadge', mountId: 'mount:99' }],
    })
    const lowerBound = withHides({ hides: [other] }, targets)
    lowerBound.coverage = lowerBound.coverage && {
      ...lowerBound.coverage,
      complete: false,
      semantics: 'lower-bound',
      skippedCommitFibers: 3,
    }

    expect(verdictOf(narrowed, withHides({ hides: [other] }, targets))).toBe('pass')
    expect(verdictOf(narrowed, withHides({ hides: [suspenseHide()] }, targets))).toBe('fail')
    expect(reasonOf(narrowed, lowerBound)).toBe('coverage_incomplete')
  })

  it.each([
    ['capability_unavailable', withHides({ hideLog: null })],
    [
      'evidence_truncated',
      withHides({
        hideLog: { complete: false, incompleteReasons: ['hides-evicted'], omittedByLimit: 0 },
      }),
    ],
    [
      'coverage_incomplete',
      withHides({
        hideLog: { complete: false, incompleteReasons: ['commit-not-scanned'], omittedByLimit: 0 },
      }),
    ],
    [
      'evidence_truncated',
      withHides({ hideLog: { complete: true, incompleteReasons: [], omittedByLimit: 2 } }),
    ],
    [
      'coverage_incomplete',
      withHides({ hides: [suspenseHide({ hiddenTargets: [], hiddenScanComplete: false })] }),
    ],
    [
      'evidence_truncated',
      withHides({ hides: [suspenseHide({ hiddenTargets: [], hiddenTargetsOmitted: 4 })] }),
    ],
    ['target_not_found', withHides({}, [targetEvidence({ begin: [], end: [], records: [] })])],
    [
      'target_inactive',
      withHides({}, [
        targetEvidence({
          begin: [instance({ renderingState: 'mounted-hidden' })],
          end: [instance()],
        }),
      ]),
    ],
    [
      'target_inactive',
      withHides({}, [targetEvidence({ end: [instance({ renderingState: 'mounted-hidden' })] })]),
    ],
    ['evidence_unavailable', { ...windowEvidence(), boundaries: null }],
  ] as const)('refuses with %s', (reason, evidence) => {
    expect(reasonOf(neverHidden, evidence)).toBe(reason)
  })

  it('refuses when the app did not settle', () => {
    const base = windowEvidence()
    const unsettled = {
      ...base,
      window: { ...base.window, settle: { ...base.window.settle, outcome: 'timed-out' as const } },
    }

    expect(reasonOf(neverHidden, unsettled)).toBe('not_quiescent')
  })
})

describe('window guards', () => {
  const claims = [claim(badgeMax0), claim(badgeMin1), claim({ kind: 'boundaries-clean' })]
  const reasons = (inputs = guardInputs(), evidence = windowEvidence()) =>
    decide(claims, evidence, evaluateGuards(inputs), 'http://localhost/').claims.map(
      (result) => result.refusal?.reason ?? result.verdict,
    )

  it('passes all guards on an undisturbed window', () => {
    expect(evaluateGuards(guardInputs()).map((guard) => guard.status)).toEqual(Array(9).fill('ok'))
  })

  it.each([
    [
      'session_changed',
      guardInputs({
        session: { current: false, beginGeneration: 1, endGeneration: null, collision: false },
      }),
    ],
    [
      'session_changed',
      guardInputs({
        session: { current: true, beginGeneration: 1, endGeneration: 1, collision: true },
      }),
    ],
    ['window_interrupted', guardInputs({ readObservationIds: ['observation:5'] })],
    [
      'window_interrupted',
      guardInputs({ preFreeze: { ...guardInputs().preFreeze, tracking: false } as never }),
    ],
    [
      'unsupported_environment',
      guardInputs({
        end: {
          ...guardInputs().end,
          render: { ...guardInputs().preFreeze, bundle: 'production' } as never,
        },
      }),
    ],
    [
      'unsupported_environment',
      guardInputs({
        end: {
          ...guardInputs().end,
          render: {
            ...guardInputs().preFreeze,
            renderCollection: 'unavailable (hook installed after React initialised)',
          } as never,
        },
      }),
    ],
    ['code_changed', guardInputs({ end: { ...guardInputs().end, refreshSequence: 4 } })],
    ['code_changed', guardInputs({ effectRefreshCommitsExcluded: 1 })],
    ['evidence_unavailable', guardInputs({ end: { ...guardInputs().end, refreshSequence: null } })],
    [
      'document_hidden',
      guardInputs({
        end: {
          ...guardInputs().end,
          visibility: { source: 'document', state: 'visible', hiddenTransitions: 1 },
        },
      }),
    ],
    [
      'override_active',
      guardInputs({ end: { ...guardInputs().end, overrides: { total: 1, kinds: ['error'] } } }),
    ],
    [
      'override_active',
      guardInputs({ end: { ...guardInputs().end, simulatedQueries: ['["user"]'] } }),
    ],
  ] as const)('refuses every claim on %s', (reason, inputs) => {
    expect(reasons(inputs)).toEqual([reason, reason, reason])
  })

  describe('on a page that also runs production React', () => {
    it.each([
      ['development renderers host every target', ['development']],
      ['a target is mounted nowhere', [null]],
    ] as const)('decides the claims as on a development page when %s', (_, bundles) => {
      expect(reasons(mixedPageGuards([...bundles]))).toEqual(['pass', 'fail', 'pass'])
      expect(reasons(mixedPageGuards([...bundles]))).toEqual(reasons())
    })

    it.each([
      ['a production renderer hosts a target at begin', ['production'], ['development']],
      ['a target mounts in a production renderer during the window', ['development'], ['mixed']],
      ['the renderer hosting a target is unknown', ['development'], ['unknown']],
    ] as const)('refuses every claim when %s', (_, begin, end) => {
      expect(reasons(mixedPageGuards([...begin], [...end]))).toEqual([
        'unsupported_environment',
        'unsupported_environment',
        'unsupported_environment',
      ])
    })
  })

  it('refuses only absence claims without activity, and keeps a failing positive control', () => {
    expect(reasons(guardInputs({ frozenDocumentCommitId: START }))).toEqual([
      'no_activity',
      'fail',
      'pass',
    ])
  })

  it('records an unobserved visibility signal as a caveat, not a pass condition', () => {
    const guards = evaluateGuards(
      guardInputs({ begin: { ...guardInputs().begin, visibility: null } }),
    )
    expect(guards.find((guard) => guard.guard === 'document-visible')?.status).toBe('unobserved')
  })

  it('turns active overrides into a caveat when the run allows them', () => {
    const guards = evaluateGuards(
      guardInputs({
        allowOverrides: true,
        end: { ...guardInputs().end, overrides: { total: 1, kinds: ['props'] } },
      }),
    )
    expect(guards.find((guard) => guard.guard === 'no-overrides')?.status).toBe('caveat')
  })
})

describe('combining claims', () => {
  it.each([
    [['pass', 'fail', 'refused', 'inconclusive'], [], 'fail'],
    [['pass', 'refused', 'inconclusive'], [], 'refused'],
    [['pass', 'inconclusive'], [], 'inconclusive'],
    [['pass', 'pass'], [], 'pass'],
    [
      ['pass'],
      [{ guard: 'activity', status: 'refused', reason: 'no_activity', raw: {} }],
      'refused',
    ],
  ] as const)('%j with window refusals %j is %s', (verdicts, windowRefusals, expected) => {
    expect(
      combine(
        verdicts.map((verdict) => ({ verdict })),
        windowRefusals,
      ),
    ).toBe(expected)
  })
})
