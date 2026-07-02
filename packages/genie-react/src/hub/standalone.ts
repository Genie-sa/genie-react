import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer, type Server, type ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GENIE_CLIENT_PATH, GENIE_INFO_PATH, GENIE_WS_PATH } from '../protocol'
import { GenieBridge, type GenieBridgeOptions } from './bridge'

export interface StandaloneBridgeOptions extends GenieBridgeOptions {
  /** Overrides the browser bundle served at GENIE_CLIENT_PATH (defaults to the packaged client.global.js). */
  clientBundlePath?: string
  /** App root this hub belongs to, reported on GENIE_INFO_PATH so a second hub can tell reuse from a collision. */
  rootDir?: string
}

export interface StandaloneBridgeHandle {
  bridge: GenieBridge
  server: Server
  listen: (port?: number, host?: string) => Promise<{ port: number; host: string; url: string }>
  close: () => Promise<void>
}

/** Runs the hub on its own HTTP server (`genie hub`, Next.js instrumentation, tests); Vite embeds it via `genie-react/vite` instead. */
export function createStandaloneBridge(options?: StandaloneBridgeOptions): StandaloneBridgeHandle {
  const bridge = new GenieBridge(options)
  const clientBundlePath = options?.clientBundlePath ?? defaultClientBundlePath()
  const rootDir = options?.rootDir ?? process.cwd()
  const server = createServer((req, res) => {
    const path = req.url?.split('?')[0] ?? ''
    if (req.method === 'GET' && path === GENIE_CLIENT_PATH) {
      void serveClientBundle(res, clientBundlePath)
      return
    }
    if (req.method === 'GET' && path === GENIE_INFO_PATH) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ genie: true, rootDir, pid: process.pid }))
      return
    }
    res.writeHead(426, { 'content-type': 'text/plain' })
    res.end(`Genie hub: WebSocket on ${GENIE_WS_PATH}, browser client on ${GENIE_CLIENT_PATH}`)
  })
  server.on('upgrade', (request, socket, head) => {
    if (!bridge.handleUpgrade(request, socket, head)) socket.destroy()
  })

  return {
    bridge,
    server,
    listen: (port = 0, host = '127.0.0.1') =>
      new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, host, () => {
          const address = server.address()
          if (address === null || typeof address === 'string') {
            reject(new Error('bridge not bound to a TCP port'))
            return
          }
          resolve({ port: address.port, host, url: `ws://${host}:${address.port}${GENIE_WS_PATH}` })
        })
      }),
    close: () =>
      new Promise((resolve) => {
        bridge.close()
        server.close(() => resolve())
      }),
  }
}

// Bundlers (Next/Turbopack) inline this module and snapshot URL assets, so prefer the installed package's live dist.
function defaultClientBundlePath(): string {
  return (
    installedClientBundlePath() ??
    fileURLToPath(new URL('./client.global.iife.js', import.meta.url))
  )
}

function installedClientBundlePath(): string | null {
  try {
    const require = createRequire(join(process.cwd(), 'package.json'))
    const packageJson = require.resolve('genie-react/package.json')
    const candidate = join(dirname(packageJson), 'dist', 'client.global.iife.js')
    return existsSync(candidate) ? candidate : null
  } catch {
    return null
  }
}

async function serveClientBundle(res: ServerResponse, path: string): Promise<void> {
  try {
    const bundle = await readFile(path)
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' })
    res.end(bundle)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('Genie client bundle not found — build genie-react (dist/client.global.js) first')
  }
}
