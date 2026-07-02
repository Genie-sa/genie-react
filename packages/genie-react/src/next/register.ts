import { GENIE_CLIENT_PATH, GENIE_DEFAULT_HUB_PORT, GENIE_WS_PATH } from '../protocol'

export interface RegisterGenieOptions {
  /** Port for the hub; defaults to GENIE_HUB_PORT, then 4390. */
  port?: number
  /** Directory the discovery file is written to (defaults to the project cwd). */
  rootDir?: string
}

const HUB_FLAG = Symbol.for('genie-react.hub')

/** Starts the standalone hub from Next.js `instrumentation.ts`; no-ops in production, on the edge runtime, and on repeat calls (register() re-runs on Fast Refresh) — the hub loads lazily so this module stays Node-import-free for client/edge bundles. */
export async function registerGenie(options: RegisterGenieOptions = {}): Promise<void> {
  if (readEnv('NODE_ENV') === 'production') return
  if (readEnv('NEXT_RUNTIME') === 'edge') return
  const holder = globalThis as Record<symbol, unknown>
  if (holder[HUB_FLAG]) return
  holder[HUB_FLAG] = true

  const port = options.port ?? envPort() ?? GENIE_DEFAULT_HUB_PORT
  const rootDir = options.rootDir ?? process.cwd()
  const { createStandaloneBridge, writeDiscoveryFile } = await import('genie-react/hub')
  const handle = createStandaloneBridge()
  try {
    const bound = await handle.listen(port)
    holder[HUB_FLAG] = handle
    await writeDiscoveryFile(rootDir, {
      url: `ws://localhost:${bound.port}${GENIE_WS_PATH}`,
      port: bound.port,
    })
    log(`hub ready at ws://localhost:${bound.port}${GENIE_WS_PATH}`)
    log(`<GenieScript /> loads http://localhost:${bound.port}${GENIE_CLIENT_PATH}`)
  } catch (error) {
    if (isAddrInUse(error)) {
      // A previous dev server (or another app) already runs a hub there; reuse it.
      await writeDiscoveryFile(rootDir, { url: `ws://localhost:${port}${GENIE_WS_PATH}`, port })
      log(`port ${port} already in use — assuming an existing genie hub`)
      return
    }
    holder[HUB_FLAG] = undefined
    throw error
  }
}

/** Stops the hub started by registerGenie (test teardown / graceful shutdown). */
export async function stopGenieHub(): Promise<void> {
  const holder = globalThis as Record<symbol, unknown>
  const handle = holder[HUB_FLAG]
  holder[HUB_FLAG] = undefined
  if (isCloseable(handle)) await handle.close()
}

function isCloseable(value: unknown): value is { close: () => Promise<void> } {
  return typeof value === 'object' && value !== null && 'close' in value
}

function isAddrInUse(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'EADDRINUSE'
  )
}

function log(message: string): void {
  console.info(`[genie] ${message}`)
}

function envPort(): number | undefined {
  const raw = readEnv('GENIE_HUB_PORT')
  if (!raw) return undefined
  const port = Number(raw)
  return Number.isInteger(port) && port > 0 ? port : undefined
}

/** `process` is optional here so the module also evaluates cleanly in browser bundles. */
function readEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env
  return env?.[name]
}
