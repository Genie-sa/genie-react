import type { AppInfo } from '@genie-react/core'
import { defineCollector, type GenieCollector } from './collector'

/**
 * Always-on collector that reports basic app + React runtime info. Carries no tools — the bridge
 * answers `devtools_status` from the hello payload it contributes.
 */
export function sessionCollector(): GenieCollector {
  return defineCollector({
    meta: { id: 'session', title: 'Session', description: 'App and React runtime info' },
    capabilities: ['session'],
    appInfo: () => {
      const info: Partial<AppInfo> = {}
      if (typeof document !== 'undefined' && document.title) info.name = document.title
      if (typeof location !== 'undefined') info.url = location.href
      const reactVersion = detectReactVersion()
      if (reactVersion) info.reactVersion = reactVersion
      return info
    },
  })
}

interface DevtoolsHook {
  renderers?: Map<number, { version?: string }>
}

function detectReactVersion(): string | undefined {
  const hook = getReactDevtoolsHook()
  if (!hook?.renderers) return undefined
  for (const renderer of hook.renderers.values()) {
    if (renderer.version) return renderer.version
  }
  return undefined
}

/**
 * React DevTools injects this global hook from the extension/backend; it is untyped from our side, so
 * the one cast to the minimal shape we read is isolated to this accessor.
 */
function getReactDevtoolsHook(): DevtoolsHook | undefined {
  return (globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevtoolsHook })
    .__REACT_DEVTOOLS_GLOBAL_HOOK__
}
