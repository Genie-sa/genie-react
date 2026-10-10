import { describe, expect, it } from 'vitest'
import { type InteractionCapture, interactionSummarySchema } from '../protocol'
import { summarizeInteraction } from './interaction-summary'

function captureWith(components: Record<string, unknown>[]): InteractionCapture {
  return {
    schemaVersion: '1.0',
    kind: 'interaction-capture',
    interactionId: 'interaction:1',
    name: 'filter',
    state: 'completed',
    startedAt: '2026-10-10T00:00:00.000Z',
    stoppedAt: '2026-10-10T00:00:01.000Z',
    session: { sessionId: 'session:1', app: {} },
    boundary: {
      observationId: 'observation:1',
      startDocumentCommitId: 1,
      stopDocumentCommitId: 3,
      finalDocumentCommitId: 3,
      recordedCommits: 2,
      postInteractionCommits: 0,
      trackingFrozen: true,
      postInteractionPolicy: 'excluded-by-profile-freeze',
    },
    coverage: {
      complete: false,
      comparable: true,
      notComparableReasons: [],
      boundary: 'profile-frozen-before-settle',
    },
    warnings: [],
    settle: { ok: true, waitedMs: 500, domains: {} },
    sections: {
      renders: {
        status: 'ok',
        tool: 'react_get_renders',
        args: {},
        capturedAt: '2026-10-10T00:00:01.000Z',
        durationMs: 1,
        result: {
          commits: 2,
          summary: { semantics: 'lower-bound', trackedComponents: 2, totalRenders: 9 },
          components,
        },
      },
    },
  }
}

const row = {
  id: 7,
  name: 'Row',
  renders: 5,
  updates: 5,
  selfTime: 0.5,
  noObservedInputChange: 2,
  referenceOnlyPropRenders: 0,
  functionIdentityPropRenders: 1,
  assessment: { inputEvidence: 'changed' },
  inputCoverage: {
    complete: false,
    omittedInputs: 0,
    scanTruncated: false,
    propsNotEnumerated: true,
  },
  causeCounts: { props: 3, state: 1 },
  causes: [
    { kind: 'state', evidence: 'exact', name: 'state[0]' },
    { kind: 'props', evidence: 'exact', name: 'onSelect', referenceOnly: true },
  ],
}

const todos = {
  id: 9,
  name: 'Todos',
  renders: 4,
  updates: 4,
  selfTime: 0.2,
  assessment: { inputEvidence: 'changed' },
  inputCoverage: { complete: true },
  causeCounts: { query: 2, state: 2 },
  causes: [
    {
      kind: 'query',
      evidence: 'exact',
      reason: 'query-notification-delivered',
      queryHash: '["todos"]',
      notification: { changedResultFields: ['fetchStatus'] },
    },
  ],
}

describe('interaction summary', () => {
  it('reports render semantics, memo counters, input evidence and latest-render cause details', () => {
    const summary = summarizeInteraction(captureWith([row, todos]))

    expect(() => interactionSummarySchema.shape.renders.parse(summary.renders)).not.toThrow()
    expect(summary.renders).toMatchObject({ semantics: 'lower-bound', totalRenders: 9 })
    expect(summary.renders.components).toEqual([
      {
        id: 7,
        name: 'Row',
        renders: 5,
        updates: 5,
        selfTime: 0.5,
        noObservedInputChange: 2,
        functionIdentityPropRenders: 1,
        inputEvidence: 'changed',
        inputCoverage: { complete: false, propsNotEnumerated: true },
        topCause: {
          kind: 'props',
          count: 3,
          latestName: 'onSelect',
          evidence: 'exact',
          referenceOnly: true,
        },
      },
      {
        id: 9,
        name: 'Todos',
        renders: 4,
        updates: 4,
        selfTime: 0.2,
        inputEvidence: 'changed',
        topCause: {
          kind: 'query',
          count: 2,
          tiedWith: ['state'],
          latestName: '["todos"]',
          evidence: 'exact',
          reason: 'query-notification-delivered',
          changedResultFields: ['fetchStatus'],
        },
      },
    ])
  })

  it('omits latest-render details when the latest render had no cause of the top kind', () => {
    const summary = summarizeInteraction(
      captureWith([{ ...row, causes: [{ kind: 'state', evidence: 'exact', name: 'state[0]' }] }]),
    )
    expect(summary.renders.components[0]?.topCause).toEqual({ kind: 'props', count: 3 })
  })
})
