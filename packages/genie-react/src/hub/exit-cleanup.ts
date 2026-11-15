import { removeDiscoveryFileSync } from './discovery'

const TERMINATING_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const

/** Removes this process's discovery and token files for `rootDir` however the dev server ends: on `process.exit`, and on a terminating signal. The signal listener runs first; when nothing else handles the signal it re-raises it after cleanup, so the process still ends the way it would have. Returns the function that unregisters it. */
export function removeDiscoveryOnExit(rootDir: string): () => void {
  const cleanUp = (): void => removeDiscoveryFileSync(rootDir)
  const onSignal = (signal: NodeJS.Signals): void => {
    const othersHandle = process.listenerCount(signal) > 1
    unregister()
    cleanUp()
    if (!othersHandle) process.kill(process.pid, signal)
  }
  const unregister = (): void => {
    process.off('exit', cleanUp)
    for (const signal of TERMINATING_SIGNALS) process.off(signal, onSignal)
  }
  process.once('exit', cleanUp)
  for (const signal of TERMINATING_SIGNALS) process.prependListener(signal, onSignal)
  return unregister
}
