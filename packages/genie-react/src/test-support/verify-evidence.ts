import type {
  CohortRecord,
  EffectEventRecord,
  EffectsRead,
  InstanceRecord,
  RenderEventRecord,
  RenderEventsRead,
  TargetEvidence,
  VerificationEvidence,
} from '../hub/verify/evidence'
import type { GuardInputs } from '../hub/verify/guards'
import {
  type VerifyClaim,
  type VerifyClaimInput,
  type VerifyTarget,
  verifyClaimSchema,
  verifyTargetKey,
} from '../protocol'

export const START = 57
export const SETTLED = 61
export const FROZEN = 61
export const OBSERVATION = 'observation:4'

export const claim = (input: VerifyClaimInput): VerifyClaim => verifyClaimSchema.parse(input)

export function instance(overrides: Partial<CohortRecord> = {}): CohortRecord {
  return {
    mountId: 'mount:12',
    key: null,
    renderingState: 'mounted-rendering',
    sourceFile: 'src/screens/search/StatusBadge.tsx',
    sourceLocation: 'src/screens/search/StatusBadge.tsx:14:8',
    ...overrides,
  }
}

export function rendered(overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    mountId: 'mount:12',
    key: null,
    logicalPath: 'SearchScreen/StatusBadge',
    mountGeneration: 1,
    mountGenerationEvidence: 'exact',
    renders: 1,
    mounts: 0,
    updates: 1,
    unmounted: false,
    latestDocumentCommitId: SETTLED,
    sourceFile: 'src/screens/search/StatusBadge.tsx',
    sourceLocation: 'src/screens/search/StatusBadge.tsx:14:8',
    ...overrides,
  }
}

export function renderEvent(overrides: Partial<RenderEventRecord> = {}): RenderEventRecord {
  return {
    renderEventId: 'render:58:301',
    documentCommitId: 58,
    mountId: 'mount:12',
    causes: [{ kind: 'state', evidence: 'exact', name: 'state[0]', reason: null }],
    inputCoverageComplete: true,
    ...overrides,
  }
}

export function events(
  list: RenderEventRecord[],
  overrides: Partial<RenderEventsRead> = {},
): RenderEventsRead {
  return {
    events: list,
    omittedByLimit: 0,
    droppedRenderEvents: 0,
    earliestRetainedDocumentCommitId: list[0]?.documentCommitId ?? null,
    attributionStale: false,
    foreignObservationEvents: 0,
    observationId: OBSERVATION,
    ...overrides,
  }
}

export function effectRun(overrides: Partial<EffectEventRecord> = {}): EffectEventRecord {
  return {
    effectEventId: 'effect:58:1',
    documentCommitId: 58,
    mountId: 'mount:12',
    effectIndex: 0,
    kind: 'effect',
    execution: { status: 'observed', trigger: 'commit' },
    ...overrides,
  }
}

export function effects(
  list: EffectEventRecord[],
  overrides: Partial<EffectsRead> = {},
): EffectsRead {
  return {
    events: list,
    omittedByLimit: 0,
    evictedEvents: 0,
    refreshCommitsExcluded: 0,
    observationId: OBSERVATION,
    declaredEffectIndexes: [0],
    ...overrides,
  }
}

export interface TargetSpec {
  target?: VerifyTarget
  records?: InstanceRecord[]
  begin?: CohortRecord[]
  end?: CohortRecord[]
  events?: RenderEventsRead | null
  effects?: EffectsRead | null
  status?: 'resolved' | 'pending' | 'ambiguous'
  omittedByLimit?: number
  attributionStale?: boolean
}

export function targetEvidence(spec: TargetSpec = {}): TargetEvidence {
  const target = spec.target ?? { component: 'StatusBadge' }
  const begin = spec.begin ?? [instance()]
  return {
    resolution: {
      target,
      status: spec.status ?? (begin.length > 0 ? 'resolved' : 'pending'),
      sourceFile: begin[0]?.sourceFile ?? null,
      candidates: [],
      unresolvedSources: 0,
      begin: { instances: begin, omittedByLimit: 0, observationId: OBSERVATION },
      listed: true,
    },
    renders: {
      records: spec.records ?? [],
      omittedByLimit: spec.omittedByLimit ?? 0,
      attributionStale: spec.attributionStale ?? false,
      observationId: OBSERVATION,
    },
    events: spec.events === undefined ? events([]) : spec.events,
    effects: spec.effects === undefined ? effects([]) : spec.effects,
    end: { instances: spec.end ?? begin, omittedByLimit: 0, observationId: OBSERVATION },
  }
}

/** A clean window: four commits, settled, exact coverage, the target mounted and rendering, nothing else unusual. */
export function windowEvidence(
  targets: TargetEvidence[] = [targetEvidence()],
  overrides: Partial<VerificationEvidence> = {},
): VerificationEvidence {
  return {
    window: {
      observationId: OBSERVATION,
      startDocumentCommitId: START,
      settledDocumentCommitId: SETTLED,
      frozenDocumentCommitId: FROZEN,
      settle: { outcome: 'met', waitedMs: 610, quietMs: 500, timeoutMs: 10_000 },
      tailMs: 500,
      strictMode: 'on',
    },
    coverage: {
      complete: true,
      semantics: 'exact',
      skippedCommitFibers: 0,
      droppedUnmountFibers: 0,
      analysisFailedFibers: 0,
      pausedCommits: 0,
      budgetExhaustedCommits: 0,
      targeted: { complete: true, skippedFibers: 0 },
      truncatedEffectLists: 0,
    },
    targets: new Map(
      targets.map((target) => [verifyTargetKey(target.resolution.target), target] as const),
    ),
    boundaries: {
      catches: [],
      catchLog: { complete: true, incompleteReasons: [], omittedByLimit: 0 },
      atEnd: [],
      scanTruncated: false,
    },
    ...overrides,
  }
}

const probe = {
  tracking: true,
  renderCollection: 'available',
  bundle: 'development' as const,
  documentCommitId: FROZEN,
  observation: { id: OBSERVATION },
}

const snapshot = {
  render: probe,
  overrides: { total: 0, kinds: [] },
  simulatedQueries: [],
  refreshSequence: 3,
  visibility: { source: 'document' as const, state: 'visible' as const, hiddenTransitions: 0 },
}

/** Begin and end snapshots of an undisturbed window on one visible development document. */
export function guardInputs(overrides: Partial<GuardInputs> = {}): GuardInputs {
  return {
    observationId: OBSERVATION,
    startDocumentCommitId: START,
    frozenDocumentCommitId: FROZEN,
    allowOverrides: false,
    settle: { outcome: 'met', waitedMs: 610 },
    session: { current: true, beginGeneration: 1, endGeneration: 1, collision: false },
    begin: snapshot,
    end: snapshot,
    preFreeze: probe,
    freezeObservationId: OBSERVATION,
    readObservationIds: [OBSERVATION],
    effectRefreshCommitsExcluded: 0,
    clear: { documentCommitId: START, observation: { id: OBSERVATION }, strictMode: 'on' },
    ...overrides,
  }
}
