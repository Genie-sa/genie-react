import {
  GENIE_CLIENT_PATH,
  GENIE_DEFAULT_HUB_PORT,
  GENIE_INFO_PATH,
  GENIE_WS_PATH,
} from '../protocol'
import { writeDiscoveryFile } from './discovery'
import { createStandaloneBridge, type StandaloneBridgeHandle } from './standalone'

export interface StartHubOptions {
  /** App root the hub belongs to; discovery is written here (defaults to cwd). */
  rootDir?: string
  /** Preferred port (default 4390). With `strictPort` the exact port is required; otherwise busy ports walk upward. */
  port?: number
  strictPort?: boolean
  /** How many consecutive ports to try when walking (default 10). */
  portAttempts?: number
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

/** Multi-session-safe startup shared by `genie hub` and Next.js instrumentation: a busy port occupied by THIS app's hub is reused, any foreign occupant makes the port walk upward — several agents and apps never cross-connect. */
export async function startGenieHub(options: StartHubOptions = {}): Promise<StartHubResult> {
  const rootDir = options.rootDir ?? process.cwd()
  const preferred = options.port ?? GENIE_DEFAULT_HUB_PORT
  const attempts = options.strictPort ? 1 : (options.portAttempts ?? 10)

  for (let offset = 0; offset < attempts; offset++) {
    const port = preferred + offset
    const handle = createStandaloneBridge({ rootDir })
    try {
      const bound = await handle.listen(port)
      await writeDiscoveryFile(rootDir, { url: hubUrl(bound.port), port: bound.port })
      return { status: 'started', handle, port: bound.port, ...urls(bound.port) }
    } catch (error) {
      await handle.close()
      if (!isAddrInUse(error)) throw error
      const occupant = await probeHubInfo(port)
      if (occupant?.rootDir === rootDir) {
        await writeDiscoveryFile(rootDir, { url: hubUrl(port), port })
        return { status: 'reused', port, ...urls(port) }
      }
    }
  }
  throw new Error(
    attempts === 1
      ? `genie-react hub: port ${preferred} is busy — another app's hub or process owns it`
      : `genie-react hub: no free port in ${preferred}–${preferred + attempts - 1}`,
  )
}

/** Identifies who occupies a port: a genie hub answers GENIE_INFO_PATH with its rootDir; anything else is foreign. */
async function probeHubInfo(port: number): Promise<{ rootDir: string } | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}${GENIE_INFO_PATH}`, {
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

function hubUrl(port: number): string {
  return `ws://localhost:${port}${GENIE_WS_PATH}`
}

function urls(port: number): { url: string; clientUrl: string } {
  return { url: hubUrl(port), clientUrl: `http://localhost:${port}${GENIE_CLIENT_PATH}` }
}

function isAddrInUse(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'EADDRINUSE'
  )
}
