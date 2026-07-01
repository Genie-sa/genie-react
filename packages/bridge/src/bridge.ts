import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import {
  type AgentMessage,
  type AppInfo,
  type AppMessage,
  agentMessageSchema,
  appMessageSchema,
  type ConnectionRole,
  DEFAULT_REQUEST_TIMEOUT_MS,
  decodeFrame,
  devtoolsStatusContract,
  devtoolsWaitContract,
  encodeMessage,
  GENIE_WS_PATH,
  metaTools,
  newId,
  ROLE_QUERY_PARAM,
  type ToolDescriptor,
  type WaitCondition,
} from '@genie-react/core'
import { WebSocket, WebSocketServer } from 'ws'
import { frameKind, matchesOf, parseQueryList, routerStateOf } from './wire-guards'

type BridgeLogLevel = 'info' | 'warn' | 'error'
type BridgeLogger = (level: BridgeLogLevel, message: string, meta?: unknown) => void

export interface GenieBridgeOptions {
  requestTimeoutMs?: number
  logger?: BridgeLogger
}

interface BridgeStatus {
  connected: boolean
  sessionId: string | null
  app: AppInfo | null
  domains: string[]
  tools: ToolDescriptor[]
}

interface AppSession {
  socket: WebSocket
  sessionId: string
  app: AppInfo
  capabilities: string[]
  tools: ToolDescriptor[]
}

interface Connection {
  socket: WebSocket
  role: ConnectionRole | null
}

interface AppResponse {
  ok: boolean
  result?: unknown
  error?: string
}

interface PendingRequest {
  settle: (response: AppResponse) => void
  timer: ReturnType<typeof setTimeout>
}

const POLL_INTERVAL_MS = 150
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The hub. Owns a `noServer` WebSocket server so it can be mounted on an existing HTTP server
 * (Vite's dev server) via {@link handleUpgrade}, or run standalone. Routes agent tool calls to the
 * connected app and relays responses back, and answers the meta tools (`devtools_status`,
 * `devtools_wait`) itself — including resolving wait conditions by polling the app's own tools.
 */
export class GenieBridge {
  private readonly wss = new WebSocketServer({ noServer: true })
  private readonly agents = new Set<WebSocket>()
  private readonly pending = new Map<string, PendingRequest>()
  private readonly connectionWaiters = new Set<(connected: boolean) => void>()
  private readonly requestTimeoutMs: number
  private readonly log: BridgeLogger
  private app: AppSession | null = null

  constructor(options: GenieBridgeOptions = {}) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    this.log = options.logger ?? (() => {})
  }

  /**
   * Routes an HTTP upgrade to the hub when it targets {@link GENIE_WS_PATH}. Returns `false`
   * for any other path so the caller can let another listener (e.g. Vite HMR) handle it.
   */
  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): boolean {
    const { pathname, role } = parseUpgradeUrl(request.url)
    if (pathname !== GENIE_WS_PATH) return false
    this.wss.handleUpgrade(request, socket, head, (ws) => this.onConnection(ws, role))
    return true
  }

  getStatus(): BridgeStatus {
    return {
      connected: this.app !== null,
      sessionId: this.app?.sessionId ?? null,
      app: this.app?.app ?? null,
      domains: this.app?.capabilities ?? [],
      tools: this.app?.tools ?? [],
    }
  }

  close(): void {
    for (const { timer } of this.pending.values()) clearTimeout(timer)
    this.pending.clear()
    for (const socket of this.agents) socket.close()
    this.app?.socket.close()
    this.wss.close()
  }

  private onConnection(socket: WebSocket, role: ConnectionRole | null): void {
    const connection: Connection = { socket, role }
    if (role === 'agent') this.registerAgent(socket)
    socket.on('message', (data) => this.onMessage(connection, data.toString()))
    socket.on('close', () => this.onClose(connection))
    socket.on('error', (error) => this.log('warn', 'socket error', error))
  }

  private onMessage(connection: Connection, raw: string): void {
    let frame: unknown
    try {
      frame = decodeFrame(raw)
    } catch (error) {
      this.log('warn', 'failed to decode frame', error)
      return
    }

    const role: ConnectionRole =
      connection.role ?? (frameKind(frame)?.startsWith('agent/') ? 'agent' : 'app')
    if (connection.role === null) {
      connection.role = role
      if (role === 'agent') this.registerAgent(connection.socket)
    }

    try {
      if (role === 'agent')
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
    switch (message.kind) {
      case 'app/hello': {
        this.app = {
          socket,
          sessionId: message.sessionId,
          app: message.app,
          capabilities: message.capabilities,
          tools: message.tools,
        }
        this.log('info', `app connected: ${message.app.name ?? message.sessionId}`)
        for (const resolve of this.connectionWaiters) resolve(true)
        this.connectionWaiters.clear()
        this.broadcastStatus()
        return
      }
      case 'app/event':
        return
      case 'app/response': {
        const pending = this.pending.get(message.id)
        if (!pending) return
        clearTimeout(pending.timer)
        this.pending.delete(message.id)
        pending.settle({ ok: message.ok, result: message.result, error: message.error })
        return
      }
    }
  }

  private handleAgentMessage(socket: WebSocket, message: AgentMessage): void {
    switch (message.kind) {
      case 'agent/ping':
        this.send(socket, { kind: 'bridge/pong', id: message.id })
        return
      case 'agent/invoke':
        void this.handleInvoke(socket, message.id, message.tool, message.args)
        return
    }
  }

  private async handleInvoke(
    agent: WebSocket,
    id: string,
    tool: string,
    args: unknown,
  ): Promise<void> {
    if (tool === devtoolsStatusContract.name) {
      const status = this.getStatus()
      this.result(agent, id, true, {
        connected: status.connected,
        sessionId: status.sessionId,
        app: status.app,
        domains: status.domains,
        toolCount: status.tools.length + metaTools.length,
      })
      return
    }

    if (tool === devtoolsWaitContract.name) {
      await this.handleWait(agent, id, args)
      return
    }

    this.forwardToApp(agent, id, tool, args)
  }

  private async handleWait(agent: WebSocket, id: string, args: unknown): Promise<void> {
    const parsed = devtoolsWaitContract.input.safeParse(args ?? {})
    if (!parsed.success) {
      this.result(agent, id, false, undefined, 'invalid devtools_wait arguments')
      return
    }
    const input = parsed.data
    const started = Date.now()
    const finish = (ok: boolean, reason?: string) =>
      this.result(agent, id, true, { ok, waitedMs: Date.now() - started, reason })

    if (input.condition === 'connected') {
      const connected = this.app !== null ? true : await this.waitForConnection(input.timeoutMs)
      finish(connected, connected ? undefined : 'timeout')
      return
    }

    if (!this.app && !(await this.waitForConnection(input.timeoutMs))) {
      finish(false, 'no app connected')
      return
    }

    const ok = await this.pollCondition(input, input.timeoutMs - (Date.now() - started))
    finish(ok, ok ? undefined : 'timeout')
  }

  private async pollCondition(
    input: { condition: WaitCondition; name?: string },
    remainingMs: number,
  ): Promise<boolean> {
    const deadline = Date.now() + Math.max(0, remainingMs)
    while (Date.now() < deadline) {
      if (await this.checkCondition(input)) return true
      await delay(POLL_INTERVAL_MS)
    }
    return false
  }

  private async checkCondition(input: {
    condition: WaitCondition
    name?: string
  }): Promise<boolean> {
    if (input.condition === 'component') {
      const res = await this.appRequest('react_find_components', {
        query: input.name ?? '',
        limit: 1,
      })
      const matches = matchesOf(res.result)
      return res.ok && matches !== undefined && matches.length > 0
    }
    if (input.condition === 'query-settled') {
      const res = await this.appRequest('query_list', {})
      const queries = parseQueryList(res.result)
      if (!res.ok || !queries || queries.length === 0) return false
      const name = input.name
      const relevant = name
        ? queries.filter((query) => JSON.stringify(query.queryKey ?? null).includes(name))
        : queries
      return relevant.length > 0 && relevant.every((query) => query.fetchStatus === 'idle')
    }
    if (input.condition === 'navigation') {
      const res = await this.appRequest('router_get_state', {})
      const state = routerStateOf(res.result)
      if (!res.ok || !state) return false
      return input.name ? state.pathname === input.name && !state.isLoading : !state.isLoading
    }
    return false
  }

  private forwardToApp(agent: WebSocket, id: string, tool: string, args: unknown): void {
    this.sendAppRequest(id, tool, args, ({ ok, result, error }) =>
      this.result(agent, id, ok, result, error),
    )
  }

  private appRequest(tool: string, args: unknown): Promise<AppResponse> {
    return new Promise((resolve) => this.sendAppRequest(newId(), tool, args, resolve))
  }

  private sendAppRequest(
    id: string,
    tool: string,
    args: unknown,
    settle: (response: AppResponse) => void,
  ): void {
    if (!this.app) {
      settle({
        ok: false,
        error: 'No app connected. Run your dev server with the Genie Vite plugin.',
      })
      return
    }
    const timer = setTimeout(() => {
      this.pending.delete(id)
      settle({ ok: false, error: `Tool "${tool}" timed out after ${this.requestTimeoutMs}ms` })
    }, this.requestTimeoutMs)
    this.pending.set(id, { settle, timer })
    this.send(this.app.socket, { kind: 'bridge/request', id, tool, args })
  }

  private waitForConnection(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false
      const finish = (connected: boolean) => {
        if (settled) return
        settled = true
        this.connectionWaiters.delete(waiter)
        clearTimeout(timer)
        resolve(connected)
      }
      const waiter = (connected: boolean) => finish(connected)
      const timer = setTimeout(() => finish(false), timeoutMs)
      this.connectionWaiters.add(waiter)
    })
  }

  private onClose(connection: Connection): void {
    if (this.app && connection.socket === this.app.socket) {
      this.app = null
      this.log('info', 'app disconnected')
      for (const [, pending] of this.pending) {
        clearTimeout(pending.timer)
        pending.settle({ ok: false, error: 'app disconnected' })
      }
      this.pending.clear()
      this.broadcastStatus()
      return
    }
    this.agents.delete(connection.socket)
  }

  private broadcastStatus(): void {
    const status = { kind: 'bridge/status' as const, ...this.getStatus() }
    for (const agent of this.agents) this.send(agent, status)
  }

  private result(
    agent: WebSocket,
    id: string,
    ok: boolean,
    result?: unknown,
    error?: string,
  ): void {
    this.send(agent, { kind: 'bridge/result', id, ok, result, error })
  }

  private send(socket: WebSocket, message: unknown): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(encodeMessage(message))
  }
}

function parseUpgradeUrl(url: string | undefined): {
  pathname: string
  role: ConnectionRole | null
} {
  const parsed = new URL(url ?? '/', 'http://localhost')
  const roleParam = parsed.searchParams.get(ROLE_QUERY_PARAM)
  const role = roleParam === 'app' || roleParam === 'agent' ? roleParam : null
  return { pathname: parsed.pathname, role }
}
