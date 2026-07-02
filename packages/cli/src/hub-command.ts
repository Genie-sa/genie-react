import { GENIE_DEFAULT_HUB_PORT } from 'genie-react/protocol'

export interface HubOptions {
  port?: number
  cwd?: string
}

/** Runs the standalone hub for Next.js and other non-Vite apps; a busy default port walks upward, an explicit --port is strict, and a hub already serving this app is reported instead of duplicated. */
export async function runHub(options: HubOptions = {}): Promise<number> {
  const { removeDiscoveryFile, startGenieHub } = await import('genie-react/hub')
  const cwd = options.cwd ?? process.cwd()
  const out = (line: string): void => void process.stdout.write(`${line}\n`)

  let result: Awaited<ReturnType<typeof startGenieHub>>
  try {
    result = await startGenieHub({
      rootDir: cwd,
      port: options.port,
      strictPort: options.port !== undefined,
    })
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }

  if (result.status === 'reused') {
    out(`[genie] hub for this app is already running at ${result.url}`)
    out(`[genie] browser client at ${result.clientUrl}`)
    return 0
  }

  const scriptTag =
    result.port === GENIE_DEFAULT_HUB_PORT
      ? '<GenieScript />'
      : `<GenieScript port={${result.port}} />`
  out(`[genie] hub ready at ${result.url}`)
  out(`[genie] browser client at ${result.clientUrl}`)
  out('')
  out('Attach your app (dev only):')
  out("  Next.js / any SSR React root layout:   import { GenieScript } from 'genie-react/next'")
  out(`                                         ${scriptTag}`)
  out(`  anything else, first in <head>:        <script src="${result.clientUrl}"></script>`)
  out('')
  out('Then drive it: genie status | genie tools | genie call <tool> … (Ctrl-C stops the hub)')

  const { handle } = result
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
