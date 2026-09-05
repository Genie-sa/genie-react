import { z } from 'zod'
import { defineGenieTool } from '../app-tools'

export interface NavigationState {
  key?: string
  type?: string
  index?: number
  routes: readonly { key?: string; name: string; state?: NavigationState }[]
}

export interface NavigationAdapter {
  getState(): NavigationState | undefined
  /** Match the complete current href, including parameters, using the app's routing rules. */
  isCurrentHref(href: string): boolean
  router: {
    push(href: string): void
    replace(href: string): void
    navigate(href: string): void
    dismissTo(href: string): void
    back(): void
    canGoBack(): boolean
  }
}

const routeSchema = z.object({ key: z.string(), name: z.string() })
const snapshotSchema = z.object({
  currentRoute: routeSchema.nullable(),
  activeRoutePath: z.array(routeSchema),
  stackDepth: z.number().int().nonnegative(),
  stackKey: z.string().nullable(),
  stackRoutes: z.array(routeSchema),
  stackScope: z.literal('deepest-active-stack'),
})
const resultSchema = snapshotSchema.extend({
  settled: z.boolean(),
  reason: z.enum([
    'transition-end',
    'no-op',
    'timeout',
    'disposed',
    'transition-in-progress',
    'previous-navigation-unsettled',
    'queue-full',
    'unavailable',
    'dispatch-error',
  ]),
  error: z.string().optional(),
})
type Snapshot = z.infer<typeof snapshotSchema>
type Result = z.infer<typeof resultSchema>
type Mode = 'navigate' | 'push' | 'replace' | 'dismiss_to'
type TransitionEvent = { target?: string; data?: { closing?: boolean } }

function snapshot(state: NavigationState | undefined): Snapshot {
  const activeRoutePath: { key: string; name: string }[] = []
  let current = state
  let stack: NavigationState | undefined
  let route: NavigationState['routes'][number] | undefined
  const visited = new Set<NavigationState>()
  while (current && !visited.has(current) && visited.size < 50) {
    visited.add(current)
    if (current.type === 'stack') stack = current
    route = current.routes[current.index ?? 0]
    if (!route?.key) {
      route = undefined
      break
    }
    if (route) activeRoutePath.push({ key: route.key, name: route.name })
    current = route?.state
  }
  return {
    activeRoutePath,
    currentRoute: !current && route?.key ? { key: route.key, name: route.name } : null,
    stackDepth: stack?.routes.length ?? 0,
    stackKey: stack?.key ?? null,
    stackRoutes: stack?.routes.flatMap(({ key, name }) => (key ? [{ key, name }] : [])) ?? [],
    stackScope: 'deepest-active-stack',
  }
}

/** App-owned navigation tools whose success follows native-stack transition events. */
export function createNavigationTools(adapter: NavigationAdapter) {
  const transitioning = new Set<string>()
  let disposed = false
  let queued = 0
  let tail = Promise.resolve()
  let active: {
    before: Snapshot
    ended: Map<string, boolean>
    resolve: ((value: Result) => void) | null
    timer: ReturnType<typeof setTimeout>
  } | null = null

  const read = () => snapshot(adapter.getState())
  const result = (reason: Result['reason'], settled = false): Result => ({
    ...read(),
    settled,
    reason,
  })
  const checkCompletion = () => {
    if (!active || transitioning.size > 0) return
    const current = read()
    const changed =
      current.activeRoutePath.map((route) => route.key).join('\0') !==
        active.before.activeRoutePath.map((route) => route.key).join('\0') ||
      current.stackRoutes.map((route) => route.key).join('\0') !==
        active.before.stackRoutes.map((route) => route.key).join('\0')
    if (!changed) return
    const opened = current.activeRoutePath.some((route) => active?.ended.get(route.key) === false)
    const closed = active.before.activeRoutePath.some(
      (route) =>
        active?.ended.get(route.key) === true &&
        !current.activeRoutePath.some((currentRoute) => currentRoute.key === route.key),
    )
    if (!opened && !closed) return
    const pending = active
    active = null
    clearTimeout(pending.timer)
    pending.resolve?.({ ...current, settled: true, reason: 'transition-end' })
  }
  const screenListeners = {
    state: () => checkCompletion(),
    transitionStart: (event: TransitionEvent) => {
      if (event.target) transitioning.add(event.target)
    },
    transitionEnd: (event: TransitionEvent) => {
      if (!event.target) return
      transitioning.delete(event.target)
      active?.ended.set(event.target, event.data?.closing === true)
      checkCompletion()
    },
  }

  function enqueue(action: () => void, noOp: () => boolean, timeoutMs: number): Promise<Result> {
    if (disposed) return Promise.resolve(result('disposed'))
    if (queued >= 32) return Promise.resolve(result('queue-full'))
    const deadline = Date.now() + timeoutMs
    queued += 1
    const pending = tail.then(async (): Promise<Result> => {
      queued -= 1
      if (disposed) return result('disposed')
      if (Date.now() >= deadline) return result('timeout')
      if (active) return result('previous-navigation-unsettled')
      if (transitioning.size > 0) return result('transition-in-progress')
      const before = read()
      if (!before.currentRoute || before.stackKey === null) return result('unavailable')
      if (noOp()) return result('no-op', true)
      return new Promise<Result>((resolve) => {
        const timer = setTimeout(
          () => {
            if (!active) return
            const complete = active.resolve
            active.resolve = null
            complete?.(result('timeout'))
          },
          Math.max(0, deadline - Date.now()),
        )
        active = { before, ended: new Map(), resolve, timer }
        try {
          action()
        } catch (error) {
          clearTimeout(timer)
          active = null
          resolve({
            ...result('dispatch-error'),
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })
    })
    tail = pending.then(
      () => undefined,
      () => undefined,
    )
    return new Promise<Result>((resolve, reject) => {
      const callerTimer = setTimeout(
        () => resolve(result('timeout')),
        Math.max(0, deadline - Date.now()),
      )
      pending.then(
        (value) => {
          clearTimeout(callerTimer)
          resolve(value)
        },
        (error) => {
          clearTimeout(callerTimer)
          reject(error)
        },
      )
    })
  }

  const timeout = z.number().int().min(1).max(15_000).default(5_000)
  const navigate = ({ href, mode, timeoutMs }: { href: string; mode: Mode; timeoutMs: number }) =>
    enqueue(
      () => (mode === 'dismiss_to' ? adapter.router.dismissTo(href) : adapter.router[mode](href)),
      () => (mode === 'navigate' || mode === 'dismiss_to') && adapter.isCurrentHref(href),
      timeoutMs,
    )
  const back = ({ timeoutMs }: { timeoutMs: number }) =>
    enqueue(
      () => adapter.router.back(),
      () => !adapter.router.canGoBack(),
      timeoutMs,
    )
  const tools = [
    defineGenieTool({
      name: 'navigate',
      kind: 'action',
      description:
        'Navigate and return the resulting route and deepest active stack depth after a native transitionEnd. Explicit push can add duplicate screens. An unsettled result must not be treated as successful navigation or blindly retried.',
      input: z.object({
        href: z.string().min(1),
        mode: z.enum(['navigate', 'push', 'replace', 'dismiss_to']).default('navigate'),
        timeoutMs: timeout,
      }),
      output: resultSchema,
      handler: navigate,
    }),
    defineGenieTool({
      name: 'navigation_state',
      kind: 'query',
      description:
        'Read the current leaf route and deepest active stack. This snapshot does not establish that a native transition has completed.',
      output: snapshotSchema.extend({
        transitioning: z.boolean(),
        unsettledNavigation: z.boolean(),
      }),
      handler: () => ({
        ...read(),
        transitioning: transitioning.size > 0,
        unsettledNavigation: active !== null,
      }),
    }),
    defineGenieTool({
      name: 'navigate_back',
      kind: 'action',
      description:
        'Go back and return the resulting route and stack depth after the native transition completes. Returns a no-op when the router cannot go back.',
      input: z.object({ timeoutMs: timeout }),
      output: resultSchema,
      handler: back,
    }),
  ]
  return {
    tools,
    screenListeners,
    dispose() {
      disposed = true
      if (active) {
        clearTimeout(active.timer)
        active.resolve?.(result('disposed'))
        active = null
      }
      transitioning.clear()
    },
  }
}
