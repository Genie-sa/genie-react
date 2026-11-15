import type { z } from 'zod'
import {
  type AgentErrorCode,
  type AgentToolContract,
  ALWAYS_INFERRED_CAUSE_KINDS,
  claimTarget,
  devtoolsVerifyAbortContract,
  devtoolsVerifyBeginContract,
  devtoolsVerifyEndContract,
  devtoolsVerifyReadContract,
  formatVerifyClaim,
  type HubErrorCode,
  newId,
  type RefusalReason,
  toolValidationFailure,
  VERDICT_EXIT_CODES,
  VERIFY_SCHEMA_VERSION,
  type Verdict,
  type VerifyClaim,
  type VerifyClaimResult,
  type VerifyGuard,
  type VerifyRefusal,
  type VerifySettleDomain,
  type VerifyTarget,
  verifyTargetKey,
  verifyTools,
} from '../protocol'
import { withFullView } from './full-view'
import type { InteractionSession, InteractionSettleResult } from './interaction-manager'
import {
  captureToolEvidence,
  hasTool,
  type ObservationRequest,
  startObservationWindow,
} from './observation-window'
import type { SessionUnavailable } from './session-routing'
import {
  claimFingerprint,
  InMemoryVerificationLedger,
  type LedgerEntry,
  ledgerView,
  type VerificationLedger,
} from './verification-ledger'
import {
  type ClearRead,
  type CohortRead,
  type RetainedTool,
  readBoundaries,
  readClear,
  readCohort,
  readEffects,
  readFreeze,
  readOverrides,
  readRefreshSequence,
  readRenderEvents,
  readRenderProbe,
  readRenders,
  readSimulatedQueries,
  readVisibility,
  type TargetEvidence,
  type TargetResolution,
  type VerificationEvidence,
} from './verify/evidence'
import {
  ACCEPTED_COLLECTION,
  environmentProblem,
  evaluateGuards,
  type GuardInputs,
  type Snapshot,
} from './verify/guards'
import { refuse } from './verify/outcome'
import { sourceMatches } from './verify/target'
import { decide, guardRefusal, UI_CAVEAT } from './verify/verdict'

type BeginInput = z.infer<typeof devtoolsVerifyBeginContract.input>

const MAX_ACTIVE_VERIFICATIONS = 20
const MAX_COMPLETED_VERIFICATIONS = 20
const MAX_RETAINED_EVIDENCE_BYTES = 2_000_000
const RENDER_PAGE_LIMIT = 200
const MAX_RENDER_PAGES = 25
const EVENT_READ_LIMIT = 500
const COHORT_LIMIT = 200
const RENDER_PROBE_ARGS = { sort: 'renders', limit: 1, appOnly: false, includeCursor: false }

/** Calls that would reset, pause or skew a recording window; refused on a document with an active verification. */
const WINDOW_TOOLS: ReadonlySet<string> = new Set([
  'react_clear_renders',
  'react_profile_start',
  'react_profile_stop',
  'devtools_interaction_begin',
])
/** Calls that make state come from Genie instead of the code; refused unless the verification allows overrides. */
const OVERRIDE_TOOLS: ReadonlySet<string> = new Set([
  'react_override_props',
  'react_override_hook_state',
  'react_override_context',
  'react_toggle_suspense_fallback',
  'react_force_error_boundary',
  'query_simulate_state',
])

const CORE_TOOLS = [
  'react_clear_renders',
  'react_profile_stop',
  'react_get_renders',
  'react_component_cohort',
  'react_refresh_events',
  'react_list_overrides',
]

const VERIFY_TOOL_NAMES = new Set(verifyTools.map((contract) => contract.name))

export function isVerifyTool(tool: string): boolean {
  return VERIFY_TOOL_NAMES.has(tool)
}

export type VerificationSession = InteractionSession

export type VerificationInvocation =
  | { ok: true; result: unknown; session?: VerificationSession }
  | (Omit<SessionUnavailable, 'errorCode'> & {
      ok: false
      errorCode: AgentErrorCode
      retryInMs?: number
      session?: VerificationSession
    })

interface VerificationManagerOptions<TSession extends VerificationSession> {
  resolveSession: (target?: string) => TSession | null
  sessionUnavailable: (target?: string) => SessionUnavailable
  isCurrentSession: (session: TSession) => boolean
  hasLogicalCollision: (session: TSession) => boolean
  isInteractionRecording: (sessionId: string) => boolean
  request: ObservationRequest<TSession>
  settle: (
    session: TSession,
    domains: VerifySettleDomain[],
    quietMs: number,
    timeoutMs: number,
  ) => Promise<InteractionSettleResult>
  ledger?: VerificationLedger
  wait?: (ms: number) => Promise<void>
}

interface BeginSnapshot extends Snapshot {
  clear: ClearRead | null
}

interface ActiveVerification<TSession extends VerificationSession> {
  verificationId: string
  input: BeginInput
  session: TSession
  startedAt: string
  expiresAt: string
  observationId: string
  startDocumentCommitId: number
  resolutions: Map<string, TargetResolution>
  begin: BeginSnapshot
  domains: VerifySettleDomain[]
  tailMs: number
  fingerprint: string
  retained: RetainedTool[]
  expiry: ReturnType<typeof setTimeout>
  ending?: Promise<VerificationInvocation>
}

interface StoredVerification {
  document: Record<string, unknown>
  evidence: { retained: RetainedTool[]; targets: Map<string, TargetEvidence> } | null
  guards: VerifyGuard[]
}

/** Owns verification windows: claims declared at begin, settle then freeze at end, a document lock in between, and a typed verdict. */
export class VerificationManager<TSession extends VerificationSession> {
  private readonly active = new Map<string, ActiveVerification<TSession>>()
  private readonly completed = new Map<string, StoredVerification>()
  private readonly starting = new Set<string>()
  private readonly ledger: VerificationLedger
  private readonly wait: (ms: number) => Promise<void>

  constructor(private readonly options: VerificationManagerOptions<TSession>) {
    this.ledger = options.ledger ?? new InMemoryVerificationLedger()
    this.wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  clear(): void {
    for (const verification of this.active.values()) clearTimeout(verification.expiry)
    this.active.clear()
    this.completed.clear()
    this.starting.clear()
  }

  /** The verification holding this document's lock when `tool` would disturb its window; undefined when the call may proceed. */
  lockFor(sessionId: string, tool: string): string | undefined {
    const locked = WINDOW_TOOLS.has(tool) || OVERRIDE_TOOLS.has(tool)
    if (!locked) return undefined
    for (const verification of this.active.values()) {
      if (verification.session.sessionId !== sessionId) continue
      if (OVERRIDE_TOOLS.has(tool) && verification.input.allowOverrides) return undefined
      return verification.verificationId
    }
    return this.starting.has(sessionId) ? 'starting' : undefined
  }

  async invoke(tool: string, args: unknown, target?: string): Promise<VerificationInvocation> {
    switch (tool) {
      case devtoolsVerifyBeginContract.name: {
        const parsed = devtoolsVerifyBeginContract.input.safeParse(args ?? {})
        if (!parsed.success)
          return invalidArguments(devtoolsVerifyBeginContract, args, parsed.error)
        return this.begin(parsed.data, target)
      }
      case devtoolsVerifyEndContract.name: {
        const parsed = devtoolsVerifyEndContract.input.safeParse(args ?? {})
        if (!parsed.success) return invalidArguments(devtoolsVerifyEndContract, args, parsed.error)
        return this.end(parsed.data.verificationId, target)
      }
      case devtoolsVerifyReadContract.name: {
        const parsed = devtoolsVerifyReadContract.input.safeParse(args ?? {})
        if (!parsed.success) return invalidArguments(devtoolsVerifyReadContract, args, parsed.error)
        return this.read(parsed.data)
      }
      case devtoolsVerifyAbortContract.name: {
        const parsed = devtoolsVerifyAbortContract.input.safeParse(args ?? {})
        if (!parsed.success)
          return invalidArguments(devtoolsVerifyAbortContract, args, parsed.error)
        return this.abort(parsed.data.verificationId)
      }
      default:
        throw new Error(`VerificationManager cannot handle ${JSON.stringify(tool)}.`)
    }
  }

  private async begin(input: BeginInput, target?: string): Promise<VerificationInvocation> {
    for (const [id, verification] of this.active) {
      if (!this.options.isCurrentSession(verification.session)) this.expire(id, 'session_changed')
    }
    const session = this.options.resolveSession(target)
    if (!session) return { ok: false, ...this.options.sessionUnavailable(target) }
    const holder = [...this.active.values()].find(
      (verification) => verification.session.sessionId === session.sessionId,
    )
    if (holder || this.starting.has(session.sessionId)) return lockedFailure(holder?.verificationId)
    if (this.options.isInteractionRecording(session.sessionId)) {
      return {
        ok: false,
        error:
          'An interaction is recording on this document; a verification would reset its window. Stop it with devtools_interaction_stop first.',
        errorCode: 'invalid-args',
        errorDetails: { hubCode: 'INTERACTION_ACTIVE' satisfies HubErrorCode },
        session,
      }
    }
    if (this.active.size + this.starting.size >= MAX_ACTIVE_VERIFICATIONS) {
      return {
        ok: false,
        error: `The hub already has ${MAX_ACTIVE_VERIFICATIONS} active verifications. End or abort one first.`,
        errorCode: 'tool-error',
        session,
      }
    }
    this.starting.add(session.sessionId)
    try {
      return { ...(await this.beginReserved(input, session)), session }
    } finally {
      this.starting.delete(session.sessionId)
    }
  }

  private async beginReserved(
    input: BeginInput,
    session: TSession,
  ): Promise<VerificationInvocation> {
    const verificationId = `vfy_${newId()}`
    const startedAt = new Date().toISOString()
    const retained: RetainedTool[] = []
    const capture = this.capturer(session, retained)
    const missing = new Set(
      input.claims.flatMap(toolsFor).filter((tool) => !hasTool(session, tool)),
    )
    const render = readRenderProbe(await capture('react_get_renders', RENDER_PROBE_ARGS))
    const targets = distinctTargets(input.claims)
    const resolutions = new Map<string, TargetResolution>()
    for (const target of targets) {
      resolutions.set(
        verifyTargetKey(target),
        resolveTarget(
          target,
          readCohort(await capture('react_component_cohort', cohortArgs(target)), target.component),
        ),
      )
    }
    const snapshot = await this.snapshot(
      session,
      capture,
      render,
      [...resolutions.values()].map((resolution) => (resolution.listed ? resolution.begin : null)),
    )
    const refusals = beginRefusals(input, missing, snapshot, resolutions)
    if (refusals.some((refusal) => refusal !== null)) {
      return this.refuseAtBegin({
        verificationId,
        input,
        session,
        startedAt,
        refusals,
        resolutions,
        snapshot,
      })
    }
    const window = await startObservationWindow(this.options.request, session, {
      components: [...new Set(targets.map((target) => target.component))],
      roots: [],
      budget: input.budget,
      lifecycle: input.lifecycle,
    })
    if (!window.ok) {
      return {
        ok: false,
        error: window.error ?? 'react_clear_renders failed while beginning the verification.',
        errorCode: window.errorCode ?? 'tool-error',
        errorDetails: window.errorDetails,
        retryInMs: window.retryInMs,
      }
    }
    const clear = readClear(window.result)
    if (!this.options.isCurrentSession(session) || !clear) {
      return {
        ok: false,
        error:
          'The app document changed, or returned no observation, while beginning the verification. Begin again on the current document.',
        errorCode: 'not-connected',
      }
    }
    const tailMs = defaultTailMs(input)
    const expiresAt = new Date(Date.now() + input.maxDurationMs).toISOString()
    const active: ActiveVerification<TSession> = {
      verificationId,
      input,
      session,
      startedAt,
      expiresAt,
      observationId: clear.observation.id,
      startDocumentCommitId: clear.documentCommitId,
      resolutions,
      begin: { ...snapshot, clear },
      domains: input.settle.domains ?? advertisedDomains(session),
      tailMs,
      fingerprint: fingerprintOf(input, resolutions, session),
      retained,
      expiry: setTimeout(() => this.expire(verificationId, 'window_lost'), input.maxDurationMs),
    }
    unref(active.expiry)
    this.active.set(verificationId, active)
    return {
      ok: true,
      result: {
        schemaVersion: VERIFY_SCHEMA_VERSION,
        kind: 'verification',
        verificationId,
        state: 'recording',
        name: input.name,
        session: sessionView(session),
        window: {
          observationId: active.observationId,
          startDocumentCommitId: active.startDocumentCommitId,
          domains: active.domains,
          quietMs: input.settle.quietMs,
          timeoutMs: input.settle.timeoutMs,
          tailMs,
        },
        targets: targets.map((target) => targetView(resolutions.get(verifyTargetKey(target)))),
        claims: input.claims.map((claim, position) => ({
          index: position + 1,
          text: formatVerifyClaim(claim),
        })),
        startedAt,
        expiresAt,
        request: requestView(input),
      },
    }
  }

  /** Captures evidence tools on one document and keeps every result for `verify show`. */
  private capturer(session: TSession, retained: RetainedTool[]) {
    return async (tool: string, args: unknown): Promise<RetainedTool> => {
      const evidence = await captureToolEvidence(this.options.request, session, tool, args)
      retained.push(evidence)
      return evidence
    }
  }

  private async snapshot(
    session: TSession,
    capture: (tool: string, args: unknown) => Promise<RetainedTool>,
    render: Snapshot['render'],
    targetCohorts: (CohortRead | null)[],
  ): Promise<Snapshot> {
    const overrides = readOverrides(await capture('react_list_overrides', {}))
    const simulated = hasTool(session, 'query_is_fetching')
      ? readSimulatedQueries(await capture('query_is_fetching', {}))
      : { simulatedQueries: [] }
    return {
      render,
      targetBundles: targetCohorts.map((cohort) =>
        cohort === null ? 'unknown' : cohort.rendererBundle,
      ),
      overrides: overrides
        ? {
            total: overrides.total,
            kinds: [...new Set(overrides.overrides.map((entry) => entry.kind))],
          }
        : null,
      simulatedQueries: simulated
        ? simulated.simulatedQueries.map((entry) => entry.queryHash)
        : null,
      refreshSequence: readRefreshSequence(
        await capture('react_refresh_events', { limit: 1, includeSource: false }),
      ),
      visibility: hasTool(session, 'browser_visibility')
        ? readVisibility(await capture('browser_visibility', {}))
        : null,
    }
  }

  private refuseAtBegin(context: {
    verificationId: string
    input: BeginInput
    session: TSession
    startedAt: string
    refusals: (VerifyRefusal | null)[]
    resolutions: Map<string, TargetResolution>
    snapshot: Snapshot
  }): VerificationInvocation {
    const { verificationId, input, session, refusals } = context
    const first = refusals.findIndex((refusal) => refusal !== null)
    const claims: VerifyClaimResult[] = input.claims.map((claim, position) => {
      const refusal =
        refusals[position] ??
        refuse(
          refusals[first]?.reason ?? 'evidence_unavailable',
          `Not evaluated: claim ${first + 1} was refused at begin, before any window started.`,
          {},
          refusals[first]?.fix,
        )
      return {
        index: position + 1,
        text: formatVerifyClaim(claim),
        claim,
        verdict: 'refused',
        observed: {},
        deciding: [],
        caveats: [],
        refusal,
      }
    })
    const fingerprint = fingerprintOf(input, context.resolutions, session)
    return this.store({
      verificationId,
      input,
      session,
      startedAt: context.startedAt,
      verdict: 'refused',
      claims,
      guards: [],
      window: null,
      fingerprint,
      refreshAtBegin: context.snapshot.refreshSequence,
      refreshAtEnd: context.snapshot.refreshSequence,
      evidence: null,
      caveats: [UI_CAVEAT],
      stage: 'begin',
    })
  }

  private async end(verificationId: string, target?: string): Promise<VerificationInvocation> {
    const stored = this.completed.get(verificationId)
    if (stored) return { ok: true, result: stored.document }
    const active = this.active.get(verificationId)
    if (!active) return unknownVerification(verificationId)
    if (target && this.options.isCurrentSession(active.session)) {
      const targeted = this.options.resolveSession(target)
      if (targeted && targeted.sessionId !== active.session.sessionId) {
        return {
          ok: false,
          error: `Verification ${verificationId} belongs to session ${JSON.stringify(active.session.sessionId)}, not ${JSON.stringify(targeted.sessionId)}.`,
          errorCode: 'invalid-args',
          errorDetails: { hubCode: 'INTERACTION_SESSION_MISMATCH' satisfies HubErrorCode },
        }
      }
    }
    active.ending ??= this.endActive(active).then((invocation) => ({
      ...invocation,
      session: active.session,
    }))
    return active.ending
  }

  private async endActive(active: ActiveVerification<TSession>): Promise<VerificationInvocation> {
    const { session, input } = active
    const retained = active.retained
    const capture = this.capturer(session, retained)
    if (!this.options.isCurrentSession(session)) {
      return this.storeWindowLoss(
        active,
        'session_changed',
        'The document closed or reloaded during the window.',
      )
    }
    const settle = await this.options.settle(
      session,
      active.domains,
      input.settle.quietMs,
      input.settle.timeoutMs,
    )
    const settledAt = settledCommit(settle)
    await this.wait(active.tailMs)
    const preFreeze = readRenderProbe(await capture('react_get_renders', RENDER_PROBE_ARGS))
    const freeze = readFreeze(await capture('react_profile_stop', {}))
    const frozenDocumentCommitId = freeze?.documentCommitId ?? preFreeze?.documentCommitId ?? null
    const settledDocumentCommitId =
      settledAt ?? frozenDocumentCommitId ?? active.startDocumentCommitId
    const through = frozenDocumentCommitId ?? Number.MAX_SAFE_INTEGER
    const targets = new Map<string, TargetEvidence>()
    const observationIds: (string | null)[] = []
    for (const target of distinctTargets(input.claims)) {
      const key = verifyTargetKey(target)
      const resolution = active.resolutions.get(key)
      if (!resolution) continue
      const kinds = new Set(
        input.claims
          .filter((claim) => {
            const claimed = claimTarget(claim)
            return claimed !== null && verifyTargetKey(claimed) === key
          })
          .map((claim) => claim.kind),
      )
      const renders = await this.readRenderPages(session, capture, target.component)
      const end = readCohort(
        await capture('react_component_cohort', cohortArgs(target)),
        target.component,
      )
      const events = kinds.has('render-causes')
        ? readRenderEvents(
            await capture(
              'react_render_causes',
              withFullView(session.tools, 'react_render_causes', {
                component: target.component,
                afterCommit: active.startDocumentCommitId,
                limit: EVENT_READ_LIMIT,
                appOnly: false,
              }),
            ),
            target.component,
            {
              observationId: active.observationId,
              afterDocumentCommitId: active.startDocumentCommitId,
              throughDocumentCommitId: through,
            },
          )
        : null
      const effects =
        kinds.has('effect-runs') || kinds.has('effect-settles')
          ? readEffects(
              await capture('react_effect_timeline', {
                component: target.component,
                afterDocumentCommitId: active.startDocumentCommitId,
                limit: EVENT_READ_LIMIT,
                appOnly: false,
              }),
              hasTool(session, 'react_effect_audit')
                ? await capture('react_effect_audit', {
                    component: target.component,
                    appOnly: false,
                    limit: 200,
                  })
                : undefined,
              target.component,
              {
                afterDocumentCommitId: active.startDocumentCommitId,
                throughDocumentCommitId: through,
              },
            )
          : null
      observationIds.push(
        renders?.observationId ?? null,
        end?.observationId ?? null,
        events?.observationId ?? null,
        effects?.observationId ?? null,
      )
      targets.set(key, { resolution, renders, events, effects, end })
    }
    const boundaries = input.claims.some((claim) => claim.kind === 'boundaries-clean')
      ? readBoundaries(
          await capture('react_error_state', {
            appOnly: false,
            includeSource: false,
            limit: 100,
            afterDocumentCommitId: active.startDocumentCommitId,
          }),
          through,
        )
      : null
    const endSnapshot = await this.snapshot(
      session,
      capture,
      preFreeze,
      [...targets.values()].map((target) => target.end),
    )
    const current = this.options.isCurrentSession(session)
    const settleOutcome = {
      outcome: settle.ok
        ? ('met' as const)
        : settle.reason === 'timeout'
          ? ('timed-out' as const)
          : ('failed' as const),
      ...(settle.reason === undefined
        ? {}
        : { reason: settle.reason === 'timeout' ? (settle.blocking ?? 'timeout') : settle.reason }),
      waitedMs: settle.waitedMs,
    }
    const guardInputs: GuardInputs = {
      observationId: active.observationId,
      startDocumentCommitId: active.startDocumentCommitId,
      frozenDocumentCommitId,
      allowOverrides: input.allowOverrides,
      settle: settleOutcome,
      session: {
        current,
        beginGeneration: session.documentGeneration ?? null,
        endGeneration: current ? (session.documentGeneration ?? null) : null,
        collision: this.options.hasLogicalCollision(session),
      },
      begin: active.begin,
      end: endSnapshot,
      preFreeze,
      freezeObservationId: freeze?.observation?.id ?? null,
      readObservationIds: observationIds,
      effectRefreshCommitsExcluded: Math.max(
        0,
        ...[...targets.values()].map((target) => target.effects?.refreshCommitsExcluded ?? 0),
      ),
    }
    const guards = evaluateGuards(guardInputs)
    const evidence: VerificationEvidence = {
      window: {
        observationId: active.observationId,
        startDocumentCommitId: active.startDocumentCommitId,
        settledDocumentCommitId,
        frozenDocumentCommitId: frozenDocumentCommitId ?? active.startDocumentCommitId,
        settle: {
          ...settleOutcome,
          quietMs: input.settle.quietMs,
          timeoutMs: input.settle.timeoutMs,
        },
        tailMs: active.tailMs,
        strictMode: active.begin.clear?.strictMode ?? 'unknown',
      },
      coverage: freeze?.coverage ?? null,
      targets,
      boundaries,
    }
    const decision = decide(input.claims, evidence, guards, session.app.url)
    const commits =
      frozenDocumentCommitId === null ? null : frozenDocumentCommitId - active.startDocumentCommitId
    return this.store({
      verificationId: active.verificationId,
      input,
      session,
      startedAt: active.startedAt,
      verdict: decision.verdict,
      claims: decision.claims,
      guards,
      window: {
        observationId: active.observationId,
        startDocumentCommitId: active.startDocumentCommitId,
        settledDocumentCommitId,
        frozenDocumentCommitId,
        commits,
        settle: {
          outcome: settleOutcome.outcome,
          ...(settleOutcome.reason === undefined ? {} : { reason: settleOutcome.reason }),
          quietMs: input.settle.quietMs,
          timeoutMs: input.settle.timeoutMs,
          waitedMs: settle.waitedMs,
          domains: Object.fromEntries(
            Object.entries(settle.domains).map(([domain, check]) => [
              domain,
              check?.status ?? 'pending',
            ]),
          ),
        },
        tail: {
          ms: active.tailMs,
          commits:
            frozenDocumentCommitId === null
              ? null
              : Math.max(0, frozenDocumentCommitId - settledDocumentCommitId),
        },
        environment: {
          bundle: preFreeze?.bundle ?? active.begin.render?.bundle ?? 'unknown',
          strictMode: active.begin.clear?.strictMode ?? 'unknown',
          renderCollection:
            preFreeze?.renderCollection ?? active.begin.render?.renderCollection ?? null,
          visibility: endSnapshot.visibility?.source ?? 'unavailable',
        },
        refusals: decision.windowRefusals.map((guard) => ({
          guard: guard.guard,
          refusal: guardRefusal(guard, session.app.url),
        })),
      },
      fingerprint: active.fingerprint,
      refreshAtBegin: active.begin.refreshSequence,
      refreshAtEnd: endSnapshot.refreshSequence,
      evidence: { retained, targets },
      caveats: [UI_CAVEAT, ...guardCaveats(guards)],
      stage: 'end',
    })
  }

  private async readRenderPages(
    session: TSession,
    capture: (tool: string, args: unknown) => Promise<RetainedTool>,
    component: string,
  ) {
    const first = await capture(
      'react_get_renders',
      withFullView(session.tools, 'react_get_renders', {
        ...(/[*?]/.test(component) ? { component } : { nameFilter: component }),
        limit: RENDER_PAGE_LIMIT,
        appOnly: false,
        sort: 'renders',
      }),
    )
    const pages = [readRenders(first, component)]
    let cursor = nextCursorOf(first)
    while (cursor && pages.length < MAX_RENDER_PAGES) {
      const page = await capture(
        'react_get_renders',
        withFullView(session.tools, 'react_get_renders', { cursor, limit: RENDER_PAGE_LIMIT }),
      )
      pages.push(readRenders(page, component))
      cursor = nextCursorOf(page)
    }
    if (pages.some((page) => page === null)) return null
    const read = pages.filter((page) => page !== null)
    const last = read.at(-1)
    if (!last) return null
    return {
      records: read.flatMap((page) => page.records),
      omittedByLimit: cursor ? Math.max(1, last.omittedByLimit) : 0,
      attributionStale: read.some((page) => page.attributionStale),
      observationId: last.observationId,
    }
  }

  private storeWindowLoss(
    active: ActiveVerification<TSession>,
    reason: Extract<RefusalReason, 'session_changed' | 'window_lost'>,
    message: string,
  ): VerificationInvocation {
    this.release(active)
    const refusal = refuse(reason, message)
    return this.store({
      verificationId: active.verificationId,
      input: active.input,
      session: active.session,
      startedAt: active.startedAt,
      verdict: 'refused',
      claims: active.input.claims.map((claim, position) => ({
        index: position + 1,
        text: formatVerifyClaim(claim),
        claim,
        verdict: 'refused',
        observed: {},
        deciding: [],
        caveats: [],
        refusal,
      })),
      guards: [],
      window: {
        observationId: active.observationId,
        startDocumentCommitId: active.startDocumentCommitId,
        refusals: [
          { guard: reason === 'session_changed' ? 'same-document' : 'window-alive', refusal },
        ],
      },
      fingerprint: active.fingerprint,
      refreshAtBegin: active.begin.refreshSequence,
      refreshAtEnd: null,
      evidence: null,
      caveats: [UI_CAVEAT],
      stage: 'end',
    })
  }

  private expire(verificationId: string, reason: 'window_lost' | 'session_changed'): void {
    const active = this.active.get(verificationId)
    if (!active || active.ending) return
    this.storeWindowLoss(
      active,
      reason,
      reason === 'window_lost'
        ? `The verification expired after ${active.input.maxDurationMs} ms without verify end, and its lock was released.`
        : 'The document closed or reloaded during the window.',
    )
  }

  private release(active: ActiveVerification<TSession>): void {
    clearTimeout(active.expiry)
    this.active.delete(active.verificationId)
  }

  private store(context: {
    verificationId: string
    input: BeginInput
    session: TSession
    startedAt: string
    verdict: Verdict
    claims: VerifyClaimResult[]
    guards: VerifyGuard[]
    window: Record<string, unknown> | null
    fingerprint: string
    refreshAtBegin: number | null
    refreshAtEnd: number | null
    evidence: StoredVerification['evidence']
    caveats: string[]
    stage: 'begin' | 'end'
  }): VerificationInvocation {
    const active = this.active.get(context.verificationId)
    if (active) this.release(active)
    const endedAt = new Date().toISOString()
    const entry: LedgerEntry = {
      verificationId: context.verificationId,
      fingerprint: context.fingerprint,
      scope: context.session.logicalSessionId ?? context.session.sessionId,
      verdict: context.verdict,
      reasons: context.claims.flatMap((claim) =>
        claim.refusal
          ? [claim.refusal.reason]
          : claim.inconclusive
            ? [claim.inconclusive.reason]
            : [],
      ),
      endedAt,
      sessionId: context.session.sessionId,
      documentGeneration: context.session.documentGeneration ?? null,
      refreshSequenceAtBegin: context.refreshAtBegin,
      refreshSequenceAtEnd: context.refreshAtEnd,
    }
    const ledger = ledgerView(this.ledger, entry)
    this.ledger.append(entry)
    const caveats = [
      ...context.caveats,
      ...(context.verdict === 'pass' && ledger.failsOnSameCode > 0
        ? ['passed-after-failures-on-same-code']
        : []),
    ]
    const retained =
      context.evidence && fitsRetention(context.evidence.retained) ? context.evidence : null
    const document = {
      schemaVersion: VERIFY_SCHEMA_VERSION,
      kind: 'verification',
      verificationId: context.verificationId,
      verdict: context.verdict,
      exitCode: VERDICT_EXIT_CODES[context.verdict],
      name: context.input.name,
      state: 'completed',
      stage: context.stage,
      session: sessionView(context.session),
      ...(context.window ? { window: context.window } : {}),
      claims: context.claims,
      caveats,
      ledger,
      evidence: {
        retained: retained !== null,
        tools: retained ? [...new Set(retained.retained.map((tool) => tool.tool))] : [],
      },
      startedAt: context.startedAt,
      endedAt,
      request: requestView(context.input),
    }
    this.completed.set(context.verificationId, {
      document,
      evidence: retained,
      guards: context.guards,
    })
    while (this.completed.size > MAX_COMPLETED_VERIFICATIONS) {
      const oldest = this.completed.keys().next().value
      if (oldest === undefined) break
      this.completed.delete(oldest)
    }
    return { ok: true, result: document }
  }

  private read(input: z.infer<typeof devtoolsVerifyReadContract.input>): VerificationInvocation {
    const stored = this.completed.get(input.verificationId)
    if (!stored) {
      const active = this.active.get(input.verificationId)
      if (!active) return unknownVerification(input.verificationId)
      return {
        ok: true,
        result: {
          schemaVersion: VERIFY_SCHEMA_VERSION,
          kind: 'verification',
          verificationId: active.verificationId,
          state: 'recording',
          name: active.input.name,
          session: sessionView(active.session),
          startedAt: active.startedAt,
          expiresAt: active.expiresAt,
          request: requestView(active.input),
        },
      }
    }
    if (input.section === 'guards') {
      return {
        ok: true,
        result: { verificationId: input.verificationId, section: 'guards', guards: stored.guards },
      }
    }
    if (input.section?.startsWith('raw:')) {
      const tool = input.section.slice(4)
      if (!stored.evidence) return notRetained(input.verificationId)
      return {
        ok: true,
        result: {
          verificationId: input.verificationId,
          section: input.section,
          results: stored.evidence.retained.filter((entry) => entry.tool === tool),
        },
      }
    }
    if (input.claim !== undefined) {
      const claims = stored.document.claims as VerifyClaimResult[]
      const claim = claims.find((entry) => entry.index === input.claim)
      if (!claim) {
        return {
          ok: false,
          error: `Verification ${input.verificationId} has ${claims.length} claims; choose 1 to ${claims.length}.`,
          errorCode: 'invalid-args',
        }
      }
      const target = claimTarget(claim.claim)
      const evidence = target ? stored.evidence?.targets.get(verifyTargetKey(target)) : undefined
      return {
        ok: true,
        result: {
          verificationId: input.verificationId,
          verdict: stored.document.verdict,
          claim,
          evidence: evidence ? claimEvidence(evidence) : null,
          evidenceRetained: stored.evidence !== null,
        },
      }
    }
    return { ok: true, result: stored.document }
  }

  private abort(verificationId: string): VerificationInvocation {
    const stored = this.completed.get(verificationId)
    if (stored) return { ok: true, result: stored.document }
    const active = this.active.get(verificationId)
    if (!active) return unknownVerification(verificationId)
    if (active.ending) {
      return {
        ok: false,
        error: `Verification ${verificationId} is already ending; wait for devtools_verify_end to return its verdict.`,
        errorCode: 'invalid-args',
        errorDetails: { hubCode: 'VERIFICATION_ACTIVE' satisfies HubErrorCode, verificationId },
      }
    }
    this.release(active)
    const document = {
      schemaVersion: VERIFY_SCHEMA_VERSION,
      kind: 'verification',
      verificationId,
      state: 'aborted',
      name: active.input.name,
      session: sessionView(active.session),
      startedAt: active.startedAt,
      endedAt: new Date().toISOString(),
      request: requestView(active.input),
    }
    this.completed.set(verificationId, { document, evidence: null, guards: [] })
    return { ok: true, result: document, session: active.session }
  }
}

function toolsFor(claim: VerifyClaim): string[] {
  if (claim.kind === 'render-causes') return [...CORE_TOOLS, 'react_render_causes']
  if (claim.kind === 'effect-runs' || claim.kind === 'effect-settles')
    return [...CORE_TOOLS, 'react_effect_timeline']
  if (claim.kind === 'boundaries-clean') return [...CORE_TOOLS, 'react_error_state']
  return CORE_TOOLS
}

/** Refusals that are already certain before the window starts, so the agent does not drive the UI for nothing. */
function beginRefusals(
  input: BeginInput,
  missing: ReadonlySet<string>,
  snapshot: Snapshot,
  resolutions: Map<string, TargetResolution>,
): (VerifyRefusal | null)[] {
  const environmentMessage = environmentProblem(snapshot)
  const environment =
    snapshot.render === null
      ? refuse(
          'evidence_unavailable',
          'react_get_renders could not be read, so the environment is unknown.',
          {},
          { action: 'check-setup' },
        )
      : environmentMessage
        ? refuse(
            'unsupported_environment',
            environmentMessage,
            { bundle: snapshot.render.bundle, targetBundles: snapshot.targetBundles },
            { action: 'check-setup' },
          )
        : !ACCEPTED_COLLECTION(snapshot.render.renderCollection)
          ? refuse(
              'unsupported_environment',
              `Render collection cannot observe commits: ${snapshot.render.renderCollection}.`,
              { renderCollection: snapshot.render.renderCollection },
              { action: 'check-setup' },
            )
          : null
  const overrides =
    !input.allowOverrides &&
    ((snapshot.overrides?.total ?? 0) > 0 || (snapshot.simulatedQueries?.length ?? 0) > 0)
      ? refuse(
          'override_active',
          'Overrides or simulated Query state are active, so the window would observe Genie, not the code.',
          {
            overrides: snapshot.overrides?.total ?? null,
            simulatedQueries: snapshot.simulatedQueries ?? null,
          },
          { action: 'reset-overrides' },
        )
      : null
  return input.claims.map((claim) => {
    const absent = toolsFor(claim).filter((tool) => missing.has(tool))
    if (absent.length > 0) {
      return refuse(
        'capability_unavailable',
        `The app does not advertise ${absent.join(', ')}, which this claim needs.`,
        { missingTools: absent },
        { action: 'check-setup' },
      )
    }
    if (environment) return environment
    if (overrides) return overrides
    if (claim.kind === 'render-causes') {
      const inferred = claim.allow.filter((cause) => ALWAYS_INFERRED_CAUSE_KINDS.has(cause.kind))
      if (inferred.length > 0) {
        return refuse(
          'evidence_inferred',
          `${inferred.map((cause) => cause.kind).join(' and ')} causes are only ever inferred, so no run could pass this claim.`,
          { inferredCauses: inferred.map((cause) => cause.kind) },
          { action: 'change-claim' },
        )
      }
    }
    const target = claimTarget(claim)
    const resolution = target ? resolutions.get(verifyTargetKey(target)) : undefined
    if (target && !resolution?.listed) {
      return refuse(
        'evidence_unavailable',
        `react_component_cohort could not list ${target.component} instances.`,
        {},
        { action: 'check-setup' },
      )
    }
    if (resolution?.status === 'ambiguous') {
      return refuse(
        'target_ambiguous',
        `${resolution.target.component} names components in ${resolution.candidates.length} source files; add @<file> to the target.`,
        { candidates: resolution.candidates },
        { action: 'list-target-sources', component: resolution.target.component },
      )
    }
    return null
  })
}

function resolveTarget(target: VerifyTarget, cohort: CohortRead | null): TargetResolution {
  const begin = cohort ?? {
    instances: [],
    omittedByLimit: 0,
    observationId: null,
    rendererBundle: null,
  }
  const named = begin.instances.filter(
    (instance) => target.key === undefined || instance.key === target.key,
  )
  const files = [
    ...new Set(
      named.map((instance) => instance.sourceFile).filter((file): file is string => file !== null),
    ),
  ].sort()
  const matching = named.filter((instance) => sourceMatches(instance.sourceFile, target.source))
  const sourceFiles = [
    ...new Set(
      matching
        .map((instance) => instance.sourceFile)
        .filter((file): file is string => file !== null),
    ),
  ]
  const ambiguous = target.source === undefined ? files.length > 1 : sourceFiles.length > 1
  return {
    target,
    status: ambiguous ? 'ambiguous' : matching.length > 0 ? 'resolved' : 'pending',
    sourceFile: sourceFiles.length === 1 ? (sourceFiles[0] ?? null) : null,
    candidates: target.source === undefined ? files : sourceFiles,
    unresolvedSources: named.filter((instance) => instance.sourceFile === null).length,
    begin,
    listed: cohort !== null,
  }
}

/** The claims, their resolved sources and the page: what a later run must share for its history to count. */
function fingerprintOf(
  input: BeginInput,
  resolutions: ReadonlyMap<string, TargetResolution>,
  session: VerificationSession,
): string {
  return claimFingerprint({
    claims: input.claims,
    targetSources: distinctTargets(input.claims).map(
      (target) => resolutions.get(verifyTargetKey(target))?.sourceFile ?? null,
    ),
    url: session.app.url,
  })
}

function distinctTargets(claims: readonly VerifyClaim[]): VerifyTarget[] {
  const seen = new Map<string, VerifyTarget>()
  for (const claim of claims) {
    const target = claimTarget(claim)
    if (target) seen.set(verifyTargetKey(target), target)
  }
  return [...seen.values()]
}

function advertisedDomains(session: VerificationSession): VerifySettleDomain[] {
  return [
    'react',
    ...(hasTool(session, 'query_is_fetching') ? (['query'] as const) : []),
    ...(hasTool(session, 'router_get_state') ? (['router'] as const) : []),
  ]
}

function defaultTailMs(input: BeginInput): number {
  if (input.tailMs !== undefined) return input.tailMs
  const quiet = input.settle.quietMs
  return input.claims.some((claim) => claim.kind === 'effect-settles')
    ? Math.max(2 * quiet, 2_000)
    : Math.max(quiet, 500)
}

function settledCommit(settle: InteractionSettleResult): number | null {
  const observed = settle.domains.react?.lastObserved
  if (typeof observed !== 'object' || observed === null) return null
  const commit = (observed as { documentCommitId?: unknown }).documentCommitId
  return typeof commit === 'number' && Number.isInteger(commit) ? commit : null
}

function cohortArgs(target: VerifyTarget) {
  return {
    component: target.component,
    exact: true,
    appOnly: false,
    limit: COHORT_LIMIT,
    view: 'full',
  }
}

function nextCursorOf(tool: RetainedTool): string | null {
  const result = tool.result as { nextCursor?: unknown } | undefined
  return typeof result?.nextCursor === 'string' ? result.nextCursor : null
}

function fitsRetention(retained: RetainedTool[]): boolean {
  return Buffer.byteLength(JSON.stringify(retained), 'utf8') <= MAX_RETAINED_EVIDENCE_BYTES
}

function guardCaveats(guards: readonly VerifyGuard[]): string[] {
  return guards.flatMap((guard) => {
    if (guard.guard === 'document-visible' && guard.status === 'unobserved')
      return ['visibility-unobserved']
    if (guard.guard === 'no-overrides' && guard.status === 'caveat') return ['overrides-active']
    if (guard.guard === 'settled' && guard.status === 'caveat') return ['not-settled']
    return []
  })
}

function sessionView(session: VerificationSession) {
  return {
    sessionId: session.sessionId,
    ...(session.logicalSessionId === undefined
      ? {}
      : { logicalSessionId: session.logicalSessionId }),
    ...(session.documentGeneration === undefined
      ? {}
      : { documentGeneration: session.documentGeneration }),
    ...(session.sessionName === undefined ? {} : { sessionName: session.sessionName }),
    ...(session.app.url === undefined ? {} : { url: session.app.url }),
  }
}

function requestView(input: BeginInput) {
  return {
    budget: input.budget,
    settle: input.settle,
    ...(input.tailMs === undefined ? {} : { tailMs: input.tailMs }),
    maxDurationMs: input.maxDurationMs,
    allowOverrides: input.allowOverrides,
  }
}

function targetView(resolution: TargetResolution | undefined) {
  if (!resolution) return null
  return {
    target: resolution.target,
    status: resolution.status,
    instances: resolution.begin.instances.filter(
      (instance) =>
        (resolution.target.key === undefined || instance.key === resolution.target.key) &&
        sourceMatches(instance.sourceFile, resolution.target.source),
    ).length,
    ...(resolution.sourceFile === null ? {} : { source: resolution.sourceFile }),
    ...(resolution.unresolvedSources > 0
      ? { unresolvedSources: resolution.unresolvedSources }
      : {}),
  }
}

function claimEvidence(evidence: TargetEvidence) {
  return {
    records: evidence.renders?.records ?? null,
    events: evidence.events?.events ?? null,
    effects: evidence.effects?.events ?? null,
    beginInstances: evidence.resolution.begin.instances,
    endInstances: evidence.end?.instances ?? null,
  }
}

function lockedFailure(verificationId: string | undefined): VerificationInvocation {
  return {
    ok: false,
    error: verificationId
      ? `Verification ${verificationId} is recording on this document. End it with devtools_verify_end, or release it with devtools_verify_abort.`
      : 'A verification is starting on this document; wait for devtools_verify_begin to return.',
    errorCode: 'invalid-args',
    errorDetails: {
      hubCode: 'VERIFICATION_ACTIVE' satisfies HubErrorCode,
      ...(verificationId ? { verificationId } : {}),
    },
  }
}

function unknownVerification(verificationId: string): VerificationInvocation {
  return {
    ok: false,
    error: `The hub holds no verification ${verificationId}: it expired, was evicted, or the hub restarted. Begin a new one.`,
    errorCode: 'invalid-args',
    errorDetails: { hubCode: 'VERIFICATION_UNKNOWN' satisfies HubErrorCode },
  }
}

function notRetained(verificationId: string): VerificationInvocation {
  return {
    ok: false,
    error: `Verification ${verificationId} kept its verdict, but its raw evidence was not retained.`,
    errorCode: 'invalid-args',
  }
}

function unref(timer: ReturnType<typeof setTimeout>): void {
  if (typeof timer === 'object' && timer !== null && 'unref' in timer) timer.unref()
}

function invalidArguments(
  contract: AgentToolContract,
  args: unknown,
  error: { issues: Parameters<typeof toolValidationFailure>[1] },
): VerificationInvocation {
  return {
    ok: false,
    ...toolValidationFailure(contract.name, error.issues, {
      input: contract.input,
      args: args ?? {},
    }),
    errorCode: 'invalid-args',
  }
}
