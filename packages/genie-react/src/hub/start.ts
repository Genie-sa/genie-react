import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  GENIE_CLIENT_PATH,
  GENIE_DEFAULT_HUB_PORT,
  GENIE_DISCOVERY_FILE,
  GENIE_INFO_PATH,
} from '../protocol'
import { bridgeUrlFor, isPidAlive, writeDiscoveryFile } from './discovery'
import { createStandaloneBridge, type StandaloneBridgeHandle } from './standalone'

const HUB_HOST = '127.0.0.1'

export interface StartHubOptions {
  /** App root the hub belongs to; discovery is written here (defaults to cwd). */
  rootDir?: string
  /** Preferred port (default 4390). With `strictPort` the exact port is required; otherwise busy ports walk upward. */
  port?: number
  strictPort?: boolean
  /** How many consecutive ports to try when walking (default 10). */
  portAttempts?: number
  /** Browser origins allowed to connect as apps beyond loopback pages; `GENIE_ALLOWED_ORIGINS` (comma-separated) adds more. */
  allowedOrigins?: readonly string[]
  /** Ports the app's loopback pages are served from; unset trusts loopback pages on any port. */
  loopbackAppPorts?: readonly number[]
}

export type StartHubResult =
  | {
      status: 'started'
      handle: StandaloneBridgeHandle
      port: number
      url: string
      clientUrl: string
    }
  | { status: 'reused'; port: number; url: string; clientUrl: string }

/** No port in the requested range could be bound; `code` lets callers report it without parsing the message. */
export class HubPortBusyError extends Error {
  readonly code = 'port_busy'

  constructor(message: string) {
    super(message)
    this.name = 'HubPortBusyError'
  }
}

/** Multi-session-safe startup shared by `genie hub` and Next.js instrumentation: a busy port occupied by THIS app's hub is reused, any foreign occupant makes the port walk upward — several agents and apps never cross-connect. */
export async function startGenieHub(options: StartHubOptions = {}): Promise<StartHubResult> {
  const rootDir = options.rootDir ?? process.cwd()
  const preferred = options.port ?? GENIE_DEFAULT_HUB_PORT
  const attempts = options.strictPort ? 1 : (options.portAttempts ?? 10)
  const allowedOrigins = [...(options.allowedOrigins ?? []), ...envAllowedOrigins()]

  // A live hub for this root may sit on any port (an explicit --port, or a walked one); starting a second would overwrite its discovery and orphan it.
  const livePort = await liveHubPort(rootDir)
  if (livePort !== null) return { status: 'reused', port: livePort, ...urls(HUB_HOST, livePort) }

  for (let offset = 0; offset < attempts; offset++) {
    const port = preferred + offset
    const handle = createStandaloneBridge({
      rootDir,
      allowedOrigins,
      loopbackAppPorts: options.loopbackAppPorts,
    })
    try {
      const bound = await handle.listen(port, HUB_HOST)
      const published = urls(bound.host, bound.port)
      await writeDiscoveryFile(rootDir, {
        url: published.url,
        port: bound.port,
        token: handle.bridge.agentToken,
      })
      return { status: 'started', handle, port: bound.port, ...published }
    } catch (error) {
      await handle.close()
      if (!isAddrInUse(error)) throw error
      const occupant = await probeHubInfo(port)
      // The owning hub already wrote discovery with its token; rewriting it here would publish this process's pid and no token.
      if (occupant?.rootDir === rootDir) return { status: 'reused', port, ...urls(HUB_HOST, port) }
    }
  }
  throw new HubPortBusyError(
    attempts === 1
      ? `genie-react hub: port ${preferred} is busy — another app's hub or process owns it`
      : `genie-react hub: no free port in ${preferred}–${preferred + attempts - 1}`,
  )
}

async function liveHubPort(rootDir: string): Promise<number | null> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(join(rootDir, GENIE_DISCOVERY_FILE), 'utf8'))
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const port = 'port' in parsed ? parsed.port : undefined
  const pid = 'pid' in parsed ? parsed.pid : undefined
  if (typeof port !== 'number' || typeof pid !== 'number' || !isPidAlive(pid)) return null
  const occupant = await probeHubInfo(port)
  return occupant?.rootDir === rootDir ? port : null
}

/** Identifies who occupies a port: a genie hub answers GENIE_INFO_PATH with its rootDir; anything else is foreign. */
async function probeHubInfo(port: number): Promise<{ rootDir: string } | null> {
  try {
    const response = await fetch(`http://${HUB_HOST}:${port}${GENIE_INFO_PATH}`, {
      signal: AbortSignal.timeout(500),
    })
    if (!response.ok) return null
    const body: unknown = await response.json()
    if (
      typeof body === 'object' &&
      body !== null &&
      'genie' in body &&
      body.genie === true &&
      'rootDir' in body &&
      typeof body.rootDir === 'string'
    ) {
      return { rootDir: body.rootDir }
    }
    return null
  } catch {
    return null
  }
}

function envAllowedOrigins(): string[] {
  return (process.env.GENIE_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '')
}

function urls(host: string, port: number): { url: string; clientUrl: string } {
  return {
    url: bridgeUrlFor(host, port),
    clientUrl: `http://${host}:${port}${GENIE_CLIENT_PATH}`,
  }
}

function isAddrInUse(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'EADDRINUSE'
  )
}
