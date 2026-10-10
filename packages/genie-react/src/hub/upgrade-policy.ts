import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { type IncomingMessage, STATUS_CODES } from 'node:http'
import { isIP } from 'node:net'
import type { Duplex } from 'node:stream'
import { type ConnectionRole, ROLE_QUERY_PARAM } from '../protocol'

export interface UpgradePolicyOptions {
  /** Secret agents must present as `Authorization: Bearer <token>`; generated per hub when omitted. */
  agentToken?: string
  /** Extra browser origins (e.g. `https://app.example.test:8443`) allowed to connect as apps. */
  allowedOrigins?: readonly string[]
  /** Vite-style `server.allowedHosts`: same-origin pages on these hostnames may connect as apps. */
  allowedHosts?: readonly string[] | true
}

export type UpgradeVerdict =
  | { ok: true; role: ConnectionRole }
  | { ok: false; status: 400 | 401 | 403; reason: string }

const BEARER = /^Bearer\s+(\S+)$/i

/** Decides which WebSocket upgrades reach the bridge: agents prove the per-hub token, apps prove a trusted browser origin. */
export class UpgradePolicy {
  readonly agentToken: string
  private readonly agentTokenDigest: Buffer
  private readonly allowedOrigins: ReadonlySet<string>
  private readonly allowedHosts: readonly string[] | true

  constructor(options: UpgradePolicyOptions = {}) {
    this.agentToken = options.agentToken ?? randomBytes(32).toString('base64url')
    this.agentTokenDigest = digest(this.agentToken)
    this.allowedOrigins = new Set((options.allowedOrigins ?? []).map(normalizeOrigin))
    this.allowedHosts =
      options.allowedHosts === true
        ? true
        : (options.allowedHosts ?? []).map((host) => host.toLowerCase())
  }

  authorize(request: IncomingMessage): UpgradeVerdict {
    const role = new URL(request.url ?? '/', 'http://localhost').searchParams.get(ROLE_QUERY_PARAM)
    if (role === 'agent') return this.authorizeAgent(request)
    if (role === 'app') return this.authorizeApp(request)
    return { ok: false, status: 400, reason: 'missing or invalid "role" query parameter' }
  }

  private authorizeAgent(request: IncomingMessage): UpgradeVerdict {
    // Any page the developer visits can open a WebSocket here; agents are local processes, never pages.
    if (request.headers.origin !== undefined) {
      return { ok: false, status: 403, reason: 'agent connections are not accepted from browsers' }
    }
    const token = BEARER.exec(request.headers.authorization ?? '')?.[1]
    if (token === undefined) return { ok: false, status: 401, reason: 'missing agent token' }
    if (!timingSafeEqual(digest(token), this.agentTokenDigest)) {
      return { ok: false, status: 401, reason: 'agent token mismatch' }
    }
    return { ok: true, role: 'agent' }
  }

  // No Origin means a non-browser client (React Native, Node); only browsers can be driven cross-site.
  private authorizeApp(request: IncomingMessage): UpgradeVerdict {
    const origin = request.headers.origin
    if (origin === undefined) return { ok: true, role: 'app' }
    const parsed = parseOrigin(origin)
    if (parsed && this.isTrustedOrigin(parsed, request.headers.host)) {
      return { ok: true, role: 'app' }
    }
    return {
      ok: false,
      status: 403,
      reason: `origin ${JSON.stringify(origin)} is not allowed; add it to the Genie allowedOrigins option`,
    }
  }

  private isTrustedOrigin(origin: URL, hostHeader: string | undefined): boolean {
    if (this.allowedOrigins.has(origin.origin)) return true
    const hostname = origin.hostname.toLowerCase()
    if (isLoopbackHostname(hostname)) return true
    if (!isSameHost(origin, hostHeader)) return false
    // DNS rebinding can forge a same-origin hostname but never an IP-literal origin.
    return isIP(unbracket(hostname)) !== 0 || this.isAllowedHost(hostname)
  }

  private isAllowedHost(hostname: string): boolean {
    if (this.allowedHosts === true) return true
    return this.allowedHosts.some((allowed) =>
      allowed.startsWith('.')
        ? hostname === allowed.slice(1) || hostname.endsWith(allowed)
        : hostname === allowed,
    )
  }
}

/** Answers a refused upgrade with a plain HTTP status so clients can tell auth failures from an unreachable hub. */
export function rejectUpgrade(socket: Duplex, status: number, reason: string): void {
  const body = `Genie hub: ${reason}\n`
  socket.once('finish', () => socket.destroy())
  socket.end(
    [
      `HTTP/1.1 ${status} ${STATUS_CODES[status] ?? ''}`,
      'Connection: close',
      'Content-Type: text/plain; charset=utf-8',
      `Content-Length: ${Buffer.byteLength(body)}`,
      '',
      body,
    ].join('\r\n'),
  )
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

function normalizeOrigin(origin: string): string {
  const parsed = parseOrigin(origin)
  if (!parsed) throw new TypeError(`genie-react: invalid allowed origin ${JSON.stringify(origin)}`)
  return parsed.origin
}

function parseOrigin(origin: string): URL | null {
  try {
    const parsed = new URL(origin)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null
  } catch {
    return null
  }
}

function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '[::1]') {
    return true
  }
  return isIP(hostname) === 4 && hostname.startsWith('127.')
}

function isSameHost(origin: URL, hostHeader: string | undefined): boolean {
  if (!hostHeader) return false
  try {
    return new URL(`${origin.protocol}//${hostHeader}`).host === origin.host
  } catch {
    return false
  }
}

function unbracket(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
}
