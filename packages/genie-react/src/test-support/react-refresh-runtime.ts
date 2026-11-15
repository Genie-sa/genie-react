import { createRequire } from 'node:module'

interface RefreshRuntime {
  injectIntoGlobalHook(globalObject: typeof globalThis): void
  register(type: unknown, id: string): void
  setSignature(type: unknown, key: string): void
  performReactRefresh(): unknown
}

const require = createRequire(import.meta.url)

/** Side-effect import: must load after Genie's hook and before react-dom so React injects its refresh helpers. */
export const refreshRuntime = require('react-refresh/runtime') as RefreshRuntime
refreshRuntime.injectIntoGlobalHook(globalThis)
