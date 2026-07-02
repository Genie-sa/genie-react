import { GENIE_CLIENT_PATH, GENIE_DEFAULT_HUB_PORT, GENIE_WS_PATH } from 'genie-react/protocol'

export interface HubOptions {
  port?: number
  cwd?: string
}

/** Runs the standalone hub for Next.js and other non-Vite apps: serves the browser client, accepts WS, writes discovery. */
export async function runHub(options: HubOptions = {}): Promise<number> {
  const { createStandaloneBridge, removeDiscoveryFile, writeDiscoveryFile } = await import(
    'genie-react/hub'
  )
  const cwd = options.cwd ?? process.cwd()
  const port = options.port ?? GENIE_DEFAULT_HUB_PORT
  const handle = createStandaloneBridge()

  let bound: { port: number }
  try {
    bound = await handle.listen(port)
  } catch (error) {
    if (isAddrInUse(error)) {
      process.stderr.write(
        `genie hub: port ${port} is already in use (another hub or dev server?) — pass --port <n>\n`,
      )
      return 1
    }
    throw error
  }

  const url = `ws://localhost:${bound.port}${GENIE_WS_PATH}`
  const clientUrl = `http://localhost:${bound.port}${GENIE_CLIENT_PATH}`
  await writeDiscoveryFile(cwd, { url, port: bound.port })

  const out = (line: string): void => void process.stdout.write(`${line}\n`)
  out(`[genie] hub ready at ${url}`)
  out(`[genie] browser client at ${clientUrl}`)
  out('')
  out('Attach your app (dev only):')
  out("  Next.js / any SSR React root layout:   import { GenieScript } from 'genie-react/next'")
  out('                                         <GenieScript />')
  out(`  anything else, first in <head>:        <script src="${clientUrl}"></script>`)
  out('')
  out('Then drive it: genie status | genie tools | genie call <tool> … (Ctrl-C stops the hub)')

  return new Promise<number>((resolve) => {
    const shutdown = (): void => {
      void (async () => {
        await removeDiscoveryFile(cwd)
        await handle.close()
        resolve(0)
      })()
    }
    process.once('SIGINT', shutdown)
    process.once('SIGTERM', shutdown)
  })
}

function isAddrInUse(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'EADDRINUSE'
  )
}
