import { describe, expect, it } from 'vitest'
import { devtoolsInteractionBeginContract } from '../../protocol'
import {
  reactClearRendersContract,
  reactComponentCohortContract,
  reactEffectAuditContract,
  reactGetRendersContract,
  reactProvenanceContract,
  reactRenderCausesContract,
} from './contracts'

describe('react_get_renders output contract', () => {
  it('preserves detailed hook state changes for typed agent clients', () => {
    const result = reactGetRendersContract.output.parse({
      tracking: true,
      commits: 1,
      documentCommitId: 7,
      observation: {
        id: 'observation:1',
        epoch: 1,
        startedAfterDocumentCommitId: 6,
      },
      attribution: {
        status: 'current',
        startedAtDocumentCommitId: 7,
        completedAtDocumentCommitId: 7,
        startedAtAnalysisGeneration: 9,
        completedAtAnalysisGeneration: 9,
      },
      summary: {
        semantics: 'exact',
        coverageDomain: 'render-measurement',
        commits: 1,
        trackedComponents: 1,
        totalRenders: 1,
        totalUpdates: 1,
        unstableComponents: 0,
        referenceOnlyPropComponents: 0,
        unnecessaryComponents: 0,
        noObservedInputChangeComponents: 0,
        topUnstableProps: [],
        topReferenceOnlyProps: [],
      },
      components: [
        {
          id: 1,
          name: 'Counter',
          instance: {
            fiberId: 1,
            mountId: 'mount:1',
            key: null,
            siblingIndex: 0,
            parent: null,
            keyedParent: null,
            logicalPath: 'Counter[index=0]',
            logicalIdentityEvidence: 'positional',
            mountGeneration: 1,
            mountGenerationEvidence: 'exact',
            hostSelector: '[data-testid="counter"]',
          },
          renders: 1,
          mounts: 0,
          updates: 1,
          unnecessary: 0,
          noObservedInputChange: 0,
          referenceOnlyPropRenders: 0,
          unstableRenders: 0,
          forget: false,
          compiler: {
            memoCacheObserved: false,
            evidence: 'exact',
            compilationStatus: 'unknown',
            limitation: 'runtime-memo-cache-presence-only',
          },
          selfTime: 0.1,
          totalTime: 0.1,
          cumulativeSelfTime: 0.1,
          cumulativeTotalTime: 0.1,
          changes: [
            {
              name: 'state[0]',
              kind: 'state',
              unstable: false,
              hook: { index: 0, stateIndex: 0, kind: 'state' },
              before: 1,
              after: 2,
              deepDiff: {
                changes: [{ kind: 'value', path: '', before: 1, after: 2 }],
                visited: 1,
                truncated: false,
              },
            },
          ],
          latestCommitId: 1,
          latestDocumentCommitId: 7,
          causes: [
            {
              kind: 'state',
              evidence: 'exact',
              name: 'state[0]',
              hook: { index: 0, stateIndex: 0, kind: 'state' },
              before: 1,
              after: 2,
              deepDiff: {
                changes: [{ kind: 'value', path: '', before: 1, after: 2 }],
                visited: 1,
                truncated: false,
              },
            },
          ],
          causeCounts: {
            mount: 0,
            props: 0,
            state: 1,
            children: 0,
            context: 0,
            'external-store': 0,
            query: 0,
            router: 0,
            parent: 0,
            unknown: 0,
          },
          necessity: 'necessary',
          assessment: {
            inputEvidence: 'changed',
            observedInputKinds: ['state'],
            behaviorEvidence: {
              subtreeHostMutations: {
                status: 'observed',
                count: 1,
                pendingSubtrees: 0,
                omittedByLimit: 0,
              },
              scheduledEffects: { status: 'none-observed', count: 0 },
              unobservedDomains: [
                'focus',
                'url',
                'network',
                'transition',
                'freshness',
                'effect-execution',
              ],
            },
            optimizationSafety: 'not-proven-safe',
            requiredValidation: ['dom', 'aria', 'focus', 'url', 'network', 'transition'],
          },
          inputCoverage: {
            complete: true,
            omittedInputs: 0,
            scanTruncated: false,
            propsNotEnumerated: false,
          },
          source: null,
          sourceAttribution: { role: 'unavailable', evidence: 'unknown' },
          sourceProvenance: {
            definitionSource: null,
            allocationCallsite: null,
            hookDefinitionOwner: null,
            hookCallsite: null,
            package: null,
            sourceMapConfidence: 'unknown',
            failureReason: 'source-unresolved',
            usageOrDefinitionFallback: null,
          },
          sourceOwnership: 'unknown',
          isLibrary: false,
        },
      ],
      omittedByLimit: 0,
      comparable: true,
      notComparableReasons: [],
      coverage: {
        complete: true,
        inputAttributionComplete: true,
        semantics: 'exact',
        coverageDomain: 'render-causality',
        skippedCommitFibers: 0,
        droppedUnmountFibers: 0,
        analysisFailedFibers: 0,
        truncatedInputFibers: 0,
        propsNotEnumeratedFibers: 0,
        budgetExhaustedCommits: 0,
        budgetExhaustedSubsystems: [],
      },
    })

    expect(result.components[0]?.changes[0]).toEqual({
      name: 'state[0]',
      kind: 'state',
      unstable: false,
      hook: { index: 0, stateIndex: 0, kind: 'state' },
      before: 1,
      after: 2,
      deepDiff: {
        changes: [{ kind: 'value', path: '', before: 1, after: 2 }],
        visited: 1,
        truncated: false,
      },
    })
  })
})

describe('react_provenance contract', () => {
  it('requires bounded, explicitly unresolved provenance accounting', () => {
    const result = reactProvenanceContract.output.parse({
      records: [],
      summary: {
        scanned: 0,
        returned: 0,
        resolved: 0,
        unresolved: 0,
        ownership: { app: 0, library: 0, unknown: 0 },
        sourceMaps: { mapped: 0, served: 0, unknown: 0, status: 'unknown' },
      },
      omittedByLimit: 0,
      truncated: false,
    })

    expect(result.summary.sourceMaps.status).toBe('unknown')
    expect(reactProvenanceContract.input.parse({})).toEqual({ limit: 200, appOnly: false })
  })
})

describe('react_effect_audit contract', () => {
  it('applies conservative hotness defaults and validates overrides', () => {
    expect(reactEffectAuditContract.input.parse({})).toMatchObject({
      onlyHot: false,
      appOnly: true,
      minUpdates: 3,
      minFireRate: 1,
      limit: 40,
    })
    expect(() => reactEffectAuditContract.input.parse({ minUpdates: 0 })).toThrow()
    expect(() => reactEffectAuditContract.input.parse({ minFireRate: 1.1 })).toThrow()
    expect(() =>
      reactEffectAuditContract.input.parse({ packageName: '@tanstack/react-query' }),
    ).toThrow('appOnly:false')
    expect(
      reactEffectAuditContract.input.parse({
        packageName: '@tanstack/react-query',
        appOnly: false,
      }),
    ).toMatchObject({ packageName: '@tanstack/react-query', appOnly: false })
  })
})

describe('react_render_causes contract', () => {
  it('applies bounded defaults and makes commit selectors mutually exclusive', () => {
    expect(reactRenderCausesContract.input.parse({})).toEqual({ limit: 100, appOnly: true })
    expect(() => reactRenderCausesContract.input.parse({ commit: 2, afterCommit: 1 })).toThrow(
      'mutually exclusive',
    )
    expect(() => reactRenderCausesContract.input.parse({ limit: 501 })).toThrow()
  })

  it('requires an explicit event-limit omission count', () => {
    const result = reactRenderCausesContract.output.parse({
      tracking: true,
      commits: 0,
      documentCommitId: 0,
      observation: null,
      attribution: {
        status: 'current',
        startedAtDocumentCommitId: 0,
        completedAtDocumentCommitId: 0,
        startedAtAnalysisGeneration: 1,
        completedAtAnalysisGeneration: 1,
      },
      events: [],
      omittedByLimit: 4,
      coverage: {
        complete: true,
        inputAttributionComplete: true,
        semantics: 'exact',
        coverageDomain: 'render-causality',
        skippedCommitFibers: 0,
        droppedUnmountFibers: 0,
        analysisFailedFibers: 0,
        truncatedInputFibers: 0,
        propsNotEnumeratedFibers: 0,
        budgetExhaustedCommits: 0,
        budgetExhaustedSubsystems: [],
        droppedRenderEvents: 0,
      },
      renderEventRetention: {
        evictedEvents: 0,
        earliestDocumentCommitId: null,
        latestDocumentCommitId: null,
      },
    })

    expect(result.omittedByLimit).toBe(4)
  })
})

describe('react_component_cohort contract', () => {
  it('defaults to an exact, bounded component query', () => {
    expect(reactComponentCohortContract.input.parse({ component: 'Row' })).toEqual({
      component: 'Row',
      exact: true,
      limit: 50,
    })
    expect(() => reactComponentCohortContract.input.parse({ component: '', limit: 50 })).toThrow()
  })
})

describe('react_clear_renders observation budget bounds', () => {
  it('defaults to the low-overhead budget', () => {
    expect(reactClearRendersContract.input.parse({}).budget).toEqual({
      fiberLimit: 250,
      operationLimit: 20_000,
      timeLimitMs: 8,
      targetOperationReserve: 4_000,
      targetTimeReserveMs: 4,
      adaptive: true,
    })
  })

  it('accepts the expanded opt-in budget ceilings', () => {
    expect(
      reactClearRendersContract.input.parse({
        budget: {
          fiberLimit: 20_000,
          operationLimit: 2_000_000,
          timeLimitMs: 500,
          targetOperationReserve: 500_000,
          targetTimeReserveMs: 250,
        },
      }).budget,
    ).toMatchObject({
      fiberLimit: 20_000,
      operationLimit: 2_000_000,
      timeLimitMs: 500,
      targetOperationReserve: 500_000,
      targetTimeReserveMs: 250,
    })
  })

  it('rejects a budget beyond the ceiling', () => {
    expect(() =>
      reactClearRendersContract.input.parse({ budget: { fiberLimit: 20_001 } }),
    ).toThrow()
    expect(() => reactClearRendersContract.input.parse({ budget: { timeLimitMs: 501 } })).toThrow()
    expect(() =>
      reactClearRendersContract.input.parse({ budget: { operationLimit: 2_000_001 } }),
    ).toThrow()
    expect(() =>
      reactClearRendersContract.input.parse({ budget: { targetTimeReserveMs: 251 } }),
    ).toThrow()
    expect(() =>
      reactClearRendersContract.input.parse({ budget: { targetOperationReserve: 500_001 } }),
    ).toThrow()
  })
})

describe('observation budget schemas', () => {
  const defaultBudget = {
    fiberLimit: 250,
    operationLimit: 20_000,
    timeLimitMs: 8,
    targetOperationReserve: 4_000,
    targetTimeReserveMs: 4,
    adaptive: true,
  }

  const parseBothBudgets = (budget?: Record<string, unknown>) => ({
    clear: reactClearRendersContract.input.safeParse(budget === undefined ? {} : { budget }),
    interaction: devtoolsInteractionBeginContract.input.safeParse(
      budget === undefined ? { name: 'press' } : { name: 'press', budget },
    ),
  })

  it.each([undefined, {}])('applies identical defaults for budget %j', (budget) => {
    const { clear, interaction } = parseBothBudgets(budget)

    expect(clear.success).toBe(true)
    expect(interaction.success).toBe(true)
    if (!clear.success || !interaction.success) return
    expect(clear.data.budget).toEqual(defaultBudget)
    expect(interaction.data.budget).toEqual(defaultBudget)
  })

  it('fills identical defaults for a partial budget', () => {
    const { clear, interaction } = parseBothBudgets({ fiberLimit: 1_000, adaptive: false })
    const expected = { ...defaultBudget, fiberLimit: 1_000, adaptive: false }

    expect(clear.success).toBe(true)
    expect(interaction.success).toBe(true)
    if (!clear.success || !interaction.success) return
    expect(clear.data.budget).toEqual(expected)
    expect(interaction.data.budget).toEqual(expected)
  })

  const boundaryCases: Array<{
    name: string
    budget: Record<string, unknown>
    accepted: boolean
  }> = [
    { name: 'fiber minimum - 1', budget: { fiberLimit: 49 }, accepted: false },
    { name: 'fiber minimum', budget: { fiberLimit: 50 }, accepted: true },
    { name: 'fiber maximum', budget: { fiberLimit: 20_000 }, accepted: true },
    { name: 'fiber maximum + 1', budget: { fiberLimit: 20_001 }, accepted: false },
    { name: 'fractional fiber limit', budget: { fiberLimit: 50.5 }, accepted: false },
    { name: 'operation minimum - 1', budget: { operationLimit: 999 }, accepted: false },
    { name: 'operation minimum', budget: { operationLimit: 1_000 }, accepted: true },
    { name: 'operation maximum', budget: { operationLimit: 2_000_000 }, accepted: true },
    {
      name: 'operation maximum + 1',
      budget: { operationLimit: 2_000_001 },
      accepted: false,
    },
    {
      name: 'fractional operation limit',
      budget: { operationLimit: 1_000.5 },
      accepted: false,
    },
    { name: 'time minimum - epsilon', budget: { timeLimitMs: 0.999 }, accepted: false },
    { name: 'time minimum', budget: { timeLimitMs: 1 }, accepted: true },
    { name: 'time maximum', budget: { timeLimitMs: 500 }, accepted: true },
    { name: 'time maximum + epsilon', budget: { timeLimitMs: 500.001 }, accepted: false },
    { name: 'NaN time limit', budget: { timeLimitMs: Number.NaN }, accepted: false },
    {
      name: 'infinite time limit',
      budget: { timeLimitMs: Number.POSITIVE_INFINITY },
      accepted: false,
    },
    {
      name: 'target operation minimum - 1',
      budget: { targetOperationReserve: 99 },
      accepted: false,
    },
    {
      name: 'target operation minimum',
      budget: { targetOperationReserve: 100 },
      accepted: true,
    },
    {
      name: 'target operation maximum',
      budget: { targetOperationReserve: 500_000 },
      accepted: true,
    },
    {
      name: 'target operation maximum + 1',
      budget: { targetOperationReserve: 500_001 },
      accepted: false,
    },
    {
      name: 'fractional target operation reserve',
      budget: { targetOperationReserve: 100.5 },
      accepted: false,
    },
    {
      name: 'target time minimum - epsilon',
      budget: { targetTimeReserveMs: 0.499 },
      accepted: false,
    },
    { name: 'target time minimum', budget: { targetTimeReserveMs: 0.5 }, accepted: true },
    { name: 'target time maximum', budget: { targetTimeReserveMs: 250 }, accepted: true },
    {
      name: 'target time maximum + epsilon',
      budget: { targetTimeReserveMs: 250.001 },
      accepted: false,
    },
    {
      name: 'NaN target time reserve',
      budget: { targetTimeReserveMs: Number.NaN },
      accepted: false,
    },
    {
      name: 'infinite target time reserve',
      budget: { targetTimeReserveMs: Number.NEGATIVE_INFINITY },
      accepted: false,
    },
    { name: 'adaptive enabled', budget: { adaptive: true }, accepted: true },
    { name: 'adaptive disabled', budget: { adaptive: false }, accepted: true },
    { name: 'non-boolean adaptive value', budget: { adaptive: 'true' }, accepted: false },
  ]

  it.each(boundaryCases)('enforces $name identically', ({ budget, accepted }) => {
    const { clear, interaction } = parseBothBudgets(budget)

    expect(clear.success).toBe(accepted)
    expect(interaction.success).toBe(accepted)
    if (!clear.success || !interaction.success) return
    expect(interaction.data.budget).toEqual(clear.data.budget)
  })
})
