import './ws-env'
import {
  type AgentBoundMessage,
  type AgentErrorCode,
  type AgentToolContract,
  type AnsweringSession,
  type BridgeStatusMessage,
  type BusyTelemetry,
  decodeAgentBoundMessage,
  encodeMessage,
  errorMessage,
  newId,
  reactQuiesceContract,
  type ToolErrorDetails,
  type ToolInput,
  type ToolOutput,
} from 'genie-react/protocol'
import { WebSocket } from 'ws'

export interface GenieAgentLinkOptions {
  /** Bridge URL, or a resolver re-invoked on every (re)connect so the link self-heals when the URL changes. */
  url: string | (() => string | Promise<string>)
  /** Agent token the hub published, sent as a bearer header on every (re)connect. */
  token?: string
  logger?: (message: string) => void
  connectTimeoutMs?: number
  invokeTimeoutMs?: number
  reconnectDelayMs?: number
  /** Target a specific app session when several tabs are connected (default: the only or already-targeted tab). */
  sessionId?: string
  /** Reject at once when nothing listens at the URL instead of retrying until `connectTimeoutMs`; for guessed URLs. */
  failFastOnRefused?: boolean
}

/** Grace added on top of a per-call `timeoutMs` so the bridge's typed answer (timeout/busy) wins the race with the link's own guard. */
export const INVOKE_GRACE_MS = 2_000

/** A bridge-side failure that carries the machine-readable code (and optional retry hint) from the `bridge/result` frame. */
export class BridgeCallError extends Error {
  readonly errorCode?: AgentErrorCode
  readonly retryInMs?: number
  readonly busyTelemetry?: BusyTelemetry
  readonly details?: ToolErrorDetails

  constructor(
    message: string,
    options?: {
      errorCode?: AgentErrorCode
      retryInMs?: number
      busyTelemetry?: BusyTelemetry
      details?: ToolErrorDetails
    },
  ) {
    super(message)
    this.name = 'BridgeCallError'
    this.errorCode = options?.errorCode
    this.retryInMs = options?.retryInMs
    this.busyTelemetry = options?.busyTelemetry
    this.details = options?.details
  }
}

/** No bridge answered at `url`, or the open connection dropped before a pending call answered (`lost`). */
export class BridgeUnreachableError extends BridgeCallError {
  readonly url: string
  readonly lost: boolean

  constructor(url: string, lost = false) {
    super(
      lost
        ? `Genie bridge connection at ${url} closed before the call answered`
        : `Genie bridge not reachable at ${url}`,
      { errorCode: 'not-connected' },
    )
    this.name = 'BridgeUnreachableError'
    this.url = url
    this.lost = lost
  }
}

/** A tool result with the app document that answered it, when the call reached one. */
export interface AnsweredResult {
  result: unknown
  session?: AnsweringSession
  /** The untargeted default tab was gone or unresponsive, so another tab answered. */
  retargeted?: boolean
}

interface Pending {
  resolve: (value: AnsweredResult) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

interface OpenWaiter {
  timer: ReturnType<typeof setTimeout>
  settle: (error?: Error) => void
}

export interface InvokeOptions {
  /** Per-call full-timeout budget forwarded to the bridge; the local guard waits this plus {@link INVOKE_GRACE_MS}. */
  timeoutMs?: number
}

/** The hub refused the WebSocket upgrade (bad token, browser origin) — retrying with the same credentials cannot succeed. */
export class BridgeRejectedError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Genie hub refused the connection (HTTP ${status})`)
    this.name = 'BridgeRejectedError'
    this.status = status
  }
}

/** How the CLI reached the hub; `source` is `flag`, `env`, `file`, `workspace` or `fallback`. */
export interface BridgeConnectionInfo {
  url: string
  source: string
  authenticated: boolean
}

/** Fixed remediation per refusal status; the hub's own text is not echoed into agent-facing output. */
export function bridgeRejectionHint(
  error: BridgeRejectedError,
  connection?: BridgeConnectionInfo,
): string {
  if (error.status === 401 && connection?.authenticated === false) {
    return connection.source === 'fallback'
      ? `No .genie/bridge.json was found from this directory upward, so the CLI tried the default address ${connection.url} without an agent token, and the hub there (likely another project's) refused it. Run from the app directory whose dev server or hub you want, or pass --url together with GENIE_BRIDGE_TOKEN.`
      : 'The hub requires an agent token and none was found for it. Run the CLI as the same user as the hub from its app directory, or set GENIE_BRIDGE_TOKEN alongside --url or GENIE_BRIDGE_URL.'
  }
  if (error.status === 401) {
    return 'The hub rejected the agent token: it restarted, a different hub answered, or genie-react and @genie-react/cli versions differ. Re-run from the app directory so the hub is rediscovered; with --url or GENIE_BRIDGE_URL for a hub outside this directory tree, also set GENIE_BRIDGE_TOKEN.'
  }
  if (error.status === 403) {
    return 'The hub refused this connection. Agents must run on the same machine as the hub, as a process without a browser Origin header.'
  }
  return `The hub refused the connection (HTTP ${error.status}). Update genie-react and @genie-react/cli to matching versions.`
}

/** Agent-side WebSocket client to the bridge; reconnects and re-resolves the URL each attempt to survive dev-server restarts. */
export class GenieAgentLink {
  private readonly resolveUrl: () => string | Promise<string>
  private readonly token: string | undefined
  private readonly log: (message: string) => void
  private readonly connectTimeoutMs: number
  private readonly invokeTimeoutMs: number
  private readonly reconnectDelayMs: number
  private readonly sessionId: string | undefined
  private readonly failFastOnRefused: boolean
  private readonly pending = new Map<string, Pending>()
  private readonly openWaiters = new Set<OpenWaiter>()
  private ws: WebSocket | null = null
  private status: BridgeStatusMessage | null = null
  private currentUrl = ''
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private connecting = false
  private closed = false
  private rejection: BridgeRejectedError | BridgeUnreachableError | null = null

  /** Invoked whenever the bridge pushes a status update (e.g. an app connects with new tools). */
  onStatus: ((status: BridgeStatusMessage) => void) | null = null

  constructor(options: GenieAgentLinkOptions) {
    const { url } = options
    this.resolveUrl = typeof url === 'function' ? url : () => url
    this.token = options.token
    this.log = options.logger ?? (() => {})
    this.connectTimeoutMs = options.connectTimeoutMs ?? 5_000
    this.invokeTimeoutMs = options.invokeTimeoutMs ?? 30_000
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1_000
    this.sessionId = options.sessionId
    this.failFastOnRefused = options.failFastOnRefused ?? false
  }

  start(): void {
    this.closed = false
    void this.connect()
  }

  getStatus(): BridgeStatusMessage | null {
    return this.status
  }

  /** Contract-typed round-trip (no cast); `sessionId` overrides the link target, and `null` forces a bridge-global call. */
  invoke<C extends AgentToolContract>(
    contract: C,
    args: ToolInput<C>,
    sessionId?: string | null,
    options?: InvokeOptions,
  ): Promise<ToolOutput<C>>
  /** Pass a bare tool name for dynamic dispatch of a tool discovered at runtime over the wire. */
  invoke(
    tool: string,
    args: unknown,
    sessionId?: string | null,
    options?: InvokeOptions,
  ): Promise<unknown>
  async invoke(
    toolOrContract: string | AgentToolContract,
    args: unknown,
    sessionId: string | null | undefined = this.sessionId,
    options: InvokeOptions = {},
  ): Promise<unknown> {
    const tool = typeof toolOrContract === 'string' ? toolOrContract : toolOrContract.name
    return (await this.invokeAnswered(tool, args, sessionId, options)).result
  }

  /** Like {@link invoke}, but also reports which app document answered, so multi-tab callers can show it. */
  async invokeAnswered(
    tool: string,
    args: unknown,
    sessionId: string | null | undefined = this.sessionId,
    options: InvokeOptions = {},
  ): Promise<AnsweredResult> {
    const ws = await this.ensureConnection()
    const id = newId()
    // Give the bridge its per-call budget plus a grace window, so its typed timeout/busy result arrives before this local guard fires.
    const quiesce =
      tool === reactQuiesceContract.name ? reactQuiesceContract.input.safeParse(args ?? {}) : null
    const callTimeoutMs =
      options.timeoutMs ?? (quiesce?.success ? quiesce.data.timeoutMs : undefined)
    const localTimeoutMs =
      callTimeoutMs === undefined ? this.invokeTimeoutMs : callTimeoutMs + INVOKE_GRACE_MS
    return new Promise<AnsweredResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(
          new BridgeCallError(`Bridge did not respond to "${tool}" within ${localTimeoutMs}ms`, {
            errorCode: 'timeout',
          }),
        )
      }, localTimeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      ws.send(
        encodeMessage({
          kind: 'agent/invoke',
          id,
          tool,
          args,
          sessionId: sessionId ?? undefined,
          timeoutMs: options.timeoutMs,
        }),
      )
    })
  }

  close(): void {
    this.closed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.rejectPending(new Error('agent link closed'))
    this.flushOpenWaiters(new Error('agent link closed'))
    this.ws?.close()
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
  }

  private async connect(): Promise<void> {
    if (this.connecting || this.ws) return
    this.connecting = true

    let url: string
    try {
      url = await this.resolveUrl()
    } catch (error) {
      this.connecting = false
      this.log(`failed to resolve bridge url: ${errorMessage(error)}`)
      if (!this.closed) this.scheduleReconnect()
      return
    }
    if (this.closed) {
      this.connecting = false
      return
    }

    this.currentUrl = url
    const ws = new WebSocket(`${url}?role=agent`, {
      headers: this.token ? { authorization: `Bearer ${this.token}` } : {},
    })
    this.ws = ws
    this.connecting = false
    ws.on('open', () => {
      this.rejection = null
      this.log(`connected to bridge at ${url}`)
      this.flushOpenWaiters()
    })
    ws.on('unexpected-response', (request, response) => {
      this.rejection = new BridgeRejectedError(response.statusCode ?? 0)
      this.log(`bridge refused the connection: HTTP ${response.statusCode}`)
      request.destroy()
      ws.terminate()
      this.flushOpenWaiters()
    })
    ws.on('message', (data) => this.onMessage(data.toString()))
    ws.on('error', (error) => {
      this.log(`socket error: ${errorMessage(error)}`)
      if (this.failFastOnRefused && isConnectionRefused(error)) {
        this.rejection = new BridgeUnreachableError(url)
      }
    })
    ws.on('close', () => {
      this.ws = null
      this.status = null
      // A dropped hub cannot answer in-flight calls, so they fail now instead of waiting out their timeouts.
      this.rejectPending(new BridgeUnreachableError(url, true))
      if (this.rejection instanceof BridgeUnreachableError) {
        this.flushOpenWaiters()
        return
      }
      if (!this.closed) this.scheduleReconnect()
    })
  }

  private flushOpenWaiters(error?: Error): void {
    for (const waiter of [...this.openWaiters]) waiter.settle(error)
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect()
    }, this.reconnectDelayMs)
  }

  private onMessage(raw: string): void {
    let message: AgentBoundMessage
    try {
      message = decodeAgentBoundMessage(raw)
    } catch (error) {
      this.log(`failed to decode bridge message: ${errorMessage(error)}`)
      return
    }
    if (message.kind === 'bridge/result') {
      const pending = this.pending.get(message.id)
      if (!pending) return
      clearTimeout(pending.timer)
      this.pending.delete(message.id)
      if (message.ok) {
        pending.resolve({
          result: message.result,
          session: message.session,
          retargeted: message.retargeted,
        })
      } else {
        pending.reject(
          new BridgeCallError(message.error ?? 'tool failed', {
            errorCode: message.errorCode,
            retryInMs: message.retryInMs,
            busyTelemetry: message.busyTelemetry,
            details: message.errorDetails,
          }),
        )
      }
    } else if (message.kind === 'bridge/status') {
      this.status = message
      this.onStatus?.(message)
    }
  }

  private ensureConnection(): Promise<WebSocket> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve(this.ws)
    if (this.closed) return Promise.reject(new Error('agent link closed'))
    if (this.rejection instanceof BridgeUnreachableError) return Promise.reject(this.rejection)
    return new Promise<WebSocket>((resolve, reject) => {
      const waiter: OpenWaiter = {
        timer: setTimeout(() => {
          this.openWaiters.delete(waiter)
          reject(new BridgeUnreachableError(this.currentUrl || '(unresolved)'))
        }, this.connectTimeoutMs),
        settle: (error) => {
          clearTimeout(waiter.timer)
          this.openWaiters.delete(waiter)
          if (error) reject(error)
          else if (this.ws && this.ws.readyState === WebSocket.OPEN) resolve(this.ws)
          else reject(this.rejection ?? new Error('bridge connection closed before it was ready'))
        },
      }
      this.openWaiters.add(waiter)
      if (!this.ws && !this.reconnectTimer && !this.connecting) void this.connect()
    })
  }
}

function isConnectionRefused(error: Error): boolean {
  return 'code' in error && error.code === 'ECONNREFUSED'
}
