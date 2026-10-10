import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { type IncomingMessage, STATUS_CODES } from 'node:http'
import { BlockList, isIP, isIPv4 } from 'node:net'
import type { Duplex } from 'node:stream'
import { type ConnectionRole, ROLE_QUERY_PARAM } from '../protocol'

export interface UpgradePolicyOptions {
  /** Secret agents must present as `Authorization: Bearer <token>`; generated per hub when omitted. */
  agentToken?: string
  /** Extra browser origins (e.g. `https://app.example.test:8443`) allowed to connect as apps. */
  allowedOrigins?: readonly string[]
  /** Vite-style `server.allowedHosts`: same-origin pages on these hostnames may connect as apps. */
  allowedHosts?: readonly string[] | true
  /** Standalone hubs serve apps from another port: loopback pages on these ports (`true`: any port) may connect as apps. Unset trusts only the server's own origin. */
  loopbackAppPorts?: readonly number[] | true
}

export type UpgradeVerdict =
  | {
      ok: true
      role: ConnectionRole
      /** The browser Origin an app connected from; absent for native and Node clients. */
      origin?: string
      /** Admitted only because the page is on loopback, so any local page on any port could be this session. */
      originUnverified?: true
    }
  | { ok: false; status: 400 | 401 | 403; reason: string }

const BEARER = /^Bearer\s+(\S+)$/i

/** Decides which WebSocket upgrades reach the bridge: agents prove the per-hub token, apps prove a trusted browser origin. */
export class UpgradePolicy {
  readonly agentToken: string
  private readonly agentTokenDigest: Buffer
  private readonly allowedOrigins: ReadonlySet<string>
  private readonly allowedHosts: readonly string[] | true
  private readonly loopbackAppPorts: ReadonlySet<number> | true

  constructor(options: UpgradePolicyOptions = {}) {
    this.agentToken = options.agentToken ?? randomBytes(32).toString('base64url')
    this.agentTokenDigest = digest(this.agentToken)
    this.allowedOrigins = new Set((options.allowedOrigins ?? []).map(normalizeOrigin))
    this.allowedHosts =
      options.allowedHosts === true
        ? true
        : (options.allowedHosts ?? []).map((host) => host.toLowerCase())
    this.loopbackAppPorts =
      options.loopbackAppPorts === true ? true : new Set(options.loopbackAppPorts ?? [])
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
    // The token never leaves this machine, so a LAN peer holding one has stolen it.
    if (!isLoopbackAddress(request.socket?.remoteAddress)) {
      return { ok: false, status: 403, reason: 'agent connections must come from this machine' }
    }
    const token = BEARER.exec(request.headers.authorization ?? '')?.[1]
    if (token === undefined)
      return { ok: false, status: 401, reason: `missing agent token${CLI_SKEW_HINT}` }
    if (!timingSafeEqual(digest(token), this.agentTokenDigest)) {
      return { ok: false, status: 401, reason: `agent token mismatch${CLI_SKEW_HINT}` }
    }
    return { ok: true, role: 'agent' }
  }

  private authorizeApp(request: IncomingMessage): UpgradeVerdict {
    const origin = request.headers.origin
    // Browsers always send Origin, so its absence means a native or Node client, which only a local process may be.
    if (origin === undefined) {
      return isLoopbackAddress(request.socket?.remoteAddress)
        ? { ok: true, role: 'app' }
        : {
            ok: false,
            status: 403,
            reason: 'app connections without an Origin must come from this machine',
          }
    }
    const parsed = parseOrigin(origin)
    const trust = parsed && this.originTrust(parsed, request.headers.host)
    if (parsed && trust) {
      return trust === 'loopback'
        ? { ok: true, role: 'app', origin: parsed.origin, originUnverified: true }
        : { ok: true, role: 'app', origin: parsed.origin }
    }
    return {
      ok: false,
      status: 403,
      reason: `origin ${JSON.stringify(origin)} is not allowed; add it to the Genie allowedOrigins option`,
    }
  }

  private originTrust(origin: URL, hostHeader: string | undefined): 'verified' | 'loopback' | null {
    if (this.allowedOrigins.has(origin.origin)) return 'verified'
    const hostname = origin.hostname.toLowerCase()
    if (isSameHost(origin, hostHeader)) {
      // DNS rebinding can forge a same-origin hostname but never an IP-literal or loopback-name origin.
      const unforgeable = isIP(unbracket(hostname)) !== 0 || isLoopbackHostname(hostname)
      if (unforgeable || this.isAllowedHost(hostname)) return 'verified'
    }
    if (!isLoopbackHostname(hostname)) return null
    if (this.loopbackAppPorts === true) return 'loopback'
    return this.loopbackAppPorts.has(portOf(origin)) ? 'verified' : null
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

const CLI_SKEW_HINT = '; update @genie-react/cli to the same version as genie-react'

const LOOPBACK = new BlockList()
LOOPBACK.addSubnet('127.0.0.0', 8, 'ipv4')
LOOPBACK.addAddress('::1', 'ipv6')

/** True for 127.0.0.0/8, ::1 and their IPv4-mapped forms. */
export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address || isIP(address) === 0) return false
  return LOOPBACK.check(address, isIPv4(address) ? 'ipv4' : 'ipv6')
}

function portOf(origin: URL): number {
  if (origin.port) return Number(origin.port)
  return origin.protocol === 'https:' ? 443 : 80
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
