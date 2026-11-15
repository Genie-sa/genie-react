import { describe, expect, it } from 'vitest'
import type { VerifyClaimInput } from '../../protocol'
import {
  claim,
  effectRun,
  effects,
  events,
  guardInputs,
  instance,
  renderEvent,
  rendered,
  SETTLED,
  targetEvidence,
  windowEvidence,
} from '../../test-support/verify-evidence'
import type { VerificationEvidence } from './evidence'
import { evaluateGuards, type GuardInputs } from './guards'
import { decide, passesOnAbsence } from './verdict'

/** Deterministic PRNG, so a failing case reproduces from its seed. */
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 2 ** 32
  }
}

interface Case {
  claims: VerifyClaimInput[]
  evidence: VerificationEvidence
  guards: GuardInputs
}

const target = { component: 'StatusBadge' }

function generate(next: () => number): Case {
  const pick = <T>(values: readonly T[]): T => values[Math.floor(next() * values.length)] as T
  const renders = Math.floor(next() * 4)
  const causeKinds = ['state', 'props', 'context'] as const
  const eventList = Array.from({ length: renders }, (_, index) =>
    renderEvent({
      renderEventId: `render:${58 + index}:${index}`,
      documentCommitId: 58 + index,
      causes: [{ kind: pick(causeKinds), evidence: 'exact', name: null, reason: null }],
    }),
  )
  const runs = Math.floor(next() * 3)
  const effectList = Array.from({ length: runs }, (_, index) =>
    effectRun({
      effectEventId: `effect:${index}`,
      documentCommitId: next() < 0.3 ? SETTLED + 1 + index : 58 + index,
      execution: { status: 'observed', trigger: next() < 0.2 ? 'strict-mode-replay' : 'commit' },
    }),
  )
  const evidence = windowEvidence([
    targetEvidence({
      begin: [instance()],
      records: renders > 0 ? [rendered({ renders, updates: renders })] : [],
      events: events(eventList),
      effects: effects(effectList),
    }),
  ])
  const bound = Math.floor(next() * 3)
  const claims: VerifyClaimInput[] = [
    pick([
      { kind: 'renders', target, max: bound },
      { kind: 'renders', target, min: bound },
      { kind: 'render-causes', target, allow: [{ kind: pick(causeKinds) }] },
      { kind: 'effect-runs', target, max: bound },
      { kind: 'effect-settles', target },
      { kind: 'boundaries-clean' },
    ] satisfies VerifyClaimInput[]),
  ]
  return { claims, evidence, guards: guardInputs() }
}

const firstTarget = (evidence: VerificationEvidence) => [...evidence.targets.values()][0]

/** Each makes the evidence strictly worse: less complete, less fresh, or less certain about the window. */
const degradations: Record<string, (input: Case) => Case> = {
  'coverage incomplete': (input) => ({
    ...input,
    evidence: {
      ...input.evidence,
      coverage: input.evidence.coverage && {
        ...input.evidence.coverage,
        complete: false,
        semantics: 'lower-bound',
        skippedCommitFibers: input.evidence.coverage.skippedCommitFibers + 1,
      },
    },
  }),
  'render report stale': (input) =>
    mapTarget(input, (target) => ({
      ...target,
      renders: target.renders && { ...target.renders, attributionStale: true },
    })),
  'render records omitted by a limit': (input) =>
    mapTarget(input, (target) => ({
      ...target,
      renders: target.renders && {
        ...target.renders,
        omittedByLimit: target.renders.omittedByLimit + 1,
      },
    })),
  'render events evicted': (input) =>
    mapTarget(input, (target) => ({
      ...target,
      events: target.events && {
        ...target.events,
        droppedRenderEvents: target.events.droppedRenderEvents + 1,
      },
    })),
  'effect events evicted': (input) =>
    mapTarget(input, (target) => ({
      ...target,
      effects: target.effects && {
        ...target.effects,
        evictedEvents: target.effects.evictedEvents + 1,
      },
    })),
  'observation ID changed': (input) => ({
    ...input,
    guards: { ...input.guards, readObservationIds: ['observation:999'] },
  }),
  'settle timed out': (input) => ({
    ...input,
    evidence: {
      ...input.evidence,
      window: {
        ...input.evidence.window,
        settle: { ...input.evidence.window.settle, outcome: 'timed-out' },
      },
    },
    guards: { ...input.guards, settle: { outcome: 'timed-out', waitedMs: 10_000 } },
  }),
  'catch log incomplete': (input) => ({
    ...input,
    evidence: {
      ...input.evidence,
      boundaries: input.evidence.boundaries && {
        ...input.evidence.boundaries,
        catchLog: { complete: false, incompleteReasons: ['commit-not-scanned'], omittedByLimit: 0 },
      },
    },
  }),
}

/** Degradations that remove what an absence needs; an upper-bound claim must never pass after one. */
const COMPLETENESS = new Set([
  'coverage incomplete',
  'render report stale',
  'render records omitted by a limit',
  'observation ID changed',
  'settle timed out',
])

function mapTarget(
  input: Case,
  change: (
    target: NonNullable<ReturnType<typeof firstTarget>>,
  ) => NonNullable<ReturnType<typeof firstTarget>>,
): Case {
  const current = firstTarget(input.evidence)
  if (!current) return input
  const [key] = [...input.evidence.targets.keys()]
  return {
    ...input,
    evidence: { ...input.evidence, targets: new Map([[key as string, change(current)]]) },
  }
}

function verdict(input: Case): string {
  return decide(
    input.claims.map(claim),
    input.evidence,
    evaluateGuards(input.guards),
    'http://localhost/search',
  ).verdict
}

describe('degrading evidence never produces a pass', () => {
  it('holds over generated windows and every degradation', () => {
    const next = random(20_261_115)
    const violations: string[] = []
    for (let index = 0; index < 600; index += 1) {
      const base = generate(next)
      const before = verdict(base)
      const [only] = base.claims
      const upperBound = only !== undefined && passesOnAbsence(claim(only))
      for (const [name, degrade] of Object.entries(degradations)) {
        const after = verdict(degrade(base))
        if (before !== 'pass' && after === 'pass')
          violations.push(`#${index} ${name}: ${before} -> pass`)
        if (upperBound && COMPLETENESS.has(name) && after === 'pass')
          violations.push(`#${index} ${name}: upper-bound ${JSON.stringify(only)} passed`)
      }
    }
    expect(violations).toEqual([])
  })

  it('generates passes, fails and refusals, so the property is not vacuous', () => {
    const next = random(20_261_115)
    const seen = new Set(Array.from({ length: 600 }, () => verdict(generate(next))))

    expect(seen).toEqual(new Set(['pass', 'fail', 'refused', 'inconclusive']))
  })
})
