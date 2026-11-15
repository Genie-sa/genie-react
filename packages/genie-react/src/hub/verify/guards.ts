import type { RefusalReason, VerifyGuard, VerifyGuardName } from '../../protocol'
import type { RendererBundle, RenderProbe, VisibilityRead } from './evidence'

/** What the window looked like at `begin` and at `end`; every guard is decided from these raw values alone. */
export interface GuardInputs {
  observationId: string
  startDocumentCommitId: number
  frozenDocumentCommitId: number | null
  allowOverrides: boolean
  settle: { outcome: 'met' | 'timed-out' | 'failed'; reason?: string; waitedMs: number }
  session: {
    current: boolean
    beginGeneration: number | null
    endGeneration: number | null
    collision: boolean
  }
  begin: Snapshot
  end: Snapshot
  /** The probe just before the freeze, which must still be recording this window. */
  preFreeze: RenderProbe | null
  freezeObservationId: string | null
  /** Observation IDs every post-freeze read reported; null where a read carries none. */
  readObservationIds: (string | null)[]
  effectRefreshCommitsExcluded: number
}

export interface Snapshot {
  render: RenderProbe | null
  /** The build of the renderers hosting each claim target, from its cohort read; `unknown` where the read failed. */
  targetBundles: (RendererBundle | null)[]
  overrides: { total: number; kinds: string[] } | null
  simulatedQueries: string[] | null
  refreshSequence: number | null
  visibility: VisibilityRead | null
}

/** The rule settle uses: degraded collection missed only commits before the hook installed. */
export const ACCEPTED_COLLECTION = (status: string | undefined): boolean =>
  status === 'available' || (status?.startsWith('degraded (') ?? false)

/** Why the React build cannot back the claims, or null. A page may mix builds, since frameworks bundle production React for their own UI (the Next.js dev overlay); only the renderers hosting a target decide, because Genie analyzes no other. */
export function environmentProblem(
  snapshot: Pick<Snapshot, 'render' | 'targetBundles'>,
): string | null {
  const page = snapshot.render?.bundle ?? 'unknown'
  if (page === 'development') return null
  if (page !== 'mixed')
    return `The app runs a ${page} React bundle; verify needs the development build.`
  const hosting = snapshot.targetBundles.find(
    (bundle) => bundle !== null && bundle !== 'development',
  )
  if (hosting === undefined) return null
  return hosting === 'unknown'
    ? 'The page mixes React builds and the renderer hosting a claim target could not be identified; verify needs the development build.'
    : 'A claim target is mounted in a production React renderer; verify needs the development build.'
}

function guard(
  name: VerifyGuardName,
  failed: false | { reason: RefusalReason; message: string },
  raw: Record<string, unknown>,
): VerifyGuard {
  return failed
    ? { guard: name, status: 'refused', reason: failed.reason, message: failed.message, raw }
    : { guard: name, status: 'ok', raw }
}

export function evaluateGuards(input: GuardInputs): VerifyGuard[] {
  const { begin, end, session } = input
  const sameGeneration = session.beginGeneration === session.endGeneration
  const readsBound = input.readObservationIds.every(
    (id) => id === null || id === input.observationId,
  )
  const intact =
    input.preFreeze?.tracking === true &&
    input.preFreeze.observation?.id === input.observationId &&
    input.freezeObservationId === input.observationId &&
    readsBound
  const environment = environmentProblem(begin) ?? environmentProblem(end)
  const collections = [begin.render?.renderCollection, end.render?.renderCollection]
  const refreshKnown = begin.refreshSequence !== null && end.refreshSequence !== null
  const refreshed =
    !refreshKnown ||
    begin.refreshSequence !== end.refreshSequence ||
    input.effectRefreshCommitsExcluded > 0
  const commits =
    input.frozenDocumentCommitId === null
      ? null
      : input.frozenDocumentCommitId - input.startDocumentCommitId
  return [
    guard(
      'same-document',
      session.current && sameGeneration && !session.collision
        ? false
        : {
            reason: 'session_changed',
            message: !session.current
              ? 'The document closed or reloaded during the window.'
              : session.collision
                ? 'Another tab claimed the same logical session during the window.'
                : 'The document generation changed during the window.',
          },
      { ...session },
    ),
    guard(
      'window-intact',
      intact
        ? false
        : {
            reason: 'window_interrupted',
            message:
              input.preFreeze?.tracking === false
                ? 'Profiling was paused during the window.'
                : 'The observation was reset during the window, so earlier renders were lost.',
          },
      {
        observationId: input.observationId,
        preFreezeObservationId: input.preFreeze?.observation?.id ?? null,
        preFreezeTracking: input.preFreeze?.tracking ?? null,
        freezeObservationId: input.freezeObservationId,
        readObservationIds: [...new Set(input.readObservationIds)],
      },
    ),
    guard(
      'development-bundle',
      environment ? { reason: 'unsupported_environment', message: environment } : false,
      {
        begin: begin.render?.bundle ?? 'unknown',
        end: end.render?.bundle ?? 'unknown',
        targetBundles: { begin: begin.targetBundles, end: end.targetBundles },
      },
    ),
    guard(
      'render-collection',
      collections.every(ACCEPTED_COLLECTION)
        ? false
        : {
            reason: 'unsupported_environment',
            message: 'Render collection cannot observe commits in this app.',
          },
      { begin: collections[0] ?? null, end: collections[1] ?? null },
    ),
    guard(
      'no-code-change',
      refreshed
        ? refreshKnown
          ? {
              reason: 'code_changed',
              message:
                'Fast Refresh applied an edit during the window; renders in refresh commits are invisible.',
            }
          : {
              reason: 'evidence_unavailable',
              message:
                'Fast Refresh events could not be read, so an edit during the window cannot be ruled out.',
            }
        : false,
      {
        beginSequence: begin.refreshSequence,
        endSequence: end.refreshSequence,
        refreshCommitsExcluded: input.effectRefreshCommitsExcluded,
      },
    ),
    visibilityGuard(begin.visibility, end.visibility),
    overridesGuard(input),
    guard(
      'activity',
      commits !== null && commits > 0
        ? false
        : {
            reason: 'no_activity',
            message:
              'No React commit happened in the window; the interaction did not reach this tab or did not change React state.',
          },
      {
        startDocumentCommitId: input.startDocumentCommitId,
        frozenDocumentCommitId: input.frozenDocumentCommitId,
        commits,
      },
    ),
    input.settle.outcome === 'met'
      ? { guard: 'settled', status: 'ok', raw: { ...input.settle } }
      : {
          guard: 'settled',
          status: 'caveat',
          reason: 'not_quiescent',
          message: `The app did not settle within the timeout${input.settle.reason ? ` (${input.settle.reason})` : ''}; upper-bound claims refuse, lower-bound claims can still pass.`,
          raw: { ...input.settle },
        },
  ]
}

function visibilityGuard(begin: VisibilityRead | null, end: VisibilityRead | null): VerifyGuard {
  const raw = {
    begin: begin ?? null,
    end: end ?? null,
  }
  if (!begin || !end || begin.source === 'unavailable' || end.source === 'unavailable') {
    return {
      guard: 'document-visible',
      status: 'unobserved',
      message: 'The app reports no visibility signal, so a hidden interval is not observed.',
      raw,
    }
  }
  const hidden =
    begin.state !== 'visible' ||
    end.state !== 'visible' ||
    end.hiddenTransitions !== begin.hiddenTransitions
  return guard(
    'document-visible',
    hidden
      ? {
          reason: 'document_hidden',
          message:
            'The document was hidden during the window; throttled timers can push work past the measurement.',
        }
      : false,
    raw,
  )
}

function overridesGuard(input: GuardInputs): VerifyGuard {
  const { begin, end } = input
  const kinds = [...(begin.overrides?.kinds ?? []), ...(end.overrides?.kinds ?? [])]
  const simulated = [...(begin.simulatedQueries ?? []), ...(end.simulatedQueries ?? [])]
  const raw = {
    begin: { overrides: begin.overrides?.total ?? null, simulatedQueries: begin.simulatedQueries },
    end: { overrides: end.overrides?.total ?? null, simulatedQueries: end.simulatedQueries },
    allowOverrides: input.allowOverrides,
  }
  if (!begin.overrides || !end.overrides) {
    return {
      guard: 'no-overrides',
      status: input.allowOverrides ? 'caveat' : 'refused',
      reason: 'override_active',
      message: 'Active overrides could not be listed, so simulated state cannot be ruled out.',
      raw,
    }
  }
  const active = begin.overrides.total + end.overrides.total + simulated.length > 0
  if (!active) return { guard: 'no-overrides', status: 'ok', raw }
  const what = [...new Set([...kinds, ...(simulated.length > 0 ? ['query simulation'] : [])])].join(
    ', ',
  )
  return input.allowOverrides
    ? {
        guard: 'no-overrides',
        status: 'caveat',
        message: `Overrides were active (${what}); the result describes simulated state.`,
        raw,
      }
    : {
        guard: 'no-overrides',
        status: 'refused',
        reason: 'override_active',
        message: `Overrides were active (${what}), so the state came from Genie, not the code.`,
        raw,
      }
}
