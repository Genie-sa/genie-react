import { writeJson } from './cli-output'

export interface HubOptions {
  port?: number
  cwd?: string
  maxBytes?: number
}

export async function runHub(options: HubOptions = {}): Promise<number> {
  const { removeDiscoveryFile, startGenieHub } = await import('genie-react/hub')
  const cwd = options.cwd ?? process.cwd()
  const failure = (reason: string, message: string): void => {
    writeJson(
      {
        schemaVersion: '1.0',
        status: 'error',
        reason,
        message,
        userActionRequired: true,
        next: { command: 'genie-react doctor', argv: ['genie-react', 'doctor'] },
      },
      options.maxBytes,
    )
  }
  let result: Awaited<ReturnType<typeof startGenieHub>>
  try {
    result = await startGenieHub({
      rootDir: cwd,
      port: options.port,
      strictPort: options.port !== undefined,
    })
  } catch {
    failure(
      'hub_start_failed',
      'Failed to start the local hub. Check port availability and project directory permissions.',
    )
    return 1
  }
  const data = { cwd, port: result.port, url: result.url, clientUrl: result.clientUrl }
  const emit = (event: 'ready' | 'reused' | 'stopped'): void => {
    writeJson(
      {
        schemaVersion: '1.0',
        status: 'ok',
        event,
        reason: `hub_${event}`,
        message: event === 'stopped' ? 'Stopped the local hub.' : 'The local hub is available.',
        userActionRequired: false,
        data,
        ...(event === 'stopped'
          ? {}
          : { next: { command: 'genie-react status', argv: ['genie-react', 'status'] } }),
      },
      options.maxBytes,
    )
  }
  if (result.status === 'reused') {
    emit('reused')
    return 0
  }
  const { handle } = result
  return new Promise<number>((resolve) => {
    let stopping = false
    const shutdown = (): void => {
      if (stopping) return
      stopping = true
      void (async () => {
        const results = await Promise.allSettled([removeDiscoveryFile(cwd), handle.close()])
        process.removeListener('SIGINT', shutdown)
        process.removeListener('SIGTERM', shutdown)
        if (results.some((result) => result.status === 'rejected')) {
          failure(
            'hub_stop_failed',
            'Failed to fully stop the local hub. Inspect the project discovery file and listening port.',
          )
          resolve(1)
        } else {
          emit('stopped')
          resolve(0)
        }
      })()
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
    emit('ready')
  })
}
