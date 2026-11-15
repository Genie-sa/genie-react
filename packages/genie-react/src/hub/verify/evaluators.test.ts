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
  targetEvidence,
  windowEvidence,
} from '../../test-support/verify-evidence'
import type { VerificationEvidence } from './evidence'
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
