import { describe, expect, it } from 'vitest'
import type { RefusalReason, VerifyClaimInput } from '../../protocol'
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
import type { VerificationEvidence } from './evidence'
import { evaluateGuards, type GuardInputs } from './guards'
import { decide } from './verdict'

/** One row of the design's false-pass table: a false claim, the evidence Genie sees, and that evidence with only the protecting signal removed. */
interface Row {
  row: number
  name: string
  claims: VerifyClaimInput[]
  protectedEvidence?: VerificationEvidence
  protectedGuards?: GuardInputs
  unprotectedEvidence?: VerificationEvidence
  unprotectedGuards?: GuardInputs
  /** The verdict and reason the mechanism produces instead of `pass`. */
  expected: {
    verdict: 'fail' | 'refused' | 'inconclusive'
    reason?: RefusalReason | 'strict_mode_replay'
  }
}

const max0: VerifyClaimInput = { kind: 'renders', target: { component: 'StatusBadge' }, max: 0 }

function run(claims: VerifyClaimInput[], evidence = windowEvidence(), inputs = guardInputs()) {
  return decide(claims.map(claim), evidence, evaluateGuards(inputs), 'http://localhost/search')
}

function withCoverage(
  changes: Partial<NonNullable<VerificationEvidence['coverage']>>,
  base = windowEvidence(),
) {
  return { ...base, coverage: base.coverage ? { ...base.coverage, ...changes } : null }
}

const rows: Row[] = [
  {
    row: 1,
    name: 'stale identity: a target resolved before a reload names another document',
    claims: [max0],
    protectedGuards: guardInputs({
      session: { current: true, beginGeneration: 1, endGeneration: 2, collision: false },
    }),
    unprotectedGuards: guardInputs(),
    expected: { verdict: 'refused', reason: 'session_changed' },
  },
  {
    row: 2,
    name: 'remount with a new ID: a changing key turns updates into mounts',
    claims: [{ ...max0, counting: 'updates' }],
    protectedEvidence: windowEvidence([
      targetEvidence({
        begin: [instance({ mountId: 'mount:1' })],
        end: [instance({ mountId: 'mount:3' })],
        records: [
          rendered({ mountId: 'mount:2', renders: 1, mounts: 1, updates: 0, unmounted: true }),
          rendered({ mountId: 'mount:3', renders: 1, mounts: 1, updates: 0 }),
        ],
      }),
    ]),
    unprotectedEvidence: windowEvidence([
      targetEvidence({
        begin: [instance({ mountId: 'mount:3' })],
        end: [instance({ mountId: 'mount:3' })],
        records: [],
      }),
    ]),
    expected: { verdict: 'fail' },
  },
  {
    row: 3,
    name: 'renamed component: the claim matches nothing, so zero renders hold trivially',
    claims: [max0],
    protectedEvidence: windowEvidence([targetEvidence({ begin: [], end: [] })]),
    unprotectedEvidence: windowEvidence([targetEvidence()]),
    expected: { verdict: 'refused', reason: 'target_not_found' },
  },
  {
    row: 4,
    name: 'name collision: two StatusBadge components in different files are merged',
    claims: [{ kind: 'renders', target: { component: 'StatusBadge' }, min: 1 }],
    protectedEvidence: windowEvidence([
      targetEvidence({
        records: [rendered({ mountId: 'mount:40', sourceFile: 'src/admin/StatusBadge.tsx' })],
      }),
    ]),
    unprotectedEvidence: windowEvidence([
      targetEvidence({ records: [rendered({ mountId: 'mount:40' })] }),
    ]),
    expected: { verdict: 'refused', reason: 'target_ambiguous' },
  },
  {
    row: 5,
    name: 'work skipped by a budget: the target fibers were never analyzed',
    claims: [max0],
    protectedEvidence: withCoverage({
      complete: false,
      semantics: 'lower-bound',
      budgetExhaustedCommits: 1,
      budgetAdvice: { exhaustedLimits: ['fiberLimit'], suggestedBudget: { fiberLimit: 1200 } },
    }),
    unprotectedEvidence: windowEvidence(),
    expected: { verdict: 'refused', reason: 'budget_exhausted' },
  },
  {
    row: 6,
    name: 'evicted events: a count built from retained cause events is low',
    claims: [
      { kind: 'render-causes', target: { component: 'StatusBadge' }, allow: [{ kind: 'state' }] },
    ],
    protectedEvidence: windowEvidence([
      targetEvidence({
        records: [rendered({ renders: 3 })],
        events: events([renderEvent()], { droppedRenderEvents: 2 }),
      }),
    ]),
    unprotectedEvidence: windowEvidence([
      targetEvidence({ records: [rendered({ renders: 1 })], events: events([renderEvent()]) }),
    ]),
    expected: { verdict: 'refused', reason: 'evidence_truncated' },
  },
  {
    row: 7,
    name: 'reading before the app settled: the target renders late, inside the tail',
    claims: [{ ...max0, max: 1 }],
    protectedEvidence: windowEvidence([
      targetEvidence({ records: [rendered({ latestDocumentCommitId: SETTLED + 1 })] }),
    ]),
    unprotectedEvidence: windowEvidence([targetEvidence({ records: [rendered()] })]),
    expected: { verdict: 'refused', reason: 'not_quiescent' },
  },
  {
    row: 8,
    name: 'the interaction never happened: no React commit in the window',
    claims: [max0],
    protectedGuards: guardInputs({ frozenDocumentCommitId: START }),
    unprotectedGuards: guardInputs(),
    expected: { verdict: 'refused', reason: 'no_activity' },
  },
  {
    row: 9,
    name: 'the wrong session: a cloned tab shares the logical session',
    claims: [max0],
    protectedGuards: guardInputs({
      session: { current: true, beginGeneration: 1, endGeneration: 1, collision: true },
    }),
    unprotectedGuards: guardInputs(),
    expected: { verdict: 'refused', reason: 'session_changed' },
  },
  {
    row: 10,
    name: 'a hidden tab: deferred work waits until after the quiet window',
    claims: [max0],
    protectedGuards: guardInputs({
      end: {
        ...guardInputs().end,
        visibility: { source: 'document', state: 'visible', hiddenTransitions: 1 },
      },
    }),
    unprotectedGuards: guardInputs(),
    expected: { verdict: 'refused', reason: 'document_hidden' },
  },
  {
    row: 11,
    name: 'a production React copy hosting the target strips the development data counts depend on',
    claims: [max0],
    protectedGuards: mixedPageGuards(['production']),
    unprotectedGuards: mixedPageGuards(['development']),
    expected: { verdict: 'refused', reason: 'unsupported_environment' },
  },
  {
    row: 12,
    name: 'StrictMode replays effects on mount: an excess only from replays is not a fail',
    claims: [{ kind: 'effect-runs', target: { component: 'StatusBadge' }, max: 1 }],
    protectedEvidence: windowEvidence([
      targetEvidence({
        records: [rendered()],
        effects: effects([
          effectRun({ execution: { status: 'observed', trigger: 'strict-mode-replay' } }),
        ]),
      }),
    ]),
    unprotectedEvidence: windowEvidence([
      targetEvidence({ records: [rendered()], effects: effects([effectRun()]) }),
    ]),
    expected: { verdict: 'inconclusive', reason: 'strict_mode_replay' },
  },
  {
    row: 13,
    name: 'Fast Refresh during the window: refresh commits are invisible to profiling',
    claims: [max0],
    protectedGuards: guardInputs({ end: { ...guardInputs().end, refreshSequence: 4 } }),
    unprotectedGuards: guardInputs(),
    expected: { verdict: 'refused', reason: 'code_changed' },
  },
  {
    row: 14,
    name: 'the window was reset by another caller, losing earlier renders',
    claims: [max0],
    protectedGuards: guardInputs({ freezeObservationId: 'observation:5' }),
    unprotectedGuards: guardInputs(),
    expected: { verdict: 'refused', reason: 'window_interrupted' },
  },
  {
    row: 15,
    name: 'overrides: a forced boundary or simulated query produced the state',
    claims: [max0],
    protectedGuards: guardInputs({
      begin: { ...guardInputs().begin, overrides: { total: 1, kinds: ['props'] } },
    }),
    unprotectedGuards: guardInputs(),
    expected: { verdict: 'refused', reason: 'override_active' },
  },
  {
    row: 16,
    name: 'an inactive target: frozen or hidden, so it could not have rendered',
    claims: [max0],
    protectedEvidence: windowEvidence([
      targetEvidence({ begin: [instance({ renderingState: 'mounted-frozen' })] }),
    ]),
    unprotectedEvidence: windowEvidence([targetEvidence()]),
    expected: { verdict: 'refused', reason: 'target_inactive' },
  },
  {
    row: 17,
    name: 'hidden ownership: a record with unknown source ownership still counts',
    claims: [max0],
    protectedEvidence: windowEvidence([
      targetEvidence({ records: [rendered({ sourceFile: null, sourceLocation: null })] }),
    ]),
    unprotectedEvidence: windowEvidence([targetEvidence({ records: [] })]),
    expected: { verdict: 'fail' },
  },
  {
    row: 18,
    name: 'inferred causes read as proof: a parent render matched by position',
    claims: [
      { kind: 'render-causes', target: { component: 'StatusBadge' }, allow: [{ kind: 'state' }] },
    ],
    protectedEvidence: windowEvidence([
      targetEvidence({
        records: [rendered()],
        events: events([
          renderEvent({
            causes: [{ kind: 'state', evidence: 'inferred', name: 'state[0]', reason: null }],
          }),
        ]),
      }),
    ]),
    unprotectedEvidence: windowEvidence([
      targetEvidence({ records: [rendered()], events: events([renderEvent()]) }),
    ]),
    expected: { verdict: 'refused', reason: 'evidence_inferred' },
  },
  {
    row: 19,
    name: 'effect scheduling read as execution: React flagged it, nobody saw it run',
    claims: [{ kind: 'effect-runs', target: { component: 'StatusBadge' }, max: 0 }],
    protectedEvidence: windowEvidence([
      targetEvidence({
        records: [rendered()],
        effects: effects([
          effectRun({ execution: { status: 'unobserved', reason: 'instrumentation-unavailable' } }),
        ]),
      }),
    ]),
    unprotectedEvidence: windowEvidence([
      targetEvidence({ records: [rendered()], effects: effects([]) }),
    ]),
    expected: { verdict: 'refused', reason: 'evidence_unavailable' },
  },
  {
    row: 21,
    name: 'a boundary caught and reset during the window, so the end state is clean',
    claims: [{ kind: 'boundaries-clean' }],
    protectedEvidence: {
      ...windowEvidence(),
      boundaries: {
        catches: [
          {
            catchId: 'catch:58:1',
            documentCommitId: 58,
            boundaryName: 'Boundary',
            boundaryKind: 'error-boundary',
            forced: false,
            message: 'save failed',
            throwingComponent: null,
          },
        ],
        catchLog: { complete: true, incompleteReasons: [], omittedByLimit: 0 },
        atEnd: [],
        scanTruncated: false,
        hides: [],
        hideLog: { complete: true, incompleteReasons: [], omittedByLimit: 0 },
      },
    },
    unprotectedEvidence: windowEvidence(),
    expected: { verdict: 'fail' },
  },
  {
    row: 26,
    name: 'reading during commits: a stale report mixes two states',
    claims: [max0],
    protectedEvidence: windowEvidence([targetEvidence({ attributionStale: true })]),
    unprotectedEvidence: windowEvidence([targetEvidence()]),
    expected: { verdict: 'refused', reason: 'coverage_incomplete' },
  },
  {
    row: 30,
    name: 'a fallback hid the target and resolved before end, and hiding is not a render',
    claims: [{ kind: 'suspense-hidden', target: { component: 'StatusBadge' }, max: 0 }],
    protectedEvidence: {
      ...windowEvidence(),
      boundaries: {
        ...(windowEvidence().boundaries as NonNullable<VerificationEvidence['boundaries']>),
        hides: [suspenseHide()],
      },
    },
    unprotectedEvidence: windowEvidence(),
    expected: { verdict: 'fail' },
  },
]

describe('every false-pass row has a mechanism that keeps the verdict off pass', () => {
  it.each(rows.map((entry) => [entry.row, entry.name, entry] as const))(
    'row %i: %s',
    (_row, _name, entry) => {
      const guarded = run(entry.claims, entry.protectedEvidence, entry.protectedGuards)
      const removed = run(entry.claims, entry.unprotectedEvidence, entry.unprotectedGuards)
      const result = guarded.claims[0]

      expect(guarded.verdict).toBe(entry.expected.verdict)
      if (entry.expected.reason) {
        expect(result?.refusal?.reason ?? result?.inconclusive?.reason).toBe(entry.expected.reason)
      }
      expect(removed.verdict).toBe('pass')
    },
  )

  it('row 20: a slow effect loop passes only with its observation horizon stated', () => {
    const verdict = run(
      [{ kind: 'effect-settles', target: { component: 'StatusBadge' } }],
      windowEvidence([targetEvidence({ records: [rendered()], effects: effects([]) })]),
    )

    expect(verdict.claims[0]).toMatchObject({
      verdict: 'pass',
      caveats: ['horizon'],
      observed: { horizonMs: 500 },
    })
  })

  it('row 22: every boundaries result says uncaught errors outside boundaries are not observed', () => {
    const verdict = run([{ kind: 'boundaries-clean' }])

    expect(verdict.claims[0]?.caveats).toContain('uncaught-errors-outside-boundaries-unobserved')
  })
})
