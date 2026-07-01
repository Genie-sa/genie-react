/**
 * A defensive tap over the TanStack DevTools client-side event bus.
 *
 * TanStack DevTools is alpha and its event-client class API (`EventClient.onAll`/`emit`)
 * is in flux, so we bind to the underlying wire protocol instead: every plugin's traffic
 * is re-broadcast on the `tanstack-devtools-global` channel of the shared event target, and
 * dispatching on `tanstack-dispatch-event` feeds an event back through the bus to all plugins.
 * Channel names mirror @tanstack/devtools-event-bus and @tanstack/devtools-event-client. Nothing
 * here throws: when no bus (or no DOM) is present every operation degrades to a no-op.
 */

const GLOBAL_CHANNEL = 'tanstack-devtools-global'
const DISPATCH_CHANNEL = 'tanstack-dispatch-event'

export interface DevtoolsBusEvent {
  type: string
  payload?: unknown
  pluginId?: string
}

declare global {
  /**
   * Injected by @tanstack/devtools-event-bus: the shared event target that re-broadcasts every
   * plugin's traffic on `tanstack-devtools-global` and feeds `tanstack-dispatch-event` back through
   * the bus. Absent (`undefined`) when no DevTools bus — or no DOM — is present.
   */
  var __TANSTACK_EVENT_TARGET__: EventTarget | undefined
}

/** Runtime guard so a foreign `detail` on the bus channel can't masquerade as a plugin event. */
function isDevtoolsBusEvent(value: unknown): value is DevtoolsBusEvent {
  return (
    typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
  )
}

function resolveBusTarget(): EventTarget | null {
  try {
    const injected = globalThis.__TANSTACK_EVENT_TARGET__
    if (injected && typeof injected.addEventListener === 'function') return injected
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      return window
    }
  } catch {
    return null
  }
  return null
}

export function subscribeToDevtoolsBus(onEvent: (event: DevtoolsBusEvent) => void): () => void {
  const target = resolveBusTarget()
  if (!target) return () => {}

  const handler = (event: Event) => {
    try {
      // Read `detail` off any event carrying one (incl. cross-realm CustomEvents, where `instanceof`
      // fails) via `in`-narrowing — no cast — then let isDevtoolsBusEvent vouch for the shape.
      const detail: unknown = 'detail' in event ? event.detail : undefined
      if (isDevtoolsBusEvent(detail)) onEvent(detail)
    } catch {}
  }

  try {
    target.addEventListener(GLOBAL_CHANNEL, handler)
  } catch {
    return () => {}
  }

  return () => {
    try {
      target.removeEventListener(GLOBAL_CHANNEL, handler)
    } catch {}
  }
}

/** Only the genuine injected bus — never the window fallback — so emits can't falsely report success. */
function resolveRealBus(): EventTarget | null {
  try {
    const injected = globalThis.__TANSTACK_EVENT_TARGET__
    if (injected && typeof injected.dispatchEvent === 'function') return injected
  } catch {
    return null
  }
  return null
}

export function emitToDevtoolsBus(event: DevtoolsBusEvent): boolean {
  // Dispatch only to a real TanStack DevTools bus; the boolean reflects whether a bus was present,
  // not dispatchEvent's defaultPrevented status (which is true even when nothing is listening).
  const target = resolveRealBus()
  if (!target || typeof CustomEvent === 'undefined') return false
  try {
    target.dispatchEvent(new CustomEvent(DISPATCH_CHANNEL, { detail: event }))
    return true
  } catch {
    return false
  }
}

export function pluginIdFromEvent(event: DevtoolsBusEvent): string {
  if (event.pluginId) return event.pluginId
  const separator = event.type.indexOf(':')
  return separator > 0 ? event.type.slice(0, separator) : 'unknown'
}
