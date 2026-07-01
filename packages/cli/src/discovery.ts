import { readFile } from 'node:fs/promises'
import { dirname, join, parse } from 'node:path'
import { GENIE_DISCOVERY_FILE, GENIE_WS_PATH } from '@genie-react/core'
import { isRecord } from './guards'

export interface BridgeDiscovery {
  url: string
  pid?: number
}

/**
 * The single reader of a `.genie/bridge.json` payload. Parses the raw file text to `unknown` and
 * accepts it only when it is an object carrying a string `url`, so both callers — this module's
 * upward walk and the doctor command in `index.ts` — trust the exact same shape instead of each
 * re-narrowing the JSON divergently.
 */
export function parseBridgeDiscovery(raw: string): BridgeDiscovery | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed) || typeof parsed.url !== 'string') return null
  return {
    url: parsed.url,
    pid: typeof parsed.pid === 'number' ? parsed.pid : undefined,
  }
}

/**
 * Resolves the bridge WebSocket URL. Priority: `GENIE_BRIDGE_URL` env → discovery file written by
 * the Vite plugin → `ws://localhost:<GENIE_BRIDGE_PORT|5173><GENIE_WS_PATH>` default. `localhost`
 * (not a fixed IP) so it connects whether Vite bound IPv4 or IPv6 loopback.
 */
export async function resolveBridgeUrl(cwd: string = process.cwd()): Promise<string> {
  const fromEnv = process.env.GENIE_BRIDGE_URL
  if (fromEnv) return fromEnv

  const fromFile = await readDiscoveryUpward(cwd)
  if (fromFile) return fromFile

  const port = process.env.GENIE_BRIDGE_PORT ?? '5173'
  return `ws://localhost:${port}${GENIE_WS_PATH}`
}

/**
 * Walks up from `startDir` to the filesystem root looking for the discovery file, so `genie call`
 * works from a nested directory or a monorepo root, not only the exact dir the dev server runs in.
 */
async function readDiscoveryUpward(startDir: string): Promise<string | null> {
  const { root } = parse(startDir)
  let dir = startDir
  for (;;) {
    try {
      const raw = await readFile(join(dir, GENIE_DISCOVERY_FILE), 'utf8')
      const discovery = parseBridgeDiscovery(raw)
      if (discovery?.url) return discovery.url
    } catch {
      // not in this dir — keep walking up
    }
    if (dir === root) return null
    dir = dirname(dir)
  }
}
