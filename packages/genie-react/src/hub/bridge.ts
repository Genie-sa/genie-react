import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import type { WebSocket } from 'ws'
import {
  type AgentErrorCode,
  type AgentMessage,
  type AgentToolContract,
  type AppInfo,
  type AppMessage,
  agentMessageSchema,
  appMessageSchema,
  type BusyTelemetry,
  type ConnectionRole,
  DEFAULT_REQUEST_TIMEOUT_MS,
  decodeFrame,
  devtoolsStatusContract,
  devtoolsWaitContract,
  encodeMessage,
  GENIE_WS_PATH,
  type HubErrorCode,
  metaToolDescriptors,
  newId,
  reactQuiesceContract,
  type SessionSummary,
  type ToolDescriptor,
  type ToolErrorDetails,
  toolValidationFailure,
  WAIT_CONDITIONS,
  type WaitCondition,
  type WaitDomain,
} from '../protocol'
import { CaptureManager, isCaptureTool } from './capture-manager'
import {
  InteractionManager,
  type InteractionSettleResult,
  isInteractionTool,
} from './interaction-manager'
import {
  answeringSessionOf,
  type RoutableDocument,
  type SessionResolution,
  type SessionUnavailable,
  tabKeyOf,
  tabLabel,
} from './session-routing'
import {
  rejectUpgrade,
  UpgradePolicy,
  type UpgradePolicyOptions,
  type UpgradeVerdict,
} from './upgrade-policy'
import { matchesOf, parseQueryList, queryStateOf, routerStateOf } from './wire-guards'
import { ws } from './ws-env'

type BridgeLogLevel = 'info' | 'warn' | 'error'
type BridgeLogger = (level: BridgeLogLevel, message: string, meta?: unknown) => void

export interface GenieBridgeOptions extends UpgradePolicyOptions {
  requestTimeoutMs?: number
  /** WS ping cadence used to reap half-open connections (crashed tabs); a peer is dropped after two silent intervals. */
  heartbeatIntervalMs?: number
  /** When a still-pending request is checked for a busy (main-thread-blocked) app; production default 2000ms. */
  busyProbeMs?: number
  /** How stale an app heartbeat must be at probe time to fast-fail as busy; production default 2500ms. */
  busyHeartbeatGapMs?: number
  /** Silence after which a heartbeat-capable session reads as a dead tab context and loses default routing; production default 15000ms. */
  sessionStaleMs?: number
  /** Grace before two documents claiming one logical id and generation are treated as a cloned tab and auto-forked. */
  logicalCollisionGraceMs?: number
  /** How long a document replaced by a newer generation of its tab may prove it is still live (a cloned tab) before its socket is closed; production default 2500ms. */
  supersededLivenessMs?: number
  /** Silence after which an older document of a tab is superseded at once by a newer generation; one heard from more recently first gets `supersededLivenessMs` to prove it is a live duplicate. Production default 1500ms. */
  supersedeSilenceMs?: number
  /** How long the default target waits for its tab to reconnect after a reload before another tab may become the default; production default 5000ms. */
  targetReloadGraceMs?: number
  logger?: BridgeLogger
}

interface BridgeStatus {
  connected: boolean
  ready: boolean
  sessionId: string | null
  app: AppInfo | null
  domains: string[]
  tools: ToolDescriptor[]
  sessions: SessionSummary[]
  warnings: string[]
}

interface AppSession {
  socket: WebSocket
  sessionId: string
  logicalSessionId?: string
  documentGeneration?: number
  sessionName?: string
  predecessorSessionId?: string
  successorSessionId?: string
  forkedFromLogicalSessionId?: string
  app: AppInfo
  capabilities: string[]
  tools: ToolDescriptor[]
  connectedAt: number
  readyAt?: number
  /** Last `app/heartbeat` receipt; undefined until the first beat, which is how legacy (never-beating) clients opt out of busy fast-fail. */
  lastHeartbeatAt?: number
}

type AppHello = Extract<AppMessage, { kind: 'app/hello' }>

interface SupersededDocument {
  session: AppSession
  timer: ReturnType<typeof setTimeout>
}

interface LatestDocument {
  sessionId: string
  documentGeneration?: number
  connectedAt: number
}

interface Connection {
  socket: WebSocket
  role: ConnectionRole
}

interface AppResponse {
  ok: boolean
  result?: unknown
  error?: string
  errorCode?: AgentErrorCode
  errorDetails?: ToolErrorDetails
  retryInMs?: number
  busyTelemetry?: BusyTelemetry
  /** The document the request was routed to; absent when routing itself failed. */
  session?: AppSession
  retargeted?: boolean
}

interface PendingRequest {
  settle: (response: AppResponse) => void
  timer: ReturnType<typeof setTimeout>
  busyTimer: ReturnType<typeof setTimeout> | null
  sessionId: string
  /** The tool is not read-only, so losing its document mid-call leaves its side effects unknown. */
  mayHaveCompleted: boolean
}

interface DefaultTabReload {
  timer: ReturnType<typeof setTimeout>
  since: number
}

type InterruptionCode = Extract<HubErrorCode, 'SESSION_DISCONNECTED' | 'SESSION_SUPERSEDED'>

const POLL_INTERVAL_MS = 150
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000

// A request still pending this long with a stale heartbeat is fast-failed as busy, far short of the 20s full timeout.
const BUSY_PROBE_MS = 2_000
// Above the ~1s heartbeat cadence with margin for a tool that itself blocks the thread a while — only a longer silence reads as busy.
const BUSY_HEARTBEAT_GAP_MS = 3_500
const BUSY_RETRY_MS = 500
// Well past any legitimate block: a session silent this long is a dead tab context, not a busy one.
const SESSION_STALE_MS = 15_000
const MIN_REQUEST_TIMEOUT_MS = 1_000
const MAX_REQUEST_TIMEOUT_MS = 120_000
const MAX_SESSION_SUCCESSORS = 256
const LOGICAL_COLLISION_GRACE_MS = 750
// Spans two ~1s heartbeats, so a superseded document that is really a live cloned tab can prove it before eviction.
const SUPERSEDED_LIVENESS_MS = 2_500
const TARGET_RELOAD_GRACE_MS = 5_000
// One ~1s app heartbeat plus jitter: an older document quieter than this is frozen or unloading, not a live duplicate.
const SUPERSEDE_SILENCE_MS = 1_500

interface WaitInput {
  condition: WaitCondition
  name?: string
  queryHash?: string
  queryKey?: unknown[]
  domains: WaitDomain[]
  quietMs: number
  deadline?: number
}

interface WaitDomainCheck {
  status: 'met' | 'pending' | 'failed' | 'unsupported'
  reason?: string
  lastObserved?: unknown
}

/** A tab target resolved on every poll, or one exact document that fails the wait once it is gone. */
type WaitTarget = string | AppSession | undefined

const DOCUMENT_GONE_REASON =
  'The app document disconnected (reload, navigation, or closed tab) before it settled.'

interface WaitCheck {
  /** The document this check polled; undefined when the check did not resolve one. */
  session?: AppSession | null
  state: 'met' | 'pending' | 'failed'
  reason?: string
  query?: { queryHash: string; queryKey: unknown }
  lastObserved?: Record<string, unknown>
  domains?: Partial<Record<WaitDomain, WaitDomainCheck>>
}

interface WaitPollState {
  reactSession: AppSession | null
  reactCommit: number | null
  reactChangedAt: number
  frameCheck: WaitDomainCheck | null
}

function queryIdentity(
  query: Record<string, unknown>,
): { queryHash: string; queryKey: unknown } | undefined {
  if (typeof query.queryHash !== 'string' || !('queryKey' in query)) return undefined
  return { queryHash: query.queryHash, queryKey: query.queryKey }
}

function legacyQueryMatches(query: Record<string, unknown>, name: string): boolean {
  if (query.queryHash === name) return true
  let expectedKey: unknown = [name]
  try {
    const parsed: unknown = JSON.parse(name)
    if (Array.isArray(parsed)) expectedKey = parsed
  } catch {
    // A plain name means the exact one-item key [name].
  }
  return JSON.stringify(query.queryKey) === JSON.stringify(expectedKey)
}

/** A session's full catalog: its advertised tools plus the bridge-answered meta tools, so listings and toolCount agree. */
function catalogOf(session: AppSession | null | undefined): ToolDescriptor[] {
  return [...(session?.tools ?? []), ...metaToolDescriptors]
}
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

function toolDescriptor(session: AppSession, tool: string): ToolDescriptor | undefined {
  return catalogOf(session).find((descriptor) => descriptor.name === tool)
}

function compareSessionRecency(a: AppSession, b: AppSession): number {
  if (a.logicalSessionId && a.logicalSessionId === b.logicalSessionId) {
    const generationOrder = (b.documentGeneration ?? 0) - (a.documentGeneration ?? 0)
    if (generationOrder !== 0) return generationOrder
  }
  return b.connectedAt - a.connectedAt
}

// Keeps a leaked bridge from pinning the process; Node-only, but typed against a possible DOM `number` timer.
function unrefTimer(timer: ReturnType<typeof setInterval>): void {
  if (typeof timer === 'object' && timer !== null && 'unref' in timer) timer.unref()
}

/** The hub: a `noServer` WSS mountable on Vite's HTTP server; calls route to the targeted tab's newest document (explicit `agent/invoke.sessionId`, else the only or already-targeted tab), and it answers the `devtools_status`/`devtools_wait` meta tools itself. */
export class GenieBridge {
  private readonly wss = new ws.WebSocketServer({ noServer: true })
  private readonly agents = new Set<WebSocket>()
  private readonly pending = new Map<string, PendingRequest>()
  private readonly connectionWaiters = new Set<() => void>()
  private readonly requestTimeoutMs: number
  private readonly busyProbeMs: number
  private readonly busyHeartbeatGapMs: number
  private readonly sessionStaleMs: number
  private readonly logicalCollisionGraceMs: number
  private readonly supersededLivenessMs: number
  private readonly targetReloadGraceMs: number
  private readonly supersedeSilenceMs: number
  private readonly log: BridgeLogger
  /** Routable documents: at most one per tab except during a same-generation clone collision. */
  private readonly apps = new Map<string, AppSession>()
  /** Documents replaced by a newer generation of their tab; never routed or listed, closed unless they prove they are a live clone. */
  private readonly superseded = new Map<string, SupersededDocument>()
  /** Physical document id → its replacement; bounded so stale shell pins can survive ordinary reloads. */
  private readonly sessionSuccessors = new Map<string, string>()
  /** Logical tab id → latest document, retained after socket close so close-before-hello reloads keep lineage. */
  private readonly latestDocuments = new Map<string, LatestDocument>()
  private readonly logicalCollisionTimers = new Map<string, ReturnType<typeof setTimeout>>()
  /** Newer generations waiting for an older, recently live document of their tab to prove it is a duplicate; routing keeps the older one meanwhile. */
  private readonly generationRaces = new Set<string>()
  private readonly captures: CaptureManager<AppSession>
  private readonly interactions: InteractionManager<AppSession>
  private readonly connections = new Set<WebSocket>()
  private readonly responsiveSockets = new WeakSet<WebSocket>()
  private readonly heartbeat: ReturnType<typeof setInterval>
  private readonly upgradePolicy: UpgradePolicy
  private readonly appOrigins = new WeakMap<
    WebSocket,
    Pick<SessionSummary, 'origin' | 'originUnverified'>
  >()
  /** Tab key untargeted calls stick to, so opening another tab never silently retargets them. */
  private defaultTabKey: string | null = null
  /** Pending while the default tab's last document is gone but may still reconnect from a reload. */
  private defaultTabReload: DefaultTabReload | null = null

  constructor(options: GenieBridgeOptions = {}) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    this.busyProbeMs = options.busyProbeMs ?? BUSY_PROBE_MS
    this.busyHeartbeatGapMs = options.busyHeartbeatGapMs ?? BUSY_HEARTBEAT_GAP_MS
    this.sessionStaleMs = options.sessionStaleMs ?? SESSION_STALE_MS
    this.logicalCollisionGraceMs = Math.max(
      0,
      options.logicalCollisionGraceMs ?? LOGICAL_COLLISION_GRACE_MS,
    )
    this.supersededLivenessMs = options.supersededLivenessMs ?? SUPERSEDED_LIVENESS_MS
    this.targetReloadGraceMs = options.targetReloadGraceMs ?? TARGET_RELOAD_GRACE_MS
    this.supersedeSilenceMs = options.supersedeSilenceMs ?? SUPERSEDE_SILENCE_MS
    this.log = options.logger ?? (() => {})
    this.upgradePolicy = new UpgradePolicy(options)
    this.captures = new CaptureManager({
      resolveSession: (target) => this.targetSession(target),
      sessionUnavailable: (target) => this.sessionUnavailable(target),
      isCurrentSession: (session) => this.isCurrent(session),
      request: (session, tool, args) => this.appRequestForSession(tool, args, session),
    })
    this.interactions = new InteractionManager({
      resolveSession: (target) => this.targetSession(target),
      sessionUnavailable: (target) => this.sessionUnavailable(target),
      isCurrentSession: (session) => this.isCurrent(session),
      request: (session, tool, args) => this.appRequestForSession(tool, args, session),
      settle: (session, domains, quietMs, timeoutMs) =>
        this.settleInteraction(session, domains, quietMs, timeoutMs),
    })
    const interval = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS
    this.heartbeat = setInterval(() => this.sweepDeadConnections(), interval)
    unrefTimer(this.heartbeat)
  }

  /** The secret agents present to connect; publish it only through the private token store. */
  get agentToken(): string {
    return this.upgradePolicy.agentToken
  }

  /** Returns `false` for non-{@link GENIE_WS_PATH} upgrades so another listener (e.g. Vite HMR) can handle them. */
  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): boolean {
    if (new URL(request.url ?? '/', 'http://localhost').pathname !== GENIE_WS_PATH) return false
    const verdict = this.upgradePolicy.authorize(request)
    if (!verdict.ok) {
      this.log('warn', `rejected connection: ${verdict.reason}`)
      rejectUpgrade(socket, verdict.status, verdict.reason)
      return true
    }
    this.wss.handleUpgrade(request, socket, head, (ws) => this.onConnection(ws, verdict))
    return true
  }

  getStatus(): BridgeStatus {
    const current = this.peekTarget()
    return {
      connected: this.apps.size > 0,
      ready: current?.readyAt !== undefined,
      sessionId: current?.sessionId ?? null,
      app: current?.app ?? null,
      domains: current?.capabilities ?? [],
      tools: catalogOf(current),
      sessions: this.sessionSummaries(),
      warnings: this.statusWarnings(),
    }
  }

  close(): void {
    clearInterval(this.heartbeat)
    for (const pending of this.pending.values()) this.clearPendingTimers(pending)
    this.pending.clear()
    this.sessionSuccessors.clear()
    this.latestDocuments.clear()
    for (const timer of this.logicalCollisionTimers.values()) clearTimeout(timer)
    this.logicalCollisionTimers.clear()
    this.generationRaces.clear()
    this.clearDefaultTabReload()
    this.captures.clear()
    this.interactions.clear()
    // terminate(), not close(): a graceful close handshake with a half-open peer blocks shutdown on ws's 30s timeout.
    for (const socket of this.agents) socket.terminate()
    for (const session of this.apps.values()) session.socket.terminate()
    for (const { session, timer } of this.superseded.values()) {
      clearTimeout(timer)
      session.socket.terminate()
    }
    this.superseded.clear()
    this.wss.close()
  }

  // A heartbeat-capable session gone this quiet is a frozen or hung tab — default calls prefer a live tab while it stays silent.
  private staleMsOf(session: AppSession): number | null {
    if (session.lastHeartbeatAt === undefined) return null
    const gap = Date.now() - session.lastHeartbeatAt
    return gap > this.sessionStaleMs ? gap : null
  }

  private tabDocuments(): Map<string, AppSession[]> {
    const tabs = new Map<string, AppSession[]>()
    for (const session of this.apps.values()) {
      const key = tabKeyOf(session)
      const documents = tabs.get(key)
      if (documents) documents.push(session)
      else tabs.set(key, [session])
    }
    return tabs
  }

  /** Resolves an explicit target, or the default tab; `pin` makes an unambiguous default sticky for later untargeted calls. */
  private resolveTarget(target?: string, pin = true): SessionResolution<AppSession> {
    if (target) {
      const session = this.resolveSession(target)
      return session ? { ok: true, session } : { ok: false, ...this.unknownSession(target) }
    }
    const tabs = this.tabDocuments()
    const pinned = this.defaultTabKey === null ? undefined : tabs.get(this.defaultTabKey)
    if (this.defaultTabKey !== null && pinned) return this.tabDocument(this.defaultTabKey, pinned)
    const live = [...tabs]
    const fresh = live.filter(([, documents]) =>
      documents.some((session) => this.staleMsOf(session) === null),
    )
    const candidates = fresh.length > 0 ? fresh : live
    const reload = this.defaultTabReload
    if (reload && candidates.length !== 1) {
      return {
        ok: false,
        errorCode: 'not-connected',
        errorDetails: { hubCode: 'SESSION_RELOADING' },
        retryInMs: BUSY_RETRY_MS,
        error: `The targeted tab ${JSON.stringify(this.defaultTabKey)} is reconnecting after a reload; retry shortly, or target another tab explicitly.`,
      }
    }
    const [only] = candidates
    if (!only) {
      return {
        ok: false,
        errorCode: 'not-connected',
        error: 'No app connected. Start the dev server and open the app in a browser.',
      }
    }
    if (candidates.length > 1) {
      return {
        ok: false,
        errorCode: 'unknown-session',
        errorDetails: { hubCode: 'SESSION_AMBIGUOUS' },
        error: `${candidates.length} app tabs are connected and none is targeted: ${candidates
          .map(([, documents]) => documents.map(tabLabel).join(' / '))
          .join(
            '; ',
          )}. Pass a session name, logical id or session id as the target (CLI: --session <target> or GENIE_SESSION).`,
      }
    }
    const [key, documents] = only
    const retargeted = this.defaultTabKey !== null
    // A tab that connected after the default left replaces it (a Metro reload, a fresh tab); one already open only answers while the default may still reconnect.
    const replacement =
      !reload || documents.every((document) => document.connectedAt >= reload.since)
    if (pin && replacement) {
      this.defaultTabKey = key
      this.clearDefaultTabReload()
    }
    const resolution = this.tabDocument(key, documents)
    return resolution.ok && retargeted ? { ...resolution, retargeted } : resolution
  }

  private tabDocument(key: string, documents: AppSession[]): SessionResolution<AppSession> {
    const settled = documents.filter((session) => !this.generationRaces.has(session.sessionId))
    const [session] = settled
    if (!session || settled.length > 1) return { ok: false, ...this.unknownSession(key) }
    if (this.staleMsOf(session) === null) return { ok: true, session }
    // A frozen or hung tab keeps the target, but the one live tab may answer meanwhile.
    const [live, ...others] = [...this.apps.values()].filter(
      (candidate) => this.staleMsOf(candidate) === null,
    )
    return live && others.length === 0
      ? { ok: true, session: live, retargeted: true }
      : { ok: true, session }
  }

  private isCurrent(session: AppSession): boolean {
    return this.apps.get(session.sessionId)?.socket === session.socket
  }

  private waitSession(target: WaitTarget): AppSession | null {
    if (typeof target !== 'object') return this.targetSession(target)
    return this.isCurrent(target) ? target : null
  }

  private targetSession(target?: string): AppSession | null {
    const resolution = this.resolveTarget(target)
    return resolution.ok ? resolution.session : null
  }

  private peekTarget(target?: string): AppSession | null {
    const resolution = this.resolveTarget(target, false)
    return resolution.ok ? resolution.session : null
  }

  private sessionUnavailable(target?: string): SessionUnavailable {
    const resolution = this.resolveTarget(target, false)
    if (resolution.ok) {
      return {
        errorCode: 'not-connected',
        errorDetails: { hubCode: 'SESSION_DISCONNECTED' },
        error: 'The target app document disconnected.',
      }
    }
    const { ok: _, ...unavailable } = resolution
    return unavailable
  }

  private sessionSummaries(): SessionSummary[] {
    const current = this.peekTarget()
    return [...this.apps.values()].sort(compareSessionRecency).map((session) => {
      const staleMs = this.staleMsOf(session)
      const collisionWithSessionIds = this.logicalPeers(session).map((peer) => peer.sessionId)
      return {
        sessionId: session.sessionId,
        ...(session.logicalSessionId === undefined
          ? {}
          : { logicalSessionId: session.logicalSessionId }),
        ...(session.documentGeneration === undefined
          ? {}
          : { documentGeneration: session.documentGeneration }),
        ...(session.sessionName === undefined ? {} : { sessionName: session.sessionName }),
        ...(session.predecessorSessionId === undefined
          ? {}
          : { predecessorSessionId: session.predecessorSessionId }),
        ...(session.successorSessionId === undefined
          ? {}
          : { successorSessionId: session.successorSessionId }),
        logicalSessionCollision: collisionWithSessionIds.length > 0,
        collisionWithSessionIds,
        ...(session.forkedFromLogicalSessionId === undefined
          ? {}
          : { forkedFromLogicalSessionId: session.forkedFromLogicalSessionId }),
        app: session.app,
        domains: session.capabilities,
        toolCount: catalogOf(session).length,
        connectedAt: session.connectedAt,
        ready: session.readyAt !== undefined,
        ...(session.readyAt === undefined ? {} : { readyAt: session.readyAt }),
        current: session.sessionId === current?.sessionId,
        ...this.appOrigins.get(session.socket),
        ...(staleMs === null ? {} : { staleMs }),
      }
    })
  }

  private hasSession(sessionId?: string): boolean {
    return sessionId ? this.resolveSession(sessionId) !== null : this.apps.size > 0
  }

  private hasReadySession(sessionId?: string): boolean {
    const resolution = this.resolveTarget(sessionId, false)
    if (resolution.ok) return resolution.session.readyAt !== undefined
    // An ambiguous target is reported by the call that needs one, so readiness waits must not stall on it.
    return (
      resolution.errorDetails?.hubCode === 'SESSION_AMBIGUOUS' &&
      [...this.apps.values()].some((session) => session.readyAt !== undefined)
    )
  }

  /** Resolves physical ids, reload-stable logical ids, and unique human names. */
  private resolveSession(target: string): AppSession | null {
    let physicalId = target
    const visited = new Set<string>()
    while (this.sessionSuccessors.has(physicalId) && !visited.has(physicalId)) {
      visited.add(physicalId)
      physicalId = this.sessionSuccessors.get(physicalId) ?? physicalId
    }
    const physical = this.apps.get(physicalId)
    if (physical) return physical

    const logical = [...this.apps.values()].filter(
      (session) =>
        session.logicalSessionId === target && !this.generationRaces.has(session.sessionId),
    )
    if (logical.length === 1) return logical[0] ?? null

    const named = [...this.apps.values()].filter((session) => session.sessionName === target)
    return named.length === 1 ? (named[0] ?? null) : null
  }

  private logicalPeers(session: AppSession): AppSession[] {
    if (!session.logicalSessionId) return []
    return [...this.apps.values()].filter(
      (candidate) =>
        candidate.sessionId !== session.sessionId &&
        candidate.logicalSessionId === session.logicalSessionId,
    )
  }

  private statusWarnings(): string[] {
    const collisions = new Map<string, string[]>()
    for (const session of this.apps.values()) {
      if (!session.logicalSessionId) continue
      const sessions = collisions.get(session.logicalSessionId) ?? []
      sessions.push(session.sessionId)
      collisions.set(session.logicalSessionId, sessions)
    }
    const warnings = [...collisions]
      .filter(([, sessions]) => sessions.length > 1)
      .map(
        ([logicalSessionId, sessions]) =>
          `Logical session collision ${JSON.stringify(logicalSessionId)} across ${sessions.join(', ')}; implicit and logical-id routing is paused until the cloned document is auto-forked.`,
      )
    const origins = [...this.apps.values()].map((session) => this.appOrigins.get(session.socket))
    const distinctOrigins = new Set(origins.map((entry) => entry?.origin))
    if (distinctOrigins.size > 1 && origins.some((entry) => entry?.originUnverified)) {
      warnings.push(
        `Sessions come from different origins (${[...distinctOrigins].map((origin) => origin ?? 'native').join(', ')}) and some were admitted only as loopback pages; check each session's origin and pass --session to target your app.`,
      )
    }
    return warnings
  }

  private onConnection(
    socket: WebSocket,
    { role, origin, originUnverified }: Extract<UpgradeVerdict, { ok: true }>,
  ): void {
    const connection: Connection = { socket, role }
    if (origin !== undefined) {
      this.appOrigins.set(socket, originUnverified ? { origin, originUnverified } : { origin })
    }
    this.connections.add(socket)
    this.responsiveSockets.add(socket)
    if (role === 'agent') this.registerAgent(socket)
    socket.on('message', (data) => this.onMessage(connection, data.toString()))
    socket.on('pong', () => this.responsiveSockets.add(socket))
    socket.on('close', () => this.onClose(connection))
    socket.on('error', (error) => this.log('warn', 'socket error', error))
  }

  private sweepDeadConnections(): void {
    for (const socket of this.connections) {
      if (socket.readyState !== ws.WebSocket.OPEN) continue
      if (this.responsiveSockets.has(socket)) {
        this.responsiveSockets.delete(socket)
        socket.ping()
      } else {
        this.log('warn', 'terminating unresponsive connection')
        socket.terminate()
      }
    }
  }

  private onMessage(connection: Connection, raw: string): void {
    let frame: unknown
    try {
      frame = decodeFrame(raw)
    } catch (error) {
      this.log('warn', 'failed to decode frame', error)
      return
    }

    try {
      if (connection.role === 'agent')
        this.handleAgentMessage(connection.socket, agentMessageSchema.parse(frame))
      else this.handleAppMessage(connection.socket, appMessageSchema.parse(frame))
    } catch (error) {
      this.log('warn', 'invalid message', error)
    }
  }

  private registerAgent(socket: WebSocket): void {
    this.agents.add(socket)
    this.send(socket, { kind: 'bridge/status', ...this.getStatus() })
  }

  private handleAppMessage(socket: WebSocket, message: AppMessage): void {
    if (
      this.superseded.size > 0 &&
      (message.kind === 'app/hello' ||
        message.kind === 'app/ready' ||
        message.kind === 'app/heartbeat')
    ) {
      this.reviveSuperseded(socket)
    }
    switch (message.kind) {
      case 'app/hello':
        this.registerDocument(socket, message)
        return
      case 'app/ready': {
        const session = this.apps.get(message.sessionId)
        if (!session || session.socket !== socket) return
        session.readyAt ??= Date.now()
        if (session.lastHeartbeatAt !== undefined) session.lastHeartbeatAt = Date.now()
        this.notifyConnectionWaiters()
        this.broadcastStatus()
        return
      }
      case 'app/event':
      case 'app/snapshot':
        this.markSessionAlive(socket, true)
        return
      case 'app/heartbeat': {
        const session = this.apps.get(message.sessionId)
        if (session) {
          const now = Date.now()
          const becameReady = session.readyAt === undefined
          session.lastHeartbeatAt = now
          // Backward compatibility: pre-readiness clients prove collector startup by reaching their heartbeat loop.
          session.readyAt ??= now
          this.notifyConnectionWaiters()
          if (becameReady) this.broadcastStatus()
        }
        return
      }
      case 'app/response': {
        this.markSessionAlive(socket, true)
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.clearPendingTimers(pending)
        this.pending.delete(message.id)
        pending.settle({
          ok: message.ok,
          result: message.result,
          error: message.error,
          errorCode: message.ok ? undefined : (message.errorCode ?? 'tool-error'),
          errorDetails: message.ok ? undefined : message.errorDetails,
        })
        return
      }
    }
  }

  private registerDocument(socket: WebSocket, message: AppHello): void {
    const now = Date.now()
    // Same-socket superseded documents were revived already; one reconnecting on a new socket drops the old one.
    this.evictSuperseded(message.sessionId)
    // A live document is its tab's newest, so a successor recorded while it sat in the back/forward cache is history.
    this.sessionSuccessors.delete(message.sessionId)
    const existing = this.apps.get(message.sessionId)
    const previousLogicalSessionId = existing?.logicalSessionId
    if (existing && existing.socket !== socket) {
      // Requests in flight on the replaced socket will never get a response.
      this.failPendingForSession(message.sessionId, 'SESSION_DISCONNECTED')
      existing.socket.close()
    }
    const generation = message.documentGeneration ?? 0
    const peers = message.logicalSessionId
      ? [...this.apps.values()].filter(
          (session) =>
            session.sessionId !== message.sessionId &&
            session.logicalSessionId === message.logicalSessionId,
        )
      : []
    const olderPeers = peers.filter((peer) => (peer.documentGeneration ?? 0) < generation)
    // Superseding a document heard from within the last heartbeat could evict a live tab whose duplicate just opened.
    const racingPeers = olderPeers.filter(
      (peer) =>
        peer.lastHeartbeatAt !== undefined && now - peer.lastHeartbeatAt < this.supersedeSilenceMs,
    )
    const outranked = peers.some((peer) => (peer.documentGeneration ?? 0) > generation)
    const latest = message.logicalSessionId
      ? this.latestDocuments.get(message.logicalSessionId)
      : undefined
    const replacesLatest =
      racingPeers.length === 0 &&
      olderPeers.length === peers.length &&
      (latest === undefined ||
        latest.sessionId === message.sessionId ||
        generation >= (latest.documentGeneration ?? 0))
    const predecessorSessionId =
      replacesLatest && latest?.sessionId !== message.sessionId ? latest?.sessionId : undefined
    if (predecessorSessionId) {
      const predecessor = this.apps.get(predecessorSessionId)
      if (predecessor) predecessor.successorSessionId = message.sessionId
      this.recordSessionSuccessor(predecessorSessionId, message.sessionId)
    }
    if (message.logicalSessionId && replacesLatest) {
      this.recordLatestDocument(message.logicalSessionId, {
        sessionId: message.sessionId,
        documentGeneration: message.documentGeneration,
        connectedAt: existing?.connectedAt ?? now,
      })
    }
    const registered: AppSession = {
      socket,
      sessionId: message.sessionId,
      logicalSessionId: message.logicalSessionId,
      documentGeneration: message.documentGeneration,
      sessionName: message.sessionName,
      predecessorSessionId: existing?.predecessorSessionId ?? predecessorSessionId,
      forkedFromLogicalSessionId: existing?.forkedFromLogicalSessionId,
      app: message.app,
      capabilities: message.capabilities,
      tools: message.tools,
      // First-connect time survives re-hellos (tool refreshes, reconnects), so a background tab can't steal recency.
      connectedAt: existing?.connectedAt ?? now,
      readyAt: existing?.readyAt,
      // A re-hello from a once-heartbeating session is a live JS turn (reload, reconnect, or tool refresh), so clear stale/busy state immediately.
      lastHeartbeatAt: existing?.lastHeartbeatAt === undefined ? undefined : now,
    }
    this.apps.set(message.sessionId, registered)
    for (const peer of olderPeers) {
      if (!racingPeers.includes(peer)) this.supersede(peer, registered)
    }
    if (previousLogicalSessionId && previousLogicalSessionId !== message.logicalSessionId) {
      this.refreshLatestDocument(previousLogicalSessionId)
    }
    if (!existing) {
      this.log(
        'info',
        `app connected: ${message.app.name ?? message.sessionId} (${this.apps.size} session${this.apps.size === 1 ? '' : 's'})`,
      )
    }
    // An older generation reconnecting beside its live successor is running JS, so it is a cloned tab.
    if (outranked && message.logicalSessionId) {
      this.autoForkLogicalCollision(message.sessionId, message.logicalSessionId)
    } else if (racingPeers.length > 0) {
      this.scheduleGenerationRace(registered, now)
    } else {
      this.scheduleLogicalCollision(registered)
    }
    if (this.defaultTabKey === tabKeyOf(registered)) this.clearDefaultTabReload()
    this.notifyConnectionWaiters()
    this.broadcastStatus()
  }

  /** A newer generation of the same tab replaces this document at once: no routing, no status row, and its in-flight calls fail now instead of reading as busy. */
  private supersede(document: AppSession, successor: AppSession): void {
    this.apps.delete(document.sessionId)
    this.clearCollisionTimer(document.sessionId)
    document.successorSessionId = successor.sessionId
    successor.predecessorSessionId ??= document.sessionId
    this.recordSessionSuccessor(document.sessionId, successor.sessionId)
    this.failPendingForSession(document.sessionId, 'SESSION_SUPERSEDED')
    const timer = setTimeout(
      () => this.evictSuperseded(document.sessionId),
      this.supersededLivenessMs,
    )
    unrefTimer(timer)
    this.superseded.set(document.sessionId, { session: document, timer })
    this.log('info', 'superseded app document', {
      sessionId: document.sessionId,
      successorSessionId: successor.sessionId,
      logicalSessionId: document.logicalSessionId,
    })
  }

  private evictSuperseded(sessionId: string): void {
    const entry = this.superseded.get(sessionId)
    if (!entry) return
    clearTimeout(entry.timer)
    this.superseded.delete(sessionId)
    // terminate(), not close(): a frozen back/forward-cached page cannot complete a close handshake.
    entry.session.socket.terminate()
  }

  /** A superseded document that still runs JS was cloned (duplicated tab, window.open), not navigated away: it keeps the tab identity and the newer clone is forked. */
  private reviveSuperseded(socket: WebSocket): void {
    const entry = [...this.superseded.values()].find(({ session }) => session.socket === socket)
    if (!entry) return
    const { session } = entry
    clearTimeout(entry.timer)
    this.superseded.delete(session.sessionId)
    this.sessionSuccessors.delete(session.sessionId)
    const clone = session.successorSessionId ? this.apps.get(session.successorSessionId) : undefined
    session.successorSessionId = undefined
    this.apps.set(session.sessionId, session)
    this.log('warn', 'superseded app document is still live; forking its clone', {
      sessionId: session.sessionId,
      cloneSessionId: clone?.sessionId,
    })
    if (!clone || !session.logicalSessionId || clone.logicalSessionId !== session.logicalSessionId)
      return
    if (clone.predecessorSessionId === session.sessionId) clone.predecessorSessionId = undefined
    this.autoForkLogicalCollision(clone.sessionId, session.logicalSessionId)
  }

  private notifyConnectionWaiters(): void {
    for (const notify of [...this.connectionWaiters]) notify()
  }

  private clearCollisionTimer(sessionId: string): void {
    const timer = this.logicalCollisionTimers.get(sessionId)
    if (timer) clearTimeout(timer)
    this.logicalCollisionTimers.delete(sessionId)
    this.generationRaces.delete(sessionId)
  }

  private markSessionAlive(socket: WebSocket, impliesReady = false): void {
    const session = [...this.apps.values()].find((candidate) => candidate.socket === socket)
    if (session && impliesReady) session.readyAt ??= Date.now()
    if (session?.lastHeartbeatAt !== undefined) session.lastHeartbeatAt = Date.now()
  }

  private recordSessionSuccessor(predecessorId: string, successorId: string): void {
    this.sessionSuccessors.delete(predecessorId)
    this.sessionSuccessors.set(predecessorId, successorId)
    while (this.sessionSuccessors.size > MAX_SESSION_SUCCESSORS) {
      const oldest = this.sessionSuccessors.keys().next().value as string | undefined
      if (oldest === undefined) break
      this.sessionSuccessors.delete(oldest)
    }
  }

  private recordLatestDocument(logicalSessionId: string, document: LatestDocument): void {
    this.latestDocuments.delete(logicalSessionId)
    this.latestDocuments.set(logicalSessionId, document)
    while (this.latestDocuments.size > MAX_SESSION_SUCCESSORS) {
      const oldest = this.latestDocuments.keys().next().value as string | undefined
      if (oldest === undefined) break
      this.latestDocuments.delete(oldest)
    }
  }

  private refreshLatestDocument(logicalSessionId: string): void {
    const latest = [...this.apps.values()]
      .filter((session) => session.logicalSessionId === logicalSessionId)
      .sort(compareSessionRecency)[0]
    if (!latest) {
      this.latestDocuments.delete(logicalSessionId)
      return
    }
    this.recordLatestDocument(logicalSessionId, {
      sessionId: latest.sessionId,
      documentGeneration: latest.documentGeneration,
      connectedAt: latest.connectedAt,
    })
  }

  private scheduleLogicalCollision(session: AppSession): void {
    this.clearCollisionTimer(session.sessionId)
    if (!session.logicalSessionId || this.logicalPeers(session).length === 0) return

    const expectedLogicalSessionId = session.logicalSessionId
    const timer = setTimeout(
      () => this.autoForkLogicalCollision(session.sessionId, expectedLogicalSessionId),
      this.logicalCollisionGraceMs,
    )
    unrefTimer(timer)
    this.logicalCollisionTimers.set(session.sessionId, timer)
    this.log('warn', 'logical session collision detected', {
      logicalSessionId: expectedLogicalSessionId,
      sessionId: session.sessionId,
      collisionWithSessionIds: this.logicalPeers(session).map((peer) => peer.sessionId),
    })
  }

  /** A newer generation met an older document of its tab that beat within the last heartbeat: a reload whose old socket has not closed yet, or a duplicated tab. The older one keeps routing until it closes, stays silent (superseded), or beats again (the newer one is a duplicate and forks). */
  private scheduleGenerationRace(session: AppSession, since: number): void {
    const logicalSessionId = session.logicalSessionId
    if (!logicalSessionId) return
    this.clearCollisionTimer(session.sessionId)
    this.generationRaces.add(session.sessionId)
    const timer = setTimeout(() => {
      this.clearCollisionTimer(session.sessionId)
      if (this.apps.get(session.sessionId) !== session) return
      for (const peer of this.logicalPeers(session)) {
        const older = (peer.documentGeneration ?? 0) < (session.documentGeneration ?? 0)
        if (older && (peer.lastHeartbeatAt ?? 0) <= since) this.supersede(peer, session)
      }
      if (this.logicalPeers(session).length > 0) {
        this.autoForkLogicalCollision(session.sessionId, logicalSessionId)
        return
      }
      this.refreshLatestDocument(logicalSessionId)
      this.broadcastStatus()
    }, this.supersededLivenessMs)
    unrefTimer(timer)
    this.logicalCollisionTimers.set(session.sessionId, timer)
  }

  private autoForkLogicalCollision(sessionId: string, expectedLogicalSessionId: string): void {
    this.clearCollisionTimer(sessionId)
    const session = this.apps.get(sessionId)
    if (!session || session.logicalSessionId !== expectedLogicalSessionId) return
    const collisionWithSessionIds = this.logicalPeers(session).map((peer) => peer.sessionId)
    if (collisionWithSessionIds.length === 0) return

    const logicalSessionId = newId()
    session.logicalSessionId = logicalSessionId
    session.documentGeneration = 1
    session.forkedFromLogicalSessionId = expectedLogicalSessionId
    this.refreshLatestDocument(expectedLogicalSessionId)
    this.recordLatestDocument(logicalSessionId, {
      sessionId,
      documentGeneration: 1,
      connectedAt: session.connectedAt,
    })
    this.send(session.socket, {
      kind: 'bridge/session-fork',
      expectedLogicalSessionId,
      logicalSessionId,
      documentGeneration: 1,
      reason: 'logical-session-collision',
      collisionWithSessionIds,
    })
    this.log('warn', 'auto-forked cloned logical session', {
      sessionId,
      expectedLogicalSessionId,
      logicalSessionId,
    })
    this.broadcastStatus()
  }

  private promoteLogicalSuccessor(closed: AppSession): void {
    if (!closed.logicalSessionId) return
    const remaining = [...this.apps.values()]
      .filter((session) => session.logicalSessionId === closed.logicalSessionId)
      .sort(compareSessionRecency)
    if (remaining.length !== 1) return
    const successor = remaining[0]
    if (!successor) return
    this.clearCollisionTimer(successor.sessionId)
    successor.predecessorSessionId ??= closed.sessionId
    this.recordSessionSuccessor(closed.sessionId, successor.sessionId)
    this.recordLatestDocument(closed.logicalSessionId, {
      sessionId: successor.sessionId,
      documentGeneration: successor.documentGeneration,
      connectedAt: successor.connectedAt,
    })
  }

  private clearPendingTimers(pending: PendingRequest): void {
    clearTimeout(pending.timer)
    if (pending.busyTimer) clearTimeout(pending.busyTimer)
  }

  private handleAgentMessage(socket: WebSocket, message: AgentMessage): void {
    switch (message.kind) {
      case 'agent/ping':
        this.send(socket, { kind: 'bridge/pong', id: message.id })
        return
      case 'agent/invoke':
        this.handleInvoke(
          socket,
          message.id,
          message.tool,
          message.args,
          message.sessionId,
          message.timeoutMs,
        ).catch((error: unknown) => {
          this.log('error', `${message.tool} failed inside the hub`, error)
          this.result(
            socket,
            message.id,
            false,
            undefined,
            `${message.tool} failed inside the Genie hub: ${error instanceof Error ? error.message : String(error)}`,
            { errorCode: 'tool-error' },
          )
        })
        return
    }
  }

  private async handleInvoke(
    agent: WebSocket,
    id: string,
    tool: string,
    args: unknown,
    sessionId?: string,
    timeoutMs?: number,
  ): Promise<void> {
    if (tool === devtoolsStatusContract.name) {
      const parsed = devtoolsStatusContract.input.safeParse(args ?? {})
      if (!parsed.success) {
        this.invalidArguments(agent, id, devtoolsStatusContract, parsed.error.issues, args)
        return
      }
      const resolution = this.resolveTarget(sessionId, false)
      if (sessionId && !resolution.ok) {
        const { error, ...extra } = resolution
        this.result(agent, id, false, undefined, error, extra)
        return
      }
      const target = resolution.ok ? resolution.session : null
      this.result(
        agent,
        id,
        true,
        {
          connected: this.apps.size > 0,
          ready: target?.readyAt !== undefined,
          sessionId: target?.sessionId ?? null,
          app: target?.app ?? null,
          domains: target?.capabilities ?? [],
          toolCount: catalogOf(target).length,
          ...(parsed.data.includeTools ? { tools: catalogOf(target) } : {}),
          sessions: this.sessionSummaries(),
          warnings: this.statusWarnings(),
        },
        undefined,
        { session: target },
      )
      return
    }

    if (isCaptureTool(tool) || isInteractionTool(tool)) {
      const response = isCaptureTool(tool)
        ? await this.captures.invoke(tool, args, sessionId)
        : await this.interactions.invoke(tool, args, sessionId)
      if (response.ok) {
        this.result(agent, id, true, response.result, undefined, { session: response.session })
        return
      }
      const { ok: _, error, ...extra } = response
      this.result(agent, id, false, undefined, error, extra)
      return
    }

    if (tool === reactQuiesceContract.name) {
      await this.handleQuiesce(agent, id, args, sessionId)
      return
    }

    if (tool === devtoolsWaitContract.name) {
      await this.handleWait(agent, id, args, sessionId)
      return
    }

    this.forwardToApp(agent, id, tool, args, sessionId, timeoutMs)
  }

  private async handleQuiesce(
    agent: WebSocket,
    id: string,
    args: unknown,
    sessionId?: string,
  ): Promise<void> {
    const parsed = reactQuiesceContract.input.safeParse(args ?? {})
    if (!parsed.success) {
      this.invalidArguments(agent, id, reactQuiesceContract, parsed.error.issues, args)
      return
    }
    const started = Date.now()
    const deadline = started + parsed.data.timeoutMs
    const resolution = this.resolveTarget(sessionId)
    const session = resolution.ok ? resolution.session : null
    const pollState: WaitPollState = {
      reactSession: null,
      reactCommit: null,
      reactChangedAt: started,
      frameCheck: null,
    }
    const sameDocument = (current: AppSession | null | undefined) =>
      current?.socket === session?.socket &&
      current?.sessionId === session?.sessionId &&
      current?.documentGeneration === session?.documentGeneration
    let observedCommits = 0
    let documentCommitId: number | null = null
    let renderCollection: string | null = null
    const finish = (outcome: 'idle' | 'timed-out' | 'unavailable', reason?: string) =>
      this.result(
        agent,
        id,
        true,
        {
          ok: outcome === 'idle',
          outcome,
          elapsedMs: Date.now() - started,
          observedCommits,
          documentCommitId,
          sessionId: session?.sessionId ?? null,
          renderCollection,
          ...(reason ? { reason } : {}),
        },
        undefined,
        { session },
      )
    if (!session) {
      finish('unavailable', resolution.ok ? undefined : resolution.error)
      return
    }
    while (Date.now() < deadline) {
      if (!sameDocument(this.peekTarget(sessionId))) {
        finish('unavailable', 'App document changed during quiescence. Start a fresh measurement.')
        return
      }
      const check = await this.checkSettleDomain(
        'react',
        {
          condition: 'react-quiet',
          domains: ['react'],
          quietMs: parsed.data.idleMs,
          deadline,
        },
        session,
        pollState,
      )
      if (!sameDocument(this.peekTarget(sessionId))) {
        finish('unavailable', 'App document changed during quiescence. Start a fresh measurement.')
        return
      }
      const sample = recordOf(check.lastObserved)
      const commit = sample && numberField(sample, 'documentCommitId')
      if (commit !== null) {
        if (documentCommitId !== null && commit < documentCommitId) {
          finish('unavailable', 'React document commit counter reset. Start a fresh measurement.')
          return
        }
        observedCommits += documentCommitId === null ? 0 : commit - documentCommitId
        documentCommitId = commit
        renderCollection =
          typeof sample?.renderCollection === 'string' ? sample.renderCollection : null
      }
      if (check.status === 'unsupported' || check.status === 'failed') {
        finish('unavailable', check.reason)
        return
      }
      // A late response cannot establish that the deadline was met.
      if (Date.now() >= deadline) break
      if (check.status === 'met') {
        finish('idle')
        return
      }
      await delay(Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())))
    }
    finish(
      'timed-out',
      'React idle was not observed before timeoutMs. Inspect pending work and retry.',
    )
  }

  private async handleWait(
    agent: WebSocket,
    id: string,
    args: unknown,
    sessionId?: string,
  ): Promise<void> {
    const parsed = devtoolsWaitContract.input.safeParse(args ?? {})
    if (!parsed.success) {
      this.invalidArguments(agent, id, devtoolsWaitContract, parsed.error.issues, args)
      return
    }
    const input = parsed.data
    const started = Date.now()
    const finish = (check: WaitCheck, timeoutReason = 'timeout') =>
      this.result(
        agent,
        id,
        true,
        {
          ok: check.state === 'met',
          condition: input.condition,
          waitedMs: Date.now() - started,
          ...(check.state === 'met'
            ? {}
            : { reason: check.state === 'failed' ? check.reason : timeoutReason }),
          ...(check.query === undefined ? {} : { query: check.query }),
          validConditions: [...WAIT_CONDITIONS],
          ...(check.lastObserved === undefined ? {} : { lastObserved: check.lastObserved }),
          ...(check.domains === undefined ? {} : { domains: check.domains }),
        },
        undefined,
        { session: check.session === undefined ? this.peekTarget(sessionId) : check.session },
      )

    if (input.condition === 'connected' || input.condition === 'ready') {
      const waitFor =
        input.condition === 'ready'
          ? this.waitForReady.bind(this)
          : this.waitForConnection.bind(this)
      const connected = await waitFor(input.timeoutMs, sessionId)
      finish({
        state: connected ? 'met' : 'pending',
        lastObserved: {
          connected: this.hasSession(sessionId),
          ready: this.hasReadySession(sessionId),
        },
      })
      return
    }

    if (
      !this.hasSession(sessionId) &&
      !(await this.waitForConnection(input.timeoutMs, sessionId))
    ) {
      // A reloading tab may still claim the target, so only a wait that never found it reports which targets exist.
      if (sessionId && this.apps.size > 0) {
        const { error, ...extra } = this.unknownSession(sessionId)
        this.result(agent, id, false, undefined, error, extra)
        return
      }
      finish({ state: 'failed', reason: 'no app connected' })
      return
    }
    const target = this.resolveTarget(sessionId, false)
    if (!sessionId && !target.ok && target.errorCode === 'unknown-session') {
      this.result(agent, id, false, undefined, target.error, { errorCode: target.errorCode })
      return
    }

    const check = await this.pollCondition(
      input,
      input.timeoutMs - (Date.now() - started),
      sessionId,
    )
    finish(check)
  }

  private async pollCondition(
    input: WaitInput,
    remainingMs: number,
    target: WaitTarget,
  ): Promise<WaitCheck> {
    const deadline = Date.now() + Math.max(0, remainingMs)
    const pollState: WaitPollState = {
      reactSession: null,
      reactCommit: null,
      reactChangedAt: Date.now(),
      frameCheck: null,
    }
    let lastCheck: WaitCheck = { state: 'pending' }
    while (Date.now() < deadline) {
      const check = await this.checkCondition(
        { ...input, deadline: input.deadline ?? deadline },
        target,
        pollState,
      )
      lastCheck = check
      if (check.state !== 'pending') return check
      await delay(POLL_INTERVAL_MS)
    }
    return lastCheck
  }

  private async settleInteraction(
    session: AppSession,
    domains: WaitDomain[],
    quietMs: number,
    timeoutMs: number,
  ): Promise<InteractionSettleResult> {
    const started = Date.now()
    const check = await this.pollCondition(
      { condition: 'settled', domains, quietMs },
      timeoutMs,
      session,
    )
    return {
      ok: check.state === 'met',
      waitedMs: Date.now() - started,
      ...(check.state === 'met'
        ? {}
        : { reason: check.state === 'failed' ? check.reason : 'timeout' }),
      domains: check.domains ?? {},
    }
  }

  private async checkCondition(
    input: WaitInput,
    target: WaitTarget,
    pollState: WaitPollState,
  ): Promise<WaitCheck> {
    const session = this.waitSession(target)
    if (!session && typeof target === 'object') {
      return { session: null, state: 'failed', reason: DOCUMENT_GONE_REASON }
    }
    return { ...(await this.checkConditionOn(input, session, pollState)), session }
  }

  private async checkConditionOn(
    input: WaitInput,
    session: AppSession | null,
    pollState: WaitPollState,
  ): Promise<WaitCheck> {
    if (input.condition === 'react-quiet' || input.condition === 'settled') {
      return this.checkSettle(input, session, pollState)
    }
    if (!session) return { state: 'pending' }
    let toolFailure: string | undefined
    const request = async (tool: string, args: unknown): Promise<AppResponse> => {
      const response = await this.appRequestForSession(tool, args, session, input.deadline)
      // A broken or missing tool never satisfies the condition, so fail now instead of polling to the timeout.
      if (!response.ok && isAppErrorCode(response.errorCode))
        toolFailure ??= `${tool} failed: ${response.error ?? response.errorCode}`
      return response
    }
    const check = await this.checkAppCondition(input, request)
    return toolFailure === undefined ? check : { state: 'failed', reason: toolFailure }
  }

  private async checkAppCondition(
    input: WaitInput,
    request: (tool: string, args: unknown) => Promise<AppResponse>,
  ): Promise<WaitCheck> {
    if (input.condition === 'component') {
      const res = await request('react_find_components', { query: input.name ?? '', limit: 1 })
      const matches = matchesOf(res.result)
      return {
        state: res.ok && matches !== undefined && matches.length > 0 ? 'met' : 'pending',
        lastObserved: { matches: matches?.length ?? null },
      }
    }
    if (input.condition === 'query-settled') {
      if (input.queryHash !== undefined || input.queryKey !== undefined) {
        const selector =
          input.queryHash === undefined
            ? { queryKey: input.queryKey }
            : { queryHash: input.queryHash }
        const res = await request('query_get', selector)
        const query = queryStateOf(res.result)
        if (!res.ok || !query) return { state: 'pending' }
        const match = queryIdentity(query)
        return {
          state: query.fetchStatus === 'idle' ? 'met' : 'pending',
          ...(match === undefined ? {} : { query: match }),
          lastObserved: { fetchStatus: query.fetchStatus ?? null },
        }
      }

      if (input.name) {
        const res = await request('query_list', { limit: 500 })
        const queries = parseQueryList(res.result)
        if (!res.ok || !queries || queries.length === 0) return { state: 'pending' }
        const relevant = queries.filter((query) => legacyQueryMatches(query, input.name ?? ''))
        if (relevant.length > 1) {
          return {
            state: 'failed',
            reason: `query selector ${JSON.stringify(input.name)} is ambiguous (${relevant.length} exact matches); use queryHash or queryKey from query_list`,
          }
        }
        const query = relevant[0]
        if (!query) return { state: 'pending' }
        const match = queryIdentity(query)
        return {
          state: query.fetchStatus === 'idle' ? 'met' : 'pending',
          ...(match === undefined ? {} : { query: match }),
          lastObserved: { fetchStatus: query.fetchStatus ?? null },
        }
      }
      const fetching = await request('query_is_fetching', {})
      const state = queryStateOf(fetching.result)
      return {
        state: fetching.ok && state?.fetching === 0 && state.mutating === 0 ? 'met' : 'pending',
        lastObserved: {
          fetching: state?.fetching ?? null,
          mutating: state?.mutating ?? null,
        },
      }
    }
    if (input.condition === 'navigation') {
      const res = await request('router_get_state', {})
      const state = routerStateOf(res.result)
      if (!res.ok || !state) return { state: 'pending' }
      return {
        state:
          (input.name ? state.pathname === input.name : true) && !state.isLoading
            ? 'met'
            : 'pending',
        lastObserved: {
          pathname: state.pathname ?? null,
          isLoading: state.isLoading ?? null,
        },
      }
    }
    return { state: 'pending' }
  }

  private async checkSettle(
    input: WaitInput,
    session: AppSession | null,
    pollState: WaitPollState,
  ): Promise<WaitCheck> {
    const requested: WaitDomain[] = input.condition === 'react-quiet' ? ['react'] : input.domains
    const domains: Partial<Record<WaitDomain, WaitDomainCheck>> = {}
    for (const domain of requested) {
      domains[domain] = await this.checkSettleDomain(domain, input, session, pollState)
    }
    const checks = Object.values(domains)
    const unsupported = checks.find(
      (check) => check?.status === 'unsupported' || check?.status === 'failed',
    )
    const state = unsupported
      ? 'failed'
      : checks.every((check) => check?.status === 'met')
        ? 'met'
        : 'pending'
    return {
      state,
      ...(unsupported?.reason === undefined ? {} : { reason: unsupported.reason }),
      domains,
      lastObserved: Object.fromEntries(
        Object.entries(domains).map(([domain, check]) => [domain, check?.lastObserved ?? null]),
      ),
    }
  }

  private async checkSettleDomain(
    domain: WaitDomain,
    input: WaitInput,
    session: AppSession | null,
    pollState: WaitPollState,
  ): Promise<WaitDomainCheck> {
    const unsupported = (tool: string): WaitDomainCheck => ({
      status: 'unsupported',
      reason: `Domain ${domain} requires unavailable tool ${tool}.`,
    })
    if (domain === 'network') {
      return {
        status: 'unsupported',
        reason: 'Generic network quiet is not instrumented by this app.',
      }
    }
    if (!session) return { status: 'pending', reason: 'No app document is connected.' }
    if (domain === 'react') {
      if (!toolDescriptor(session, 'react_get_renders')) {
        return unsupported('react_get_renders')
      }
      const response = await this.appRequestForSession(
        'react_get_renders',
        { sort: 'renders', limit: 1, appOnly: false, includeCursor: false },
        session,
        input.deadline,
      )
      const result = recordOf(response.result)
      const commit = result && numberField(result, 'documentCommitId')
      if (!response.ok || commit === null || !Number.isInteger(commit) || commit < 0) {
        pollState.reactCommit = null
        return { status: 'pending', reason: response.error, lastObserved: null }
      }
      const renderCollection = result?.renderCollection
      // Late installation loses history, but still observes commits throughout this new wait window.
      if (
        renderCollection !== 'available' &&
        !(typeof renderCollection === 'string' && renderCollection.startsWith('degraded ('))
      ) {
        return {
          status: 'unsupported',
          reason: `React quiet cannot observe commits: ${typeof renderCollection === 'string' ? renderCollection : 'render collection status is missing'}.`,
          lastObserved: { documentCommitId: commit, renderCollection: renderCollection ?? null },
        }
      }
      const now = Date.now()
      if (
        pollState.reactSession?.socket !== session.socket ||
        pollState.reactSession.sessionId !== session.sessionId ||
        pollState.reactSession.documentGeneration !== session.documentGeneration ||
        pollState.reactCommit !== commit
      ) {
        pollState.reactSession = session
        pollState.reactCommit = commit
        pollState.reactChangedAt = now
      }
      const quietForMs = now - pollState.reactChangedAt
      return {
        status: quietForMs >= input.quietMs ? 'met' : 'pending',
        lastObserved: {
          documentCommitId: commit,
          renderCollection,
          quietForMs,
          requiredQuietMs: input.quietMs,
        },
      }
    }
    if (domain === 'query') {
      if (!toolDescriptor(session, 'query_is_fetching')) {
        return unsupported('query_is_fetching')
      }
      const response = await this.appRequestForSession(
        'query_is_fetching',
        {},
        session,
        input.deadline,
      )
      const result = recordOf(response.result)
      const fetching = result ? numberField(result, 'fetching') : null
      const mutating = result ? (numberField(result, 'mutating') ?? 0) : null
      return {
        status: response.ok && fetching === 0 && mutating === 0 ? 'met' : 'pending',
        lastObserved: { fetching, mutating },
      }
    }
    if (domain === 'router') {
      if (!toolDescriptor(session, 'router_get_state')) {
        return unsupported('router_get_state')
      }
      const response = await this.appRequestForSession(
        'router_get_state',
        {},
        session,
        input.deadline,
      )
      const result = routerStateOf(response.result)
      return {
        status: response.ok && result?.isLoading === false ? 'met' : 'pending',
        lastObserved: {
          isLoading: result?.isLoading ?? null,
          pathname: result?.pathname ?? null,
        },
      }
    }
    if (!toolDescriptor(session, 'browser_fps')) return unsupported('browser_fps')
    if (pollState.frameCheck?.status === 'met') return pollState.frameCheck
    const response = await this.appRequestForSession(
      'browser_fps',
      { durationMs: 250 },
      session,
      input.deadline,
    )
    const result = recordOf(response.result)
    const comparable = result?.comparable === true
    pollState.frameCheck = {
      status: response.ok && comparable ? 'met' : 'pending',
      reason: comparable
        ? undefined
        : 'Frame sample is hidden, throttled, sparse, or mode-shifted.',
      lastObserved: {
        comparable,
        avgFps: result ? numberField(result, 'avgFps') : null,
        notComparableReasons: Array.isArray(result?.notComparableReasons)
          ? result.notComparableReasons
          : [],
      },
    }
    return pollState.frameCheck
  }

  private forwardToApp(
    agent: WebSocket,
    id: string,
    tool: string,
    args: unknown,
    sessionId?: string,
    timeoutMs?: number,
  ): void {
    // Agents choose their own ids, so a colliding in-flight id gets a hub-minted one to keep two agents' replies apart.
    this.sendAppRequest(
      this.pending.has(id) ? newId() : id,
      tool,
      args,
      ({ ok, result, error, ...extra }) => this.result(agent, id, ok, result, error, extra),
      sessionId,
      timeoutMs,
    )
  }

  private appRequestForSession(
    tool: string,
    args: unknown,
    session: AppSession,
    deadline?: number,
  ): Promise<AppResponse> {
    return new Promise((resolve) =>
      this.sendAppRequest(newId(), tool, args, resolve, undefined, undefined, session, deadline),
    )
  }

  private clampTimeout(timeoutMs?: number): number {
    if (timeoutMs === undefined || !Number.isFinite(timeoutMs)) return this.requestTimeoutMs
    return Math.min(MAX_REQUEST_TIMEOUT_MS, Math.max(MIN_REQUEST_TIMEOUT_MS, Math.round(timeoutMs)))
  }

  private sendAppRequest(
    id: string,
    tool: string,
    args: unknown,
    settle: (response: AppResponse) => void,
    sessionId?: string,
    timeoutMs?: number,
    exactSession?: AppSession,
    deadline?: number,
  ): void {
    const resolution: SessionResolution<AppSession> = exactSession
      ? this.isCurrent(exactSession)
        ? { ok: true, session: exactSession }
        : {
            ok: false,
            errorCode: 'not-connected',
            errorDetails: { hubCode: 'SESSION_DISCONNECTED' },
            error: 'The target app document disconnected during the request.',
          }
      : this.resolveTarget(sessionId)
    if (!resolution.ok) {
      settle(resolution)
      return
    }
    const { session, retargeted } = resolution
    // A tab that was already open only stands in for a reloading default on reads; a mutation there would change the wrong tab.
    if (
      retargeted &&
      this.defaultTabReload !== null &&
      toolDescriptor(session, tool)?.annotations?.readOnlyHint !== true
    ) {
      settle({
        ok: false,
        errorCode: 'not-connected',
        errorDetails: { hubCode: 'SESSION_RELOADING' },
        retryInMs: BUSY_RETRY_MS,
        error: `The targeted tab ${JSON.stringify(this.defaultTabKey)} is reconnecting after a reload and "${tool}" is not read-only, so it was not run on another tab; retry shortly, or target a tab explicitly.`,
      })
      return
    }
    const settleWithSession = (response: AppResponse): void =>
      settle({ ...response, session, ...(retargeted ? { retargeted } : {}) })
    const fullTimeout = Math.min(
      this.clampTimeout(timeoutMs),
      deadline === undefined ? Infinity : Math.max(0, deadline - Date.now()),
    )
    const timer = setTimeout(() => {
      const pending = this.pending.get(id)
      if (pending) this.clearPendingTimers(pending)
      this.pending.delete(id)
      settleWithSession({
        ok: false,
        errorCode: 'timeout',
        error: `Tool "${tool}" timed out after ${fullTimeout}ms — the app tab may be reloading or its main thread busy; retry, or wait for it with devtools_wait`,
      })
    }, fullTimeout)
    const busyTimer = this.shouldBusyProbe(session, tool, timeoutMs)
      ? this.scheduleBusyProbe(id, session.sessionId, tool, settleWithSession)
      : null
    this.pending.set(id, {
      settle: settleWithSession,
      timer,
      busyTimer,
      sessionId: session.sessionId,
      mayHaveCompleted: toolDescriptor(session, tool)?.annotations?.readOnlyHint !== true,
    })
    this.send(session.socket, { kind: 'bridge/request', id, tool, args })
  }

  private shouldBusyProbe(session: AppSession, tool: string, timeoutMs?: number): boolean {
    if (timeoutMs !== undefined) return false
    const descriptor = toolDescriptor(session, tool)
    if (!descriptor) return true
    return descriptor.annotations?.readOnlyHint === true
  }

  /** Fast-fails a still-pending request when a once-heartbeating session has since gone quiet (main thread busy) — never for sessions that never beat. Re-arms until settle/timeout so a gap crossing the threshold after the first probe still fast-fails instead of racing the full timeout. */
  private scheduleBusyProbe(
    id: string,
    sessionId: string,
    tool: string,
    settle: (response: AppResponse) => void,
  ): ReturnType<typeof setTimeout> {
    const reprobeMs = Math.max(25, Math.min(500, this.busyProbeMs / 4))
    const probe = (): void => {
      const pending = this.pending.get(id)
      if (!pending) return
      const session = this.apps.get(sessionId)
      const lastBeat = session?.lastHeartbeatAt
      const gap = lastBeat === undefined ? 0 : Date.now() - lastBeat
      if (lastBeat === undefined || gap <= this.busyHeartbeatGapMs) {
        pending.busyTimer = setTimeout(probe, reprobeMs)
        return
      }
      this.clearPendingTimers(pending)
      this.pending.delete(id)
      // Past the stale threshold the app is not merely busy but likely reloading or hung; retrying won't help, so drop the retry hint and point at reload / an explicit timeoutMs.
      if (gap > this.sessionStaleMs) {
        settle({
          ok: false,
          errorCode: 'busy',
          error: `App unresponsive (no heartbeat for ${gap}ms) — likely reloading, frozen, or its JS thread is stuck; retrying won't help. Reload the app, or pass a larger timeoutMs to wait it out.`,
          busyTelemetry: this.busyTelemetry(sessionId, tool, gap),
        })
        return
      }
      settle({
        ok: false,
        errorCode: 'busy',
        retryInMs: BUSY_RETRY_MS,
        error: `App main thread busy (no heartbeat for ${gap}ms) — not a crash; retry shortly or reduce concurrent profilers. Tool "${tool}" was still pending; if this tool itself blocks the thread this long, pass a larger timeoutMs and retry.`,
        busyTelemetry: this.busyTelemetry(sessionId, tool, gap),
      })
    }
    return setTimeout(probe, this.busyProbeMs)
  }

  private busyTelemetry(sessionId: string, tool: string, gap: number): BusyTelemetry {
    const session = this.apps.get(sessionId)
    const descriptor = session ? toolDescriptor(session, tool) : undefined
    return {
      lastHeartbeatAgeMs: gap,
      queueDepth: Math.max(
        1,
        [...this.pending.values()].filter((pending) => pending.sessionId === sessionId).length,
      ),
      pendingWorkClass:
        descriptor?.annotations?.readOnlyHint === true
          ? 'instrumentation'
          : descriptor
            ? 'app'
            : 'unknown',
      tool,
    }
  }

  private waitForConnection(timeoutMs: number, sessionId?: string): Promise<boolean> {
    if (this.hasSession(sessionId)) return Promise.resolve(true)
    return new Promise((resolve) => {
      let settled = false
      const finish = (connected: boolean) => {
        if (settled) return
        settled = true
        this.connectionWaiters.delete(waiter)
        clearTimeout(timer)
        resolve(connected)
      }
      const waiter = () => {
        if (this.hasSession(sessionId)) finish(true)
      }
      const timer = setTimeout(() => finish(false), timeoutMs)
      this.connectionWaiters.add(waiter)
    })
  }

  private waitForReady(timeoutMs: number, sessionId?: string): Promise<boolean> {
    if (this.hasReadySession(sessionId)) return Promise.resolve(true)
    return new Promise((resolve) => {
      let settled = false
      const finish = (ready: boolean) => {
        if (settled) return
        settled = true
        this.connectionWaiters.delete(waiter)
        clearTimeout(timer)
        resolve(ready)
      }
      const waiter = () => {
        if (this.hasReadySession(sessionId)) finish(true)
      }
      const timer = setTimeout(() => finish(false), timeoutMs)
      this.connectionWaiters.add(waiter)
    })
  }

  private unknownSession(target: string): SessionUnavailable {
    const ambiguous = (error: string): SessionUnavailable => ({
      errorCode: 'unknown-session',
      errorDetails: { hubCode: 'SESSION_AMBIGUOUS' },
      error,
    })
    const logical = [...this.apps.values()].filter((session) => session.logicalSessionId === target)
    if (logical.length > 1) {
      return ambiguous(
        `Logical session ${JSON.stringify(target)} has a live identity collision (${logical.map((session) => session.sessionId).join(', ')}). Wait for auto-fork, then choose a distinct logical or physical id from devtools_status.`,
      )
    }
    const named = [...this.apps.values()].filter((session) => session.sessionName === target)
    if (named.length > 1) {
      return ambiguous(
        `Session name ${JSON.stringify(target)} is ambiguous; ${named.length} tabs share it: ${named.map(tabLabel).join('; ')}. Target one by its logical or physical id from devtools_status.`,
      )
    }
    const targets = this.sessionSummaries()
      .flatMap((session) => [session.sessionId, session.logicalSessionId, session.sessionName])
      .filter((candidate): candidate is string => typeof candidate === 'string')
    return {
      errorCode: 'unknown-session',
      error: `Unknown session "${target}". Connected targets: ${[...new Set(targets)].join(', ') || 'none'} — run devtools_status to list them.`,
    }
  }

  private failPendingForSession(sessionId: string, hubCode: InterruptionCode): void {
    for (const [id, pending] of this.pending) {
      if (pending.sessionId !== sessionId) continue
      this.clearPendingTimers(pending)
      this.pending.delete(id)
      pending.settle({
        ok: false,
        errorCode: 'not-connected',
        error: interruptedCallError(hubCode, pending.mayHaveCompleted),
        errorDetails: { hubCode, ...(pending.mayHaveCompleted ? { mayHaveCompleted: true } : {}) },
      })
    }
  }

  private onClose(connection: Connection): void {
    this.connections.delete(connection.socket)
    const superseded = [...this.superseded.values()].find(
      ({ session }) => session.socket === connection.socket,
    )
    if (superseded) {
      clearTimeout(superseded.timer)
      this.superseded.delete(superseded.session.sessionId)
      return
    }
    const session = [...this.apps.values()].find((s) => s.socket === connection.socket)
    if (session) {
      this.apps.delete(session.sessionId)
      this.clearCollisionTimer(session.sessionId)
      this.promoteLogicalSuccessor(session)
      this.log('info', `app disconnected: ${session.app.name ?? session.sessionId}`)
      this.failPendingForSession(session.sessionId, 'SESSION_DISCONNECTED')
      if (this.defaultTabKey === tabKeyOf(session) && !this.tabDocuments().has(this.defaultTabKey))
        this.holdDefaultTabForReload()
      this.broadcastStatus()
      return
    }
    this.agents.delete(connection.socket)
  }

  /** Keeps untargeted calls on a reloading tab instead of letting another tab take over; waiters re-check once the grace lapses. */
  private holdDefaultTabForReload(): void {
    this.clearDefaultTabReload()
    const timer = setTimeout(() => {
      this.defaultTabReload = null
      this.notifyConnectionWaiters()
    }, this.targetReloadGraceMs)
    unrefTimer(timer)
    this.defaultTabReload = { timer, since: Date.now() }
  }

  private clearDefaultTabReload(): void {
    if (this.defaultTabReload) clearTimeout(this.defaultTabReload.timer)
    this.defaultTabReload = null
  }

  private broadcastStatus(): void {
    if (this.agents.size === 0) return
    const frame = encodeMessage({ kind: 'bridge/status', ...this.getStatus() })
    for (const agent of this.agents) if (agent.readyState === ws.WebSocket.OPEN) agent.send(frame)
  }

  private result(
    agent: WebSocket,
    id: string,
    ok: boolean,
    result?: unknown,
    error?: string,
    extra?: Omit<AppResponse, 'ok' | 'result' | 'error' | 'session'> & {
      session?: RoutableDocument | null
    },
  ): void {
    this.send(agent, {
      kind: 'bridge/result',
      id,
      ok,
      result,
      error,
      errorCode: extra?.errorCode,
      errorDetails: extra?.errorDetails,
      retryInMs: extra?.retryInMs,
      busyTelemetry: extra?.busyTelemetry,
      session: extra?.session ? answeringSessionOf(extra.session) : undefined,
      retargeted: extra?.retargeted,
    })
  }

  private invalidArguments(
    agent: WebSocket,
    id: string,
    contract: AgentToolContract,
    issues: Parameters<typeof toolValidationFailure>[1],
    args: unknown,
  ): void {
    const failure = toolValidationFailure(contract.name, issues, {
      input: contract.input,
      args: args ?? {},
    })
    this.result(agent, id, false, undefined, failure.error, {
      errorCode: 'invalid-args',
      errorDetails: failure.errorDetails,
    })
  }

  private send(socket: WebSocket, message: unknown): void {
    if (socket.readyState === ws.WebSocket.OPEN) socket.send(encodeMessage(message))
  }
}

function interruptedCallError(hubCode: InterruptionCode, mayHaveCompleted: boolean): string {
  const cause =
    hubCode === 'SESSION_SUPERSEDED'
      ? 'The app document was replaced by a newer page load in its tab before answering'
      : 'The app document disconnected (reload, navigation, or closed tab) before answering'
  return mayHaveCompleted
    ? `${cause}; the call is not read-only and may have completed, so inspect app state before retrying.`
    : `${cause}; retry the call.`
}

function isAppErrorCode(code: AgentErrorCode | undefined): boolean {
  return code === 'invalid-args' || code === 'tool-error'
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function numberField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
