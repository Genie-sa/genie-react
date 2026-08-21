// React Refresh instrumentation vendored from bippy 0.6.1 (MIT, Aiden Bai), which dropped this entrypoint in 0.7; wrapping the renderer's `scheduleRefresh` covers any react-refresh bundler, and the HMR transport only supplies changed file paths.
import {
  type Fiber,
  type FiberRoot,
  getRDTHook,
  getType,
  onRendererInject,
  type ReactRenderer,
  traverseFiber,
} from 'bippy'
import { normalizeFileName } from 'bippy/source'
import { toUnsubscribe } from './bippy-compat'

const RECONNECT_DELAY_MS = 1_000
/** File paths are only meaningful for the refresh they arrived with; a stale buffer is dropped. */
const FILE_PATH_STALENESS_MS = 10_000
const VITE_WS_TOKEN = /wsToken = "([^"]+)"/
const SOURCE_EXTENSION = /\.(?:tsx|ts|jsx|js|mjs|cjs|css)$/
const NEXT_ROUTE_GROUP = /^(?:\.\/)?\/?\([a-z][a-z0-9-]*\)\//

export interface ReactRefreshUpdate {
  /** Changed files from the bundler's HMR transport; empty when there is no transport or its message has not arrived. */
  filePaths: string[]
  root: FiberRoot
  /** New component types that were remounted, losing state. */
  staleComponents: unknown[]
  /** Mounted fibers whose component types were remounted. */
  staleFibers: Fiber[]
  /** New component types that re-rendered preserving state. */
  updatedComponents: unknown[]
  /** Mounted fibers whose component types re-rendered preserving state. */
  updatedFibers: Fiber[]
}

export type ReactRefreshHandler = (update: ReactRefreshUpdate) => void

interface RendererRefreshUpdate {
  staleFamilies: Set<{ current: unknown }>
  updatedFamilies: Set<{ current: unknown }>
}

export type ScheduleRefresh = (root: FiberRoot, update: RendererRefreshUpdate) => void

/** bippy 0.7 dropped `scheduleRefresh` from its `ReactRenderer` type; react-refresh still installs it. */
export type RefreshCapableRenderer = ReactRenderer & { scheduleRefresh?: ScheduleRefresh }

/** Disposes the transport's socket or patch. */
type Transport = () => void

type FilePathListener = (filePaths: string[]) => void

const isClientEnvironment = (): boolean =>
  !!(
    typeof window !== 'undefined' &&
    (window.document?.createElement || window.navigator?.product === 'ReactNative')
  )

/* ------------------------------------------------------------------ Metro */

const scriptUrlFromSourceCodeModule = (module: unknown): string | null => {
  if (typeof module !== 'object' || !module || !('getConstants' in module)) return null
  const getConstants = module.getConstants
  if (typeof getConstants !== 'function') return null
  let constants: unknown
  try {
    constants = getConstants.call(module)
  } catch {
    return null
  }
  if (typeof constants !== 'object' || !constants || !('scriptURL' in constants)) return null
  const scriptURL = constants.scriptURL
  return typeof scriptURL === 'string' ? scriptURL : null
}

const metroBundleUrl = (): string | null => {
  const turboModuleProxy = (globalThis as { __turboModuleProxy?: (name: string) => unknown })
    .__turboModuleProxy
  if (typeof turboModuleProxy === 'function') {
    let sourceCode: unknown
    try {
      sourceCode = turboModuleProxy('SourceCode')
    } catch {
      sourceCode = null
    }
    const url = scriptUrlFromSourceCodeModule(sourceCode)
    if (url) return url
  }
  const legacy = (globalThis as { nativeModuleProxy?: { SourceCode?: unknown } }).nativeModuleProxy
    ?.SourceCode
  return scriptUrlFromSourceCodeModule(legacy)
}

const metroSourcePath = (sourceURL: string): string | null => {
  let url: URL
  try {
    url = new URL(sourceURL.replace('//&', '?'))
  } catch {
    return null
  }
  let path = decodeURIComponent(url.pathname)
  if (path.startsWith('/')) path = path.slice(1)
  if (path.endsWith('.bundle')) path = path.slice(0, -'.bundle'.length)
  return path.length > 0 ? path : null
}

const collectMetroPaths = (modules: unknown, into: string[]): void => {
  if (!Array.isArray(modules)) return
  for (const entry of modules) {
    if (
      typeof entry !== 'object' ||
      !entry ||
      !('sourceURL' in entry) ||
      typeof entry.sourceURL !== 'string'
    ) {
      continue
    }
    const path = metroSourcePath(entry.sourceURL)
    if (path && !path.includes('node_modules')) into.push(path)
  }
}

const parseMetroMessage = (data: string): string[] => {
  let message: unknown
  try {
    message = JSON.parse(data)
  } catch {
    return []
  }
  if (
    typeof message !== 'object' ||
    !message ||
    !('type' in message) ||
    message.type !== 'update' ||
    !('body' in message) ||
    typeof message.body !== 'object' ||
    message.body === null
  ) {
    return []
  }
  const body = message.body
  if ('isInitialUpdate' in body && body.isInitialUpdate === true) return []
  const paths: string[] = []
  if ('added' in body) collectMetroPaths(body.added, paths)
  if ('modified' in body) collectMetroPaths(body.modified, paths)
  return paths
}

const connectMetro = (onFilePaths: FilePathListener): Transport | null => {
  if (typeof WebSocket === 'undefined') return null
  const bundleUrl = metroBundleUrl()
  if (!bundleUrl) return null
  let endpoint: string
  try {
    const url = new URL(bundleUrl)
    endpoint = `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}/hot`
  } catch {
    return null
  }

  let disposed = false
  let socket: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined

  const reconnect = (): void => {
    if (disposed) return
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
  }

  function connect(): void {
    if (disposed) return
    const next = new WebSocket(endpoint)
    socket = next
    next.onopen = () => {
      next.send(JSON.stringify({ type: 'register-entrypoints', entryPoints: [bundleUrl] }))
    }
    next.onmessage = (event) => {
      const paths = parseMetroMessage(String(event.data))
      if (paths.length > 0) onFilePaths(paths)
    }
    next.onclose = reconnect
  }

  connect()
  return () => {
    disposed = true
    clearTimeout(reconnectTimer)
    if (socket) {
      socket.onclose = null
      socket.close()
    }
  }
}

/* --------------------------------------------------------- Next.js webpack */

const webpackSourcePaths = (moduleIds: string[]): string[] => {
  const paths: string[] = []
  for (const moduleId of moduleIds) {
    if (moduleId.includes('node_modules')) continue
    let path = normalizeFileName(moduleId).replace(NEXT_ROUTE_GROUP, '')
    if (path.startsWith('./')) path = path.slice(2)
    if (SOURCE_EXTENSION.test(path)) paths.push(path)
  }
  return paths
}

type WebpackHotUpdate = (chunkId: unknown, moreModules: unknown, runtime: unknown) => void

const connectWebpack = (onFilePaths: FilePathListener): Transport | null => {
  if (typeof window === 'undefined') return null
  const target = window as unknown as { webpackHotUpdate_N_E?: WebpackHotUpdate }
  const original = target.webpackHotUpdate_N_E
  if (typeof original !== 'function') return null

  const patched: WebpackHotUpdate = (chunkId, moreModules, runtime) => {
    const paths = webpackSourcePaths(Object.keys((moreModules as object) ?? {}))
    if (paths.length > 0) onFilePaths(paths)
    original(chunkId, moreModules, runtime)
  }
  target.webpackHotUpdate_N_E = patched

  return () => {
    if (target.webpackHotUpdate_N_E === patched) target.webpackHotUpdate_N_E = original
  }
}

/* ------------------------------------------------------------------- Vite */

const parseViteMessage = (data: string): string[] => {
  let message: unknown
  try {
    message = JSON.parse(data)
  } catch {
    return []
  }
  if (
    typeof message !== 'object' ||
    !message ||
    !('type' in message) ||
    message.type !== 'update' ||
    !('updates' in message) ||
    !Array.isArray(message.updates)
  ) {
    return []
  }
  const paths: string[] = []
  for (const update of message.updates) {
    if (
      typeof update === 'object' &&
      update &&
      'type' in update &&
      update.type === 'js-update' &&
      'acceptedPath' in update &&
      typeof update.acceptedPath === 'string'
    ) {
      paths.push(update.acceptedPath)
    }
  }
  return paths
}

const fetchViteWsToken = async (): Promise<string | null> => {
  try {
    const response = await fetch('/@vite/client')
    if (!response.ok) return null
    return VITE_WS_TOKEN.exec(await response.text())?.[1] ?? null
  } catch {
    return null
  }
}

const connectVite = async (onFilePaths: FilePathListener): Promise<Transport | null> => {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return null
  const token = await fetchViteWsToken()
  if (!token) return null

  let disposed = false
  let socket: WebSocket | null = null
  let reconnectTimer: number | undefined

  const reconnect = (): void => {
    if (disposed) return
    reconnectTimer = window.setTimeout(() => {
      fetchViteWsToken().then((next) => {
        if (disposed) return
        if (next) connect(next)
        else reconnect()
      })
    }, RECONNECT_DELAY_MS)
  }

  function connect(wsToken: string): void {
    if (disposed) return
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
    const next = new WebSocket(`${protocol}://${location.host}/?token=${wsToken}`, 'vite-hmr')
    socket = next
    next.onmessage = (event) => {
      const paths = parseViteMessage(String(event.data))
      if (paths.length > 0) onFilePaths(paths)
    }
    next.onclose = reconnect
  }

  connect(token)
  return () => {
    disposed = true
    window.clearTimeout(reconnectTimer)
    if (socket) {
      socket.onclose = null
      socket.close()
    }
  }
}

const connectHmrTransport = async (onFilePaths: FilePathListener): Promise<Transport | null> => {
  if (!isClientEnvironment()) return null
  return (
    connectWebpack(onFilePaths) ?? connectMetro(onFilePaths) ?? (await connectVite(onFilePaths))
  )
}

/* ------------------------------------------------------------ refresh wiring */

const mountedFibersOfTypes = (root: FiberRoot, types: Set<unknown>): Fiber[] => {
  if (types.size === 0 || !root.current) return []
  const matches: Fiber[] = []
  traverseFiber(root.current, (fiber) => {
    if (types.has(fiber.type) || types.has(getType(fiber.type))) matches.push(fiber)
  })
  return matches
}

const handlers = new Set<ReactRefreshHandler>()
const wrappedRenderers = new WeakSet<object>()

let bufferedFilePaths: string[] = []
let bufferedAt = 0

const bufferFilePaths = (filePaths: string[]): void => {
  const now = Date.now()
  if (now - bufferedAt > FILE_PATH_STALENESS_MS) bufferedFilePaths = []
  bufferedFilePaths.push(...filePaths)
  bufferedAt = now
}

const takeFilePaths = (): string[] => {
  if (Date.now() - bufferedAt > FILE_PATH_STALENESS_MS) return []
  const paths = [...bufferedFilePaths]
  queueMicrotask(() => {
    bufferedFilePaths = []
  })
  return paths
}

const wrapRenderer = (renderer: RefreshCapableRenderer): void => {
  if (wrappedRenderers.has(renderer)) return
  const original = renderer.scheduleRefresh
  if (typeof original !== 'function') return
  wrappedRenderers.add(renderer)

  renderer.scheduleRefresh = (root, update) => {
    original.call(renderer, root, update)
    if (handlers.size === 0) return
    const staleComponents = Array.from(update.staleFamilies, (family) => family.current)
    const updatedComponents = Array.from(update.updatedFamilies, (family) => family.current)
    const refresh: ReactRefreshUpdate = {
      filePaths: takeFilePaths(),
      root,
      staleComponents,
      staleFibers: mountedFibersOfTypes(root, new Set(staleComponents)),
      updatedComponents,
      updatedFibers: mountedFibersOfTypes(root, new Set(updatedComponents)),
    }
    for (const handler of handlers) handler(refresh)
  }
}

let renderersWrapped = false

const wrapAllRenderers = (): void => {
  if (renderersWrapped) return
  renderersWrapped = true
  const hook = getRDTHook()
  for (const renderer of hook.renderers.values()) wrapRenderer(renderer)
  onRendererInject(wrapRenderer)
}

let transport: Transport | null = null

const startTransport = (): void => {
  connectHmrTransport(bufferFilePaths).then((next) => {
    if (!next) return
    transport?.()
    transport = next
  })
}

/** Subscribes to react-refresh updates; returns a `Disposable` unsubscribe that no-ops outside client environments. */
export const instrumentReactRefresh = (options: {
  onRefresh?: ReactRefreshHandler
}): (() => void) & Disposable => {
  const { onRefresh } = options
  if (!onRefresh || !isClientEnvironment()) return toUnsubscribe(() => {})
  wrapAllRenderers()
  if (handlers.size === 0) startTransport()
  handlers.add(onRefresh)
  return toUnsubscribe(() => {
    handlers.delete(onRefresh)
  })
}
