import type { Fiber } from 'bippy'
import type { HooksNode } from 'bippy/source'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getSource = vi.fn(async (fiber: { _debugSource?: unknown }) => fiber._debugSource ?? null)
const getFiberHooks = vi.fn<(fiber: unknown) => HooksNode[]>(() => [])
const formatOwnerStack = vi.fn((stack: string) => stack)
const parseStack = vi.fn<(stack: string) => unknown[]>(() => [])
// Mirrors bippy's contract — fetch via the caller's fetchFn and decode the inline map — so tests drive lookups through the fetch mock.
const decodeInlineSourceMap = async (
  url: string,
  _useCache?: boolean,
  fetchFn?: (input: string, init?: RequestInit) => Promise<Response>,
): Promise<object | null> => {
  const response = await (fetchFn ?? fetch)(url)
  if (!response.ok) return null
  const encoded =
    /sourceMappingURL=data:application\/json;(?:[^,]*?;)?base64,([A-Za-z0-9+/=]+)/.exec(
      await response.text(),
    )?.[1]
  if (!encoded) return null
  return { ...JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')), mappings: [] }
}

const getSourceMap =
  vi.fn<
    (
      url: string,
      useCache?: boolean,
      fetchFn?: (input: string, init?: RequestInit) => Promise<Response>,
    ) => Promise<object | null>
  >(decodeInlineSourceMap)
const getSourceFromSourceMap = vi.fn<
  (
    map: object,
    line: number,
    column: number,
  ) => { fileName: string; lineNumber: number; columnNumber: number } | null
>(() => null)
const normalize = (file: string) =>
  file
    .replace(/\?.*$/, '')
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^webpack-internal:\/\/\/\./, '')
vi.mock('bippy/source', () => ({
  getSource: (fiber: { _debugSource?: unknown }) => getSource(fiber),
  formatOwnerStack: (stack: string) => formatOwnerStack(stack),
  parseStack: (stack: string) => parseStack(stack),
  isSourceFile: (file: string) =>
    /\.(jsx|tsx|ts|js)$/.test(normalize(file)) &&
    !file.includes('/node_modules/') &&
    !file.includes('/.next/'),
  normalizeFileName: normalize,
  getFiberHooks: (fiber: unknown) => getFiberHooks(fiber),
  getSourceMap: (url: string, useCache?: boolean, fetchFn?: never) =>
    getSourceMap(url, useCache, fetchFn),
  getSourceFromSourceMap: (map: object, line: number, column: number) =>
    getSourceFromSourceMap(map, line, column),
}))

const {
  classifyFiber,
  classifyFibersWithinBudget,
  clearSourceCache,
  isLibraryFile,
  isPageLoadableUrl,
  packageNameFromFile,
  resolveExternalStoreSourceResolution,
  resolveHookCallsite,
  resolveStackFrames,
  resolveSource,
  scheduleClassificationWarmup,
  sourceProvenanceForSource,
  sourceLabel,
  unnamedComponentLabel,
} = await import('./source')
const { defaultWorkTags } = await import('./work-tags')

const asFiber = (shape: unknown): Fiber => shape as Fiber
const at = (fileName: string, lineNumber = 1) => ({
  fileName,
  lineNumber,
  columnNumber: 0,
  functionName: null,
})
const hookNode = (
  name: string,
  fileName: string | null,
  line: number | null,
  subHooks: HooksNode[] = [],
): HooksNode => ({
  id: null,
  isStateEditable: false,
  name,
  value: null,
  subHooks,
  debugInfo: null,
  hookSource: fileName ? { fileName, lineNumber: line, columnNumber: 0, functionName: null } : null,
})

beforeEach(() => {
  clearSourceCache()
  getSource.mockReset().mockImplementation(async (fiber) => fiber._debugSource ?? null)
  getFiberHooks.mockReset().mockReturnValue([])
  formatOwnerStack.mockReset().mockImplementation((stack) => stack)
  parseStack.mockReset().mockReturnValue([])
  getSourceMap.mockReset().mockImplementation(decodeInlineSourceMap)
  getSourceFromSourceMap.mockReset().mockReturnValue(null)
  // No network in unit tests: inline-map lookup fails → resolveHookSource keeps served coordinates.
  vi.stubGlobal('fetch', () => Promise.reject(new Error('no network in tests')))
})
afterEach(() => vi.unstubAllGlobals())

describe('URLs the page cannot load', () => {
  const SERVER_COMPONENT_FRAME =
    'about://React/Server/file:///app/.next/server/chunks/ssr/app_page_tsx.js?17'
  const SERVER_CHUNK = 'file:///app/.next/server/chunks/ssr/app_page_tsx.js'

  it('classifies only page-relative paths and fetchable schemes as loadable', () => {
    for (const url of [
      '/src/App.tsx',
      'src/App.tsx',
      'http://localhost:3000/a.js',
      'https://x.dev/a.js',
      'data:text/javascript,1',
      'blob:http://localhost/1',
    ])
      expect(isPageLoadableUrl(url), url).toBe(true)
    for (const url of [
      SERVER_COMPONENT_FRAME,
      SERVER_CHUNK,
      'webpack-internal:///./app/page.tsx',
      'chrome-extension://abc/a.js',
    ])
      expect(isPageLoadableUrl(url), url).toBe(false)
  })

  it.each([
    ['a server-component frame', SERVER_COMPONENT_FRAME],
    ['a server chunk frame', SERVER_CHUNK],
  ])('never fetches %s and keeps its served position on disk', async (_label, frame) => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('refused')))
    vi.stubGlobal('fetch', fetchMock)

    const { source } = await classifyFiber(asFiber({ _debugSource: at(frame, 12) }))

    expect(source).toMatchObject({
      file: expect.stringContaining('/app/.next/server/chunks/ssr/app_page_tsx.js'),
      line: 12,
      sourceMapConfidence: 'served',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  async function genieFetchFor(url: string) {
    const fetchFns: Array<(input: string) => Promise<Response>> = []
    getSourceMap.mockImplementation(async (_url, _cache, fetchFn) => {
      if (fetchFn) fetchFns.push(fetchFn)
      return null
    })
    await classifyFiber(asFiber({ _debugSource: at(url, 4) }))
    const [genieFetch] = fetchFns
    if (!genieFetch) throw new Error('source resolution never handed bippy its fetch')
    return genieFetch
  }

  it('answers an unloadable URL off a Next.js page with a cached miss, never a fetch', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('refused')))
    vi.stubGlobal('fetch', fetchMock)

    const answer = await (await genieFetchFor('http://localhost:3000/assets/page.js'))(SERVER_CHUNK)

    expect(answer.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("maps a server-component frame through Next.js's source-map endpoint under the page's basePath", async () => {
    const map = { version: 3, sources: ['app/page.tsx'], names: [], mappings: 'AAAA' }
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify(map)))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('document', {
      baseURI: 'http://localhost:3000/shop/',
      querySelector: (selector: string) =>
        selector.includes('/_next/static/')
          ? { src: 'http://localhost:3000/shop/_next/static/chunks/main.js' }
          : null,
    })

    const genieFetch = await genieFetchFor('http://localhost:3000/shop/_next/static/chunks/page.js')
    const stub = await (await genieFetch(SERVER_COMPONENT_FRAME)).text()

    const [requested] = fetchMock.mock.calls.map(([url]) => new URL(url))
    expect(`${requested?.origin}${requested?.pathname}`).toBe(
      'http://localhost:3000/shop/__nextjs_source-map',
    )
    expect(requested?.searchParams.get('filename')).toBe(SERVER_CHUNK)
    const inline = /sourceMappingURL=data:application\/json;base64,(\S+)/.exec(stub)?.[1] ?? ''
    expect(JSON.parse(Buffer.from(inline, 'base64').toString('utf8'))).toEqual(map)
  })
})

describe('isLibraryFile', () => {
  it('recognizes dependency files without treating opaque bundler chunks as libraries', () => {
    expect(isLibraryFile('/src/App.tsx')).toBe(false)
    expect(isLibraryFile('/apps/demo/.next/dev/server/chunks/ssr/root.js')).toBe(false)
    expect(isLibraryFile('/node_modules/.vite/deps/cmdk.js')).toBe(true)
    expect(isLibraryFile('/node_modules/.pnpm/@base-ui+react/dist/index.js')).toBe(true)
  })

  it('treats a Vite dependency chunk served from a project-local cache dir as library code', async () => {
    const source = await resolveHookCallsite({
      fileName: 'http://127.0.0.1:5173/.vite/deps/modern-Du3lnq9_.js?v=1a2b',
      lineNumber: 2705,
      columnNumber: 15,
      functionName: 'useBaseQuery',
    })
    expect(source).toMatchObject({ file: '/.vite/deps/modern-Du3lnq9_.js', line: 2705 })
    expect(isLibraryFile(source?.file ?? '')).toBe(true)
    expect(packageNameFromFile('/.vite/deps/@tanstack_react-query.js')).toBe(
      '@tanstack/react-query',
    )
    expect(packageNameFromFile('/.vite/deps/modern-Du3lnq9_.js')).toBeNull()
    expect(packageNameFromFile('/node_modules/.vite/deps/zustand.js')).toBe('zustand')
  })

  it('does not misclassify an unsymbolicated Metro bundle entry as library code', () => {
    expect(isLibraryFile('/index.bundle')).toBe(false)
    expect(isLibraryFile('/.expo/.virtual-metro-entry.bundle')).toBe(false)
    expect(isLibraryFile('/main.jsbundle')).toBe(false)
    expect(isLibraryFile('/node_modules/react-native/Libraries/Text/Text.js')).toBe(true)
  })
})

describe('sourceLabel', () => {
  it('formats a basename:line identity', () => {
    expect(
      sourceLabel({
        file: '/node_modules/.vite/deps/cmdk.js',
        line: 1998,
        column: 0,
        functionName: null,
      }),
    ).toBe('cmdk.js:1998')
    expect(sourceLabel(null)).toBeNull()
  })
})

describe('sourceProvenanceForSource', () => {
  it('keeps definition and allocation provenance unknown when only a fallback source exists', () => {
    expect(
      sourceProvenanceForSource({
        file: '/src/App.tsx',
        line: 10,
        column: 2,
        functionName: 'App',
        sourceMapConfidence: 'mapped',
      }),
    ).toMatchObject({
      definitionSource: null,
      allocationCallsite: null,
      hookDefinitionOwner: null,
      hookCallsite: null,
      package: null,
      sourceMapConfidence: 'mapped',
      failureReason: 'definition-and-allocation-not-distinguished',
      usageOrDefinitionFallback: { file: '/src/App.tsx' },
    })
  })

  it('returns an explicit unresolved provenance record', () => {
    expect(sourceProvenanceForSource(null)).toEqual({
      definitionSource: null,
      allocationCallsite: null,
      hookDefinitionOwner: null,
      hookCallsite: null,
      package: null,
      sourceMapConfidence: 'unknown',
      failureReason: 'source-unresolved',
      usageOrDefinitionFallback: null,
    })
  })
})

describe('classifyFiber', () => {
  it('classifies an app component by its source', async () => {
    const { source, isLibrary } = await classifyFiber(
      asFiber({ _debugSource: at('/src/App.tsx', 10) }),
    )
    expect(source?.file).toBe('/src/App.tsx')
    expect(isLibrary).toBe(false)
  })

  it('classifies a library component, normalizing the dev-server URL + ?v= query', async () => {
    const fiber = asFiber({
      _debugSource: at('http://localhost:3100/node_modules/.vite/deps/cmdk.js?v=abc', 1998),
    })
    const { source, isLibrary } = await classifyFiber(fiber)
    expect(source?.file).toBe('/node_modules/.vite/deps/cmdk.js')
    expect(isLibrary).toBe(true)
  })

  it('classifies a Next/Turbopack chunk by its mapped app source', async () => {
    getSourceMap.mockResolvedValue({ version: 3 })
    getSourceFromSourceMap.mockReturnValue({
      fileName: '/apps/demo/app/components/counter.tsx',
      lineNumber: 12,
      columnNumber: 4,
    })
    const fiber = asFiber({
      _debugSource: at('/apps/demo/.next/dev/server/chunks/ssr/root.js', 190),
    })

    const { source, isLibrary } = await classifyFiber(fiber)

    expect(source).toMatchObject({
      file: '/apps/demo/app/components/counter.tsx',
      line: 12,
      column: 5,
    })
    expect(isLibrary).toBe(false)
  })

  it('keeps an unmapped Next/Turbopack dev chunk as unknown ownership', async () => {
    const { source, ownership, isLibrary } = await classifyFiber(
      asFiber({
        _debugSource: at('/apps/demo/.next/dev/server/chunks/ssr/root.js', 190),
      }),
    )

    expect(source).toMatchObject({
      file: '/apps/demo/.next/dev/server/chunks/ssr/root.js',
      line: 190,
      sourceMapConfidence: 'served',
    })
    expect(ownership).toBe('unknown')
    expect(isLibrary).toBe(false)
  })

  it.each(['/node_modules/provider/index.tsx', '/src/Parent.tsx'])(
    'does not borrow ancestor ownership from %s when the target has no evidence',
    async (file) => {
      const parent = asFiber({ _debugSource: at(file, 200) })
      const child = asFiber({ return: parent })
      await expect(classifyFiber(child)).resolves.toEqual({
        source: null,
        ownership: 'unknown',
        isLibrary: false,
      })
    },
  )

  it('recovers the target app body from an owned child when its own source is absent', async () => {
    const provider = asFiber({ _debugSource: at('/node_modules/provider/index.tsx', 200) })
    const App = () => null
    const app = asFiber({ tag: 0, type: App, return: provider, alternate: null })
    const debugStack = new Error('owned-body')
    debugStack.stack = 'owned-body'
    const child = asFiber({
      tag: 5,
      _debugOwner: app,
      _debugStack: debugStack,
      child: null,
      sibling: null,
    })
    Object.assign(app, { child })
    parseStack.mockReturnValue([
      { fileName: '/src/App.tsx', lineNumber: 12, columnNumber: 4, functionName: 'App' },
    ])
    await expect(classifyFiber(app)).resolves.toMatchObject({
      source: { file: '/src/App.tsx', functionName: 'App' },
      ownership: 'app',
      isLibrary: false,
    })
    Object.assign(child, { _debugOwner: provider })
    clearSourceCache()
    await expect(classifyFiber(app)).resolves.toEqual({
      source: null,
      ownership: 'unknown',
      isLibrary: false,
    })
  })

  it('classifies a component created in app JSX as library when every element it renders comes from library code', async () => {
    const LibraryGrid = (): null => null
    const usage = new Error('grid-usage')
    usage.stack = 'grid-usage'
    const grid = asFiber({ tag: 0, type: LibraryGrid, alternate: null, _debugStack: usage })
    const cells = Array.from({ length: 12 }, (_, index) => {
      const stack = new Error(`cell-${index}`)
      stack.stack = `cell-${index}`
      return asFiber({ tag: 5, _debugOwner: grid, _debugStack: stack, child: null, sibling: null })
    })
    for (const [index, cell] of cells.entries())
      Object.assign(cell, { sibling: cells[index + 1] ?? null })
    Object.assign(grid, { child: cells[0] })
    parseStack.mockImplementation((stack) =>
      stack === 'grid-usage'
        ? [{ fileName: '/src/App.tsx', lineNumber: 7, columnNumber: 3, functionName: 'App' }]
        : [
            {
              fileName: '/node_modules/grid/index.js',
              lineNumber: 40,
              columnNumber: 1,
              functionName: 'renderCell',
            },
          ],
    )

    await expect(classifyFiber(grid)).resolves.toMatchObject({
      source: { file: '/src/App.tsx', role: 'element-callsite' },
      ownership: 'library',
      ownershipBasis: 'owned-elements',
    })
  })

  it("classifies a memo(forwardRef) wrapper by the wrapped component's code, not by the app JSX that created it", async () => {
    const usage = new Error('link-usage')
    usage.stack = 'link-usage'
    const libraryBody = new Error('link-body')
    libraryBody.stack = 'link-body'
    const inner = { $$typeof: Symbol.for('react.forward_ref'), render: () => null }
    const wrapper = { $$typeof: Symbol.for('react.memo'), type: inner, compare: null }
    const memoFiber = asFiber({
      tag: defaultWorkTags.MemoComponent,
      type: wrapper,
      elementType: wrapper,
      alternate: null,
      _debugStack: usage,
    })
    const forwardRefFiber = asFiber({
      tag: defaultWorkTags.ForwardRef,
      type: inner,
      elementType: inner,
      alternate: null,
      return: memoFiber,
      _debugOwner: memoFiber,
      _debugStack: usage,
      sibling: null,
    })
    const anchor = asFiber({
      tag: 5,
      _debugOwner: forwardRefFiber,
      _debugStack: libraryBody,
      child: null,
      sibling: null,
    })
    Object.assign(memoFiber, { child: forwardRefFiber })
    Object.assign(forwardRefFiber, { child: anchor })
    parseStack.mockImplementation((stack) =>
      stack === 'link-usage'
        ? [{ fileName: '/src/Nav.tsx', lineNumber: 9, columnNumber: 7, functionName: 'Nav' }]
        : [
            {
              fileName: '/node_modules/.vite/deps/@tanstack_react-router.js',
              lineNumber: 40,
              columnNumber: 1,
              functionName: 'useLinkProps',
            },
          ],
    )

    await expect(classifyFiber(memoFiber)).resolves.toMatchObject({
      source: { file: '/src/Nav.tsx', role: 'element-callsite' },
      ownership: 'library',
      ownershipBasis: 'owned-elements',
    })
  })

  it('keeps unresolved ownership unknown', async () => {
    const { source, isLibrary, ownership } = await classifyFiber(asFiber({}))
    expect(source).toBeNull()
    expect(isLibrary).toBe(false)
    expect(ownership).toBe('unknown')
  })
})

describe('Metro symbolication', () => {
  const BUNDLE = 'http://127.0.0.1:8081/index.bundle?platform=android&dev=true'
  const EXPO_HERMES_BUNDLE =
    'http://127.0.0.1:8081/examples/expo-demo/index.ts.bundle//&platform=ios&dev=true'
  type FetchMock = (url: string, init?: { method?: string; body?: string }) => Promise<unknown>
  const respondWith = (frame: unknown) => ({ ok: true, json: async () => ({ stack: [frame] }) })

  it('maps a Metro bundle frame to its app source through the dev server endpoint', async () => {
    const fetchMock = vi.fn<FetchMock>(async () =>
      respondWith({ file: '/app/(home)/index.tsx', lineNumber: 42, column: 7 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { source, isLibrary } = await classifyFiber(asFiber({ _debugSource: at(BUNDLE, 200) }))

    expect(source).toMatchObject({
      file: '/app/(home)/index.tsx',
      line: 42,
      column: 7,
      sourceMapConfidence: 'mapped',
    })
    expect(isLibrary).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:8081/symbolicate')
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body ?? 'null')).toEqual({
      stack: [{ file: BUNDLE, lineNumber: 200, column: 0 }],
    })
  })

  it('maps the native Expo Hermes bundle URL through the Metro endpoint', async () => {
    const fetchMock = vi.fn<FetchMock>(async () =>
      respondWith({ file: '/examples/expo-demo/App.tsx', lineNumber: 31, column: 5 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { source, isLibrary } = await classifyFiber(
      asFiber({ _debugSource: at(EXPO_HERMES_BUNDLE, 98210) }),
    )

    expect(source).toMatchObject({
      file: '/examples/expo-demo/App.tsx',
      line: 31,
      column: 5,
      sourceMapConfidence: 'mapped',
    })
    expect(isLibrary).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:8081/symbolicate')
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body ?? 'null')).toEqual({
      stack: [{ file: EXPO_HERMES_BUNDLE, lineNumber: 98210, column: 0 }],
    })
  })

  it('recovers an app component body frame when Expo created its fiber inside a library wrapper', async () => {
    const usageStack = new Error('wrapped-app-usage')
    usageStack.stack = 'wrapped-app-usage'
    const ownedChildStack = new Error('owned-app-body')
    ownedChildStack.stack = 'owned-app-body'
    const App = (): null => null
    Object.assign(App, { displayName: 'App' })
    const app = asFiber({
      tag: 0,
      type: App,
      alternate: null,
      _debugStack: usageStack,
      child: null,
    })
    const ownedChild = asFiber({
      tag: 5,
      _debugOwner: app,
      _debugStack: ownedChildStack,
      child: null,
      sibling: null,
      return: app,
    })
    Object.assign(app, { child: ownedChild })
    parseStack.mockImplementation((stack) =>
      stack === 'owned-app-body'
        ? [
            {
              fileName: EXPO_HERMES_BUNDLE,
              lineNumber: 400,
              columnNumber: 0,
              functionName: 'App',
            },
          ]
        : [
            {
              fileName: EXPO_HERMES_BUNDLE,
              lineNumber: 200,
              columnNumber: 0,
              functionName: 'withDevTools',
            },
          ],
    )
    const fetchMock = vi.fn<FetchMock>(async (_url, init) => {
      const frame = JSON.parse(init?.body ?? 'null')?.stack?.[0]
      return frame?.lineNumber === 400
        ? respondWith({
            file: '/examples/expo-demo/App.tsx',
            lineNumber: 31,
            column: 5,
          })
        : respondWith({
            file: '/node_modules/expo/src/launch/withDevTools.ios.tsx',
            lineNumber: 18,
            column: 2,
          })
    })
    vi.stubGlobal('fetch', fetchMock)

    const classification = await classifyFiber(app)

    expect(classification).toMatchObject({
      source: {
        file: '/examples/expo-demo/App.tsx',
        line: 31,
        column: 5,
        functionName: 'App',
      },
      ownership: 'app',
      isLibrary: false,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not return a stale usage frame when the cache clears during owned-child recovery', async () => {
    type SymbolicateResponse = ReturnType<typeof respondWith>
    let resolveOwnedFrame: ((response: SymbolicateResponse) => void) | undefined
    const usageStack = new Error('stale-wrapper-usage')
    usageStack.stack = 'stale-wrapper-usage'
    const ownedChildStack = new Error('stale-owned-body')
    ownedChildStack.stack = 'stale-owned-body'
    const App = (): null => null
    Object.assign(App, { displayName: 'App' })
    const app = asFiber({
      tag: 0,
      type: App,
      alternate: null,
      _debugStack: usageStack,
      child: null,
    })
    const ownedChild = asFiber({
      tag: 5,
      _debugOwner: app,
      _debugStack: ownedChildStack,
      child: null,
      sibling: null,
      return: app,
    })
    Object.assign(app, { child: ownedChild })
    parseStack.mockImplementation((stack) => [
      {
        fileName: EXPO_HERMES_BUNDLE,
        lineNumber: stack === 'stale-owned-body' ? 400 : 200,
        columnNumber: 0,
        functionName: stack === 'stale-owned-body' ? 'App' : 'withDevTools',
      },
    ])
    const fetchMock = vi
      .fn<FetchMock>()
      .mockResolvedValueOnce(
        respondWith({
          file: '/node_modules/expo/src/launch/withDevTools.ios.tsx',
          lineNumber: 18,
          column: 2,
        }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOwnedFrame = resolve as (response: SymbolicateResponse) => void
          }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const pending = resolveSource(app)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    clearSourceCache()
    resolveOwnedFrame?.(
      respondWith({ file: '/examples/expo-demo/App.tsx', lineNumber: 31, column: 5 }),
    )

    await expect(pending).resolves.toBeNull()
  })

  it('retries an unresolved owned App frame for the same mounted wrapper fiber', async () => {
    await resolveSource(asFiber({}))
    const usageStack = new Error('retry-wrapper-usage')
    usageStack.stack = 'retry-wrapper-usage'
    const ownedChildStack = new Error('retry-owned-body')
    ownedChildStack.stack = 'retry-owned-body'
    const App = (): null => null
    Object.assign(App, { displayName: 'App' })
    const app = asFiber({
      tag: 0,
      type: App,
      alternate: null,
      _debugStack: usageStack,
      child: null,
    })
    const ownedChild = asFiber({
      tag: 5,
      _debugOwner: app,
      _debugStack: ownedChildStack,
      child: null,
      sibling: null,
      return: app,
    })
    Object.assign(app, { child: ownedChild })
    parseStack.mockImplementation((stack) => [
      {
        fileName: EXPO_HERMES_BUNDLE,
        lineNumber: stack === 'retry-owned-body' ? 400 : 200,
        columnNumber: 0,
        functionName: stack === 'retry-owned-body' ? 'App' : 'withDevTools',
      },
    ])
    let ownedAttempts = 0
    const fetchMock = vi.fn<FetchMock>(async (_url, init) => {
      const frame = JSON.parse(init?.body ?? 'null')?.stack?.[0]
      if (frame?.lineNumber === 400) {
        ownedAttempts += 1
        return ownedAttempts === 1
          ? { ok: false, json: async () => null }
          : respondWith({
              file: '/examples/expo-demo/App.tsx',
              lineNumber: 31,
              column: 5,
            })
      }
      return respondWith({
        file: '/node_modules/expo/src/launch/withDevTools.ios.tsx',
        lineNumber: 18,
        column: 2,
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(classifyFiber(app)).resolves.toMatchObject({
      source: { file: '/node_modules/expo/src/launch/withDevTools.ios.tsx' },
      ownership: 'library',
    })
    await expect(classifyFiber(app)).resolves.toMatchObject({
      source: { file: '/examples/expo-demo/App.tsx' },
      ownership: 'app',
    })
    expect(ownedAttempts).toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not treat an unowned child as component definition evidence', async () => {
    const usageStack = new Error('library-usage')
    usageStack.stack = 'library-usage'
    const unownedChildStack = new Error('unowned-app-body')
    unownedChildStack.stack = 'unowned-app-body'
    const LibraryComponent = (): null => null
    const library = asFiber({
      tag: 0,
      type: LibraryComponent,
      alternate: null,
      _debugStack: usageStack,
      child: null,
    })
    const unownedChild = asFiber({
      tag: 5,
      _debugOwner: null,
      _debugStack: unownedChildStack,
      child: null,
      sibling: null,
      return: library,
    })
    Object.assign(library, { child: unownedChild })
    parseStack.mockImplementation((stack) => [
      {
        fileName: EXPO_HERMES_BUNDLE,
        lineNumber: stack === 'unowned-app-body' ? 400 : 200,
        columnNumber: 0,
        functionName: stack === 'unowned-app-body' ? 'App' : 'LibraryComponent',
      },
    ])
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchMock>(async (_url, init) => {
        const frame = JSON.parse(init?.body ?? 'null')?.stack?.[0]
        return frame?.lineNumber === 400
          ? respondWith({ file: '/examples/expo-demo/App.tsx', lineNumber: 31, column: 5 })
          : respondWith({
              file: '/node_modules/expo/src/launch/withDevTools.ios.tsx',
              lineNumber: 18,
              column: 2,
            })
      }),
    )

    const classification = await classifyFiber(library)

    expect(classification).toMatchObject({
      source: { file: '/node_modules/expo/src/launch/withDevTools.ios.tsx' },
      ownership: 'library',
      isLibrary: true,
    })
  })

  it('does not replace a library component with an owned render-prop callback source', async () => {
    const usageStack = new Error('library-render-prop-usage')
    usageStack.stack = 'library-render-prop-usage'
    const renderPropStack = new Error('owned-render-prop')
    renderPropStack.stack = 'owned-render-prop'
    const LibraryList = (): null => null
    Object.assign(LibraryList, { displayName: 'LibraryList' })
    const library = asFiber({
      tag: 0,
      type: LibraryList,
      alternate: null,
      _debugStack: usageStack,
      child: null,
    })
    const renderPropChild = asFiber({
      tag: 5,
      _debugOwner: library,
      _debugStack: renderPropStack,
      child: null,
      sibling: null,
      return: library,
    })
    Object.assign(library, { child: renderPropChild })
    parseStack.mockImplementation((stack) => [
      {
        fileName: EXPO_HERMES_BUNDLE,
        lineNumber: stack === 'owned-render-prop' ? 400 : 200,
        columnNumber: 0,
        functionName: stack === 'owned-render-prop' ? 'renderItem' : 'LibraryList',
      },
    ])
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchMock>(async (_url, init) => {
        const frame = JSON.parse(init?.body ?? 'null')?.stack?.[0]
        return frame?.lineNumber === 400
          ? respondWith({ file: '/src/ListScreen.tsx', lineNumber: 47, column: 8 })
          : respondWith({
              file: '/node_modules/list-library/src/LibraryList.tsx',
              lineNumber: 18,
              column: 2,
            })
      }),
    )

    const classification = await classifyFiber(library)

    expect(classification).toMatchObject({
      source: { file: '/node_modules/list-library/src/LibraryList.tsx' },
      ownership: 'library',
      isLibrary: true,
    })
  })

  it('does not trust a mutable displayName over the target function identity', async () => {
    const usageStack = new Error('renamed-library-usage')
    usageStack.stack = 'renamed-library-usage'
    const sameNameCallbackStack = new Error('same-display-name-callback')
    sameNameCallbackStack.stack = 'same-display-name-callback'
    const LibraryList = (): null => null
    Object.assign(LibraryList, { displayName: 'App' })
    const library = asFiber({
      tag: 0,
      type: LibraryList,
      alternate: null,
      _debugStack: usageStack,
      child: null,
    })
    const callbackChild = asFiber({
      tag: 5,
      _debugOwner: library,
      _debugStack: sameNameCallbackStack,
      child: null,
      sibling: null,
      return: library,
    })
    Object.assign(library, { child: callbackChild })
    parseStack.mockImplementation((stack) => [
      {
        fileName: EXPO_HERMES_BUNDLE,
        lineNumber: stack === 'same-display-name-callback' ? 400 : 200,
        columnNumber: 0,
        functionName: stack === 'same-display-name-callback' ? 'App' : 'withDevTools',
      },
    ])
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchMock>(async (_url, init) => {
        const frame = JSON.parse(init?.body ?? 'null')?.stack?.[0]
        return frame?.lineNumber === 400
          ? respondWith({ file: '/src/App.tsx', lineNumber: 47, column: 8 })
          : respondWith({
              file: '/node_modules/list-library/src/LibraryList.tsx',
              lineNumber: 18,
              column: 2,
            })
      }),
    )

    const classification = await classifyFiber(library)

    expect(classification).toMatchObject({
      source: { file: '/node_modules/list-library/src/LibraryList.tsx' },
      ownership: 'library',
      isLibrary: true,
    })
  })

  it('bounds owned-child definition recovery on very deep subtrees', async () => {
    const usageStack = new Error('bounded-library-usage')
    usageStack.stack = 'bounded-library-usage'
    const distantOwnedStack = new Error('distant-owned-app-body')
    distantOwnedStack.stack = 'distant-owned-app-body'
    const App = (): null => null
    Object.assign(App, { displayName: 'App' })
    const app = asFiber({
      tag: 0,
      type: App,
      alternate: null,
      _debugStack: usageStack,
      child: null,
    })
    let parent = app
    for (let index = 0; index < 201; index += 1) {
      const child = asFiber({
        tag: 5,
        _debugOwner: index === 200 ? app : null,
        _debugStack: index === 200 ? distantOwnedStack : null,
        child: null,
        sibling: null,
        return: parent,
      })
      Object.assign(parent, { child })
      parent = child
    }
    parseStack.mockImplementation((stack) => [
      {
        fileName: EXPO_HERMES_BUNDLE,
        lineNumber: stack === 'distant-owned-app-body' ? 400 : 200,
        columnNumber: 0,
        functionName: stack === 'distant-owned-app-body' ? 'App' : 'withDevTools',
      },
    ])
    const fetchMock = vi.fn<FetchMock>(async (_url, init) => {
      const frame = JSON.parse(init?.body ?? 'null')?.stack?.[0]
      return frame?.lineNumber === 400
        ? respondWith({ file: '/examples/expo-demo/App.tsx', lineNumber: 31, column: 5 })
        : respondWith({
            file: '/node_modules/expo/src/launch/withDevTools.ios.tsx',
            lineNumber: 18,
            column: 2,
          })
    })
    vi.stubGlobal('fetch', fetchMock)

    const classification = await classifyFiber(app)

    expect(classification).toMatchObject({
      source: { file: '/node_modules/expo/src/launch/withDevTools.ios.tsx' },
      ownership: 'library',
      isLibrary: true,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps a symbolicated dependency frame classified as library', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchMock>(async () =>
        respondWith({
          file: '/node_modules/react-native/Libraries/Components/View/View.js',
          lineNumber: 12,
          column: 3,
        }),
      ),
    )

    const { source, isLibrary } = await classifyFiber(asFiber({ _debugSource: at(BUNDLE, 200) }))

    expect(source?.file).toBe('/node_modules/react-native/Libraries/Components/View/View.js')
    expect(isLibrary).toBe(true)
  })

  it('normalizes and classifies a Windows Metro dependency path as library', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchMock>(async () =>
        respondWith({
          file: String.raw`C:\repo\node_modules\react-native\Libraries\Text\Text.js`,
          lineNumber: 12,
          column: 3,
        }),
      ),
    )

    const { source, isLibrary } = await classifyFiber(asFiber({ _debugSource: at(BUNDLE, 200) }))

    expect(source?.file).not.toContain('\\')
    expect(source?.file).toContain('/node_modules/react-native/Libraries/Text/Text.js')
    expect(isLibrary).toBe(true)
  })

  it('ignores a symbolicate response that hands back the bundle entry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchMock>(async () => respondWith({ file: BUNDLE, lineNumber: 200, column: 0 })),
    )

    const { source, isLibrary, ownership } = await classifyFiber(
      asFiber({ _debugSource: at(BUNDLE, 200) }),
    )

    expect(source).toMatchObject({
      file: '/index.bundle',
      line: 200,
      sourceMapConfidence: 'served',
    })
    expect(isLibrary).toBe(false)
    expect(ownership).toBe('unknown')
  })

  it('never downloads the bundle itself when symbolication fails', async () => {
    const fetchMock = vi.fn<FetchMock>(async () => {
      throw new Error('metro unreachable')
    })
    vi.stubGlobal('fetch', fetchMock)

    const { source, isLibrary } = await classifyFiber(asFiber({ _debugSource: at(BUNDLE, 200) }))

    expect(source).toMatchObject({ file: '/index.bundle', line: 200, column: 0 })
    expect(isLibrary).toBe(false)
    expect(fetchMock.mock.calls.every(([url]) => url.endsWith('/symbolicate'))).toBe(true)
  })

  it('keeps a native Expo Hermes bundle visible when Metro is unavailable', async () => {
    const fetchMock = vi.fn<FetchMock>(async () => {
      throw new Error('metro unreachable')
    })
    vi.stubGlobal('fetch', fetchMock)

    const { source, isLibrary } = await classifyFiber(
      asFiber({ _debugSource: at(EXPO_HERMES_BUNDLE, 98210) }),
    )

    expect(source).toMatchObject({
      file: '/examples/expo-demo/index.ts.bundle',
      line: 98210,
      column: 0,
      sourceMapConfidence: 'served',
    })
    expect(isLibrary).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:8081/symbolicate')
  })

  it('symbolicates a given bundle frame once across fibers, but retries after a failure', async () => {
    const fetchMock = vi.fn<FetchMock>(async () => ({ ok: false, json: async () => null }))
    vi.stubGlobal('fetch', fetchMock)

    await classifyFiber(asFiber({ _debugSource: at(BUNDLE, 200) }))
    await classifyFiber(asFiber({ _debugSource: at(BUNDLE, 200) }))
    expect(fetchMock).toHaveBeenCalledTimes(2)

    fetchMock.mockResolvedValue(respondWith({ file: '/app/Late.tsx', lineNumber: 9, column: 1 }))
    await classifyFiber(asFiber({ _debugSource: at(BUNDLE, 200) }))
    await classifyFiber(asFiber({ _debugSource: at(BUNDLE, 200) }))

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('retries failed Metro attribution for the same mounted fiber', async () => {
    // Burn bippy's falsy first id so this fixture keeps one stable cache key.
    await resolveSource(asFiber({}))
    const fiber = asFiber({ _debugSource: at(BUNDLE, 200) })
    const fetchMock = vi
      .fn<FetchMock>()
      .mockResolvedValueOnce({ ok: false, json: async () => null })
      .mockResolvedValueOnce(respondWith({ file: '/app/Recovered.tsx', lineNumber: 19, column: 3 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(classifyFiber(fiber)).resolves.toMatchObject({
      source: { file: '/index.bundle' },
      ownership: 'unknown',
    })
    await expect(classifyFiber(fiber)).resolves.toMatchObject({
      source: { file: '/app/Recovered.tsx', line: 19, column: 3 },
      ownership: 'unknown',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shares one in-flight Metro request across fibers at the same frame', async () => {
    type SymbolicateResponse = ReturnType<typeof respondWith>
    let resolveResponse: ((response: SymbolicateResponse) => void) | undefined
    const fetchMock = vi.fn<FetchMock>(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve as (response: SymbolicateResponse) => void
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const lookups = Array.from({ length: 12 }, () =>
      classifyFiber(asFiber({ _debugSource: at(BUNDLE, 200) })),
    )

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    resolveResponse?.(respondWith({ file: '/app/Shared.tsx', lineNumber: 17, column: 4 }))
    const classes = await Promise.all(lookups)

    expect(classes.every(({ source }) => source?.file === '/app/Shared.tsx')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('isolates in-flight Metro requests across cache generations', async () => {
    type SymbolicateResponse = ReturnType<typeof respondWith>
    let resolveStale: ((response: SymbolicateResponse) => void) | undefined
    let resolveCurrent: ((response: SymbolicateResponse) => void) | undefined
    const fetchMock = vi
      .fn<FetchMock>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStale = resolve as (response: SymbolicateResponse) => void
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveCurrent = resolve as (response: SymbolicateResponse) => void
          }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const staleLookup = classifyFiber(asFiber({ _debugSource: at(BUNDLE, 200) }))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    clearSourceCache()
    const currentLookup = classifyFiber(asFiber({ _debugSource: at(BUNDLE, 200) }))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    resolveStale?.(respondWith({ file: '/app/Stale.tsx', lineNumber: 8, column: 1 }))
    await expect(staleLookup).resolves.toMatchObject({ source: null })

    const dedupedCurrentLookup = classifyFiber(asFiber({ _debugSource: at(BUNDLE, 200) }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    resolveCurrent?.(respondWith({ file: '/app/Current.tsx', lineNumber: 9, column: 2 }))

    await expect(currentLookup).resolves.toMatchObject({
      source: { file: '/app/Current.tsx', line: 9, column: 2 },
    })
    await expect(dedupedCurrentLookup).resolves.toMatchObject({
      source: { file: '/app/Current.tsx', line: 9, column: 2 },
    })
    await expect(classifyFiber(asFiber({ _debugSource: at(BUNDLE, 200) }))).resolves.toMatchObject({
      source: { file: '/app/Current.tsx', line: 9, column: 2 },
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('times out a stalled Metro request and lets the same frame retry', async () => {
    vi.useFakeTimers()
    try {
      await resolveSource(asFiber({}))
      const fiber = asFiber({ _debugSource: at(BUNDLE, 200) })
      const fetchMock = vi
        .fn<FetchMock>()
        .mockImplementationOnce(() => new Promise(() => {}))
        .mockResolvedValueOnce(
          respondWith({ file: '/app/AfterTimeout.tsx', lineNumber: 27, column: 6 }),
        )
      vi.stubGlobal('fetch', fetchMock)

      const first = classifyFiber(fiber)
      const outcome = Promise.race([
        first.then(() => 'settled' as const),
        new Promise<'test-timeout'>((resolve) => {
          setTimeout(() => resolve('test-timeout'), 1_500)
        }),
      ])
      await vi.advanceTimersByTimeAsync(1_500)

      expect(await outcome).toBe('settled')
      await expect(first).resolves.toMatchObject({
        source: { file: '/index.bundle' },
        ownership: 'unknown',
      })
      await expect(classifyFiber(fiber)).resolves.toMatchObject({
        source: { file: '/app/AfterTimeout.tsx', line: 27, column: 6 },
        ownership: 'unknown',
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('leaves a non-Metro url on the source map path', async () => {
    const fetchMock = vi.fn<FetchMock>(async () => {
      throw new Error('no network in tests')
    })
    vi.stubGlobal('fetch', fetchMock)

    await classifyFiber(asFiber({ _debugSource: at('http://localhost:3100/src/App.tsx', 10) }))

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:3100/src/App.tsx')
    expect(fetchMock.mock.calls[0]?.[1]).toBeUndefined()
  })
})

describe('resolveSource caching', () => {
  it('uses captured debug stacks without calling the component or bippy fallback', async () => {
    const component = vi.fn(() => null)
    const debugStack = new Error('captured')
    Object.defineProperty(debugStack, 'stack', {
      value: 'at App (/src/App.tsx:12:4)\nat react-stack-bottom-frame',
    })
    parseStack.mockReturnValue([
      { fileName: '/src/App.tsx', lineNumber: 12, columnNumber: 4, functionName: 'App' },
    ])

    await expect(
      resolveSource(asFiber({ tag: 0, type: component, _debugStack: debugStack })),
    ).resolves.toMatchObject({ file: '/src/App.tsx', line: 12, column: 4 })
    expect(component).not.toHaveBeenCalled()
    expect(getSource).not.toHaveBeenCalled()
  })

  it('reads a verified Error stack exposed through Hermes-style getter semantics', async () => {
    const stack =
      'Error: react-stack-top-frame\n' +
      '    at jsxDEV (http://127.0.0.1:8081/index.bundle?platform=ios:100:7)\n' +
      '    at App (http://127.0.0.1:8081/index.bundle?platform=ios:200:11)\n' +
      '    at react_stack_bottom_frame (http://127.0.0.1:8081/index.bundle?platform=ios:300:1)'
    const debugStack = new Error('react-stack-top-frame')
    Reflect.deleteProperty(debugStack, 'stack')
    Object.setPrototypeOf(
      debugStack,
      Object.create(Error.prototype, {
        stack: { configurable: true, get: () => stack },
      }),
    )
    formatOwnerStack.mockImplementation((value) => value)
    parseStack.mockReturnValue([
      {
        fileName: 'http://127.0.0.1:8081/index.bundle?platform=ios',
        lineNumber: 200,
        columnNumber: 11,
        functionName: 'App',
      },
    ])

    await expect(resolveSource(asFiber({ _debugStack: debugStack }))).resolves.toMatchObject({
      file: '/index.bundle',
      line: 200,
      column: 11,
      functionName: 'App',
    })
  })

  it('routes a Metro debug stack directly to symbolicate without downloading the bundle', async () => {
    const bundle =
      'http://127.0.0.1:8081/examples/expo-demo/index.ts.bundle//&platform=ios&dev=true'
    const debugStack = new Error('captured')
    Object.defineProperty(debugStack, 'stack', {
      value: `at App (${bundle}:98210:11)`,
    })
    parseStack.mockReturnValue([
      {
        fileName: bundle,
        lineNumber: 98210,
        columnNumber: 11,
        functionName: 'App',
      },
    ])
    const fetchMock = vi.fn(async (_url: string, init?: { method?: string }) =>
      init?.method === 'POST'
        ? {
            ok: true,
            json: async () => ({
              stack: [
                {
                  file: '/examples/expo-demo/App.tsx',
                  lineNumber: 31,
                  column: 5,
                },
              ],
            }),
          }
        : { ok: false },
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(resolveSource(asFiber({ _debugStack: debugStack }))).resolves.toMatchObject({
      file: '/examples/expo-demo/App.tsx',
      line: 31,
      column: 5,
      sourceMapConfidence: 'mapped',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:8081/symbolicate')
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')
  })

  it('marks a non-Metro frame mapped when stack symbolication resolves its source file', async () => {
    const debugStack = new Error('captured')
    Object.defineProperty(debugStack, 'stack', {
      value:
        'Error: react-stack-top-frame\n' +
        '    at App (http://127.0.0.1:5173/assets/app.js:200:11)\n' +
        '    at react_stack_bottom_frame (http://127.0.0.1:5173/assets/app.js:300:1)',
    })
    parseStack.mockReturnValue([
      {
        fileName: 'http://127.0.0.1:5173/assets/app.js',
        lineNumber: 200,
        columnNumber: 11,
        functionName: 'App',
      },
    ])
    getSourceMap.mockResolvedValue({ version: 3 })
    getSourceFromSourceMap.mockReturnValue({
      fileName: '/src/App.tsx',
      lineNumber: 17,
      columnNumber: 4,
    })

    await expect(resolveSource(asFiber({ _debugStack: debugStack }))).resolves.toMatchObject({
      file: '/src/App.tsx',
      line: 17,
      column: 5,
      sourceMapConfidence: 'mapped',
    })
    // bippy's lookup is 0-based on both sides of the map; the frame's column counts from 1.
    expect(getSourceFromSourceMap).toHaveBeenCalledWith({ version: 3 }, 200, 10)
  })

  describe('a Vite module frame mapped by its source map', () => {
    const moduleUrl = 'http://127.0.0.1:5173/src/App.jsx?t=1'
    const frameOf = (component: string) => {
      const debugStack = new Error('captured')
      Object.defineProperty(debugStack, 'stack', {
        value: `Error: react-stack-top-frame\n    at App (${moduleUrl}:26:20)`,
      })
      parseStack.mockReturnValue([
        { fileName: moduleUrl, lineNumber: 26, columnNumber: 20, functionName: 'App' },
      ])
      return asFiber({
        _debugStack: debugStack,
        type: Object.assign(() => null, { displayName: component }),
      })
    }
    const onDisk = (lines: string[]) =>
      vi.fn(async (url: string) =>
        url === 'http://127.0.0.1:5173/src/App.jsx?raw'
          ? new Response(`export default ${JSON.stringify(lines.join('\n'))}`)
          : new Response('', { status: 404 }),
      )

    beforeEach(() => {
      getSourceMap.mockResolvedValue({ version: 3 })
      getSourceFromSourceMap.mockReturnValue({
        fileName: 'App.jsx',
        lineNumber: 2,
        columnNumber: 4,
      })
    })

    it('resolves the map source relative to the module and keeps a line the file shows', async () => {
      vi.stubGlobal('fetch', onDisk(['function App() {', '    <Summary />', '}']))
      await expect(resolveSource(frameOf('Summary'))).resolves.toMatchObject({
        file: '/src/App.jsx',
        line: 2,
        column: 5,
        role: 'element-callsite',
        sourceMapConfidence: 'mapped',
      })
    })

    it('names a component with no runtime name after the JSX tag its callsite line opens', async () => {
      vi.stubGlobal('fetch', onDisk(['function App() {', '    <Link to="/" />', '}']))
      const fiber = frameOf('Summary')
      Object.assign(fiber, { type: Object.assign(() => null, { displayName: undefined }) })

      const classification = await classifyFiber(fiber)

      expect(classification).toMatchObject({
        source: { file: '/src/App.jsx', line: 2, column: 5 },
        elementName: 'Link',
      })
      expect(unnamedComponentLabel(classification)).toBe('Link')
    })

    it('withholds the line of an unnamed component whose mapped column opens no element', async () => {
      vi.stubGlobal('fetch', onDisk(['function App() {', '    return null', '}']))
      const fiber = frameOf('Summary')
      Object.assign(fiber, { type: Object.assign(() => null, { displayName: undefined }) })

      const classification = await classifyFiber(fiber)

      expect(classification.source).toMatchObject({ file: '/src/App.jsx', line: null })
      expect(classification.elementName).toBeUndefined()
      expect(unnamedComponentLabel(classification)).toBe('App.jsx')
    })

    it('withholds a mapped line the file on disk contradicts', async () => {
      vi.stubGlobal('fetch', onDisk(['function App() {', '  return (', '    <Summary />']))
      await expect(resolveSource(frameOf('Summary'))).resolves.toMatchObject({
        file: '/src/App.jsx',
        line: null,
        column: null,
        role: 'element-callsite',
      })
    })
  })

  it('caches successes but retries nulls', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('no source map')))
    vi.stubGlobal('fetch', fetchMock)
    const resolved = asFiber({ _debugSource: at('/src/A.tsx') })
    await resolveSource(resolved)
    await resolveSource(resolved)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const missing = asFiber({}) as Fiber & { _debugSource?: ReturnType<typeof at> }
    await expect(resolveSource(missing)).resolves.toBeNull()
    missing._debugSource = at('/src/Recovered.tsx')
    await expect(resolveSource(missing)).resolves.toMatchObject({ file: '/src/Recovered.tsx' })
  })

  it('dedupes concurrent source lookups for the same fiber', async () => {
    let resolveLookup:
      | ((response: { ok: boolean; text: () => Promise<string> }) => void)
      | undefined
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const fiber = asFiber({ _debugSource: at('/assets/Concurrent.js') })
    const first = resolveSource(fiber)
    const second = resolveSource(fiber)

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    resolveLookup?.({ ok: false, text: async () => '' })
    await expect(first).resolves.toMatchObject({ file: '/assets/Concurrent.js' })
    await expect(second).resolves.toMatchObject({ file: '/assets/Concurrent.js' })
  })

  it('does not let a pre-clear lookup overwrite or delete the current generation', async () => {
    type FetchResponse = { ok: boolean; text: () => Promise<string> }
    let resolveCurrent: ((response: FetchResponse) => void) | undefined
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveCurrent = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const fiber = asFiber({ _debugSource: at('/assets/Generation.js') })
    const staleLookup = resolveSource(fiber)
    clearSourceCache()
    const currentLookup = resolveSource(fiber)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await expect(staleLookup).resolves.toBeNull()

    const dedupedCurrentLookup = resolveSource(fiber)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveCurrent?.({ ok: false, text: async () => '' })
    await expect(currentLookup).resolves.toMatchObject({ file: '/assets/Generation.js' })
    await expect(dedupedCurrentLookup).resolves.toMatchObject({ file: '/assets/Generation.js' })
    await expect(resolveSource(fiber)).resolves.toMatchObject({ file: '/assets/Generation.js' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('stops a cleared background warmup before it starts another chunk', async () => {
    vi.useFakeTimers()
    try {
      type FetchResponse = { ok: boolean; text: () => Promise<string> }
      const pending: Array<(value: FetchResponse) => void> = []
      const fetchMock = vi.fn(
        () =>
          new Promise((resolve) => {
            pending.push(resolve)
          }),
      )
      vi.stubGlobal('fetch', fetchMock)
      const fibers = Array.from({ length: 30 }, (_, index) =>
        asFiber({ _debugSource: at(`/assets/Warm${index}.js`) }),
      )

      scheduleClassificationWarmup(fibers)
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(24))
      clearSourceCache()
      for (const resolve of pending) resolve({ ok: false, text: async () => '' })
      await vi.runAllTimersAsync()

      expect(fetchMock).toHaveBeenCalledTimes(24)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not repopulate the source-map cache from a cleared fetch', async () => {
    interface FakeResponse {
      ok: boolean
      text: () => Promise<string>
    }
    let resolveOldFetch: ((response: FakeResponse) => void) | undefined
    let resolveCurrentFetch: ((response: FakeResponse) => void) | undefined
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOldFetch = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveCurrentFetch = resolve
          }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const source = at('/assets/shared.js', 10)

    const fiber = asFiber({ _debugSource: source })
    const staleLookup = resolveSource(fiber)
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    clearSourceCache()
    const inlineMap = Buffer.from(
      JSON.stringify({ version: 3, sources: ['/src/Old.tsx'], names: [], mappings: 'AAAA' }),
    ).toString('base64')
    resolveOldFetch?.({
      ok: true,
      text: async () => `//# sourceMappingURL=data:application/json;base64,${inlineMap}`,
    })
    await expect(staleLookup).resolves.toBeNull()

    const currentLookup = resolveSource(fiber)
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    resolveCurrentFetch?.({ ok: false, text: async () => '' })
    await expect(currentLookup).resolves.toMatchObject({ file: '/assets/shared.js', line: 10 })
  })
})

describe('classifyFibersWithinBudget', () => {
  it('stops at the classification limit and marks the result partial', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('no source map')))
    vi.stubGlobal('fetch', fetchMock)
    const fibers = Array.from({ length: 130 }, (_, index) =>
      asFiber({ _debugSource: at(`/src/C${index}.tsx`) }),
    )

    const result = await classifyFibersWithinBudget(fibers, { limit: 120, budgetMs: 500 })

    expect(result.partial).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(120)
    expect(result.classes[0]?.source?.file).toBe('/src/C0.tsx')
    expect(result.classes[129]?.source).toBeNull()
  })
})

describe('resolveStackFrames', () => {
  it('source-maps frames whose module has a map and labels the rest by what they are', async () => {
    const vite = 'http://127.0.0.1:5173/src/card.tsx?t=1'
    parseStack.mockReturnValue([
      { fileName: vite, lineNumber: 112, columnNumber: 37, functionName: 'CarrierRows' },
      {
        fileName: 'about://React/Server/file:///app/.next/dev/server/chunks/ssr/page._.js?110',
        lineNumber: 716,
        columnNumber: 29,
        functionName: 'requireProducts',
      },
      {
        fileName: 'webpack-internal:///./src/a.tsx',
        lineNumber: 5,
        columnNumber: 3,
        functionName: 'A',
      },
      {
        fileName: 'http://127.0.0.1:5173/node_modules/.vite/deps/react-dom.js?v=1',
        lineNumber: 9,
        columnNumber: 1,
        functionName: 'renderWithHooks',
      },
    ])
    getSourceMap.mockImplementation(async (url) => (url === vite ? { version: 3 } : null))
    getSourceFromSourceMap.mockReturnValue({
      fileName: 'card.tsx',
      lineNumber: 42,
      columnNumber: 41,
    })

    const frames = await resolveStackFrames('stack')

    expect(frames).toEqual([
      expect.objectContaining({
        functionName: 'CarrierRows',
        file: '/src/card.tsx',
        line: 42,
        column: 42,
        isLibrary: false,
        mapping: 'mapped',
      }),
      expect.objectContaining({
        functionName: 'requireProducts',
        line: 716,
        isLibrary: false,
        mapping: 'unmapped-build-file',
      }),
      expect.objectContaining({
        functionName: 'A',
        file: expect.stringContaining('/src/a.tsx'),
        line: 5,
        mapping: 'served',
      }),
      expect.objectContaining({
        functionName: 'renderWithHooks',
        isLibrary: true,
        mapping: 'served',
      }),
    ])
    expect(frames[1]?.file).toContain('/.next/dev/server/chunks/ssr/page._.js')
  })
})

describe('resolveHookCallsite', () => {
  const hookAt = (fileName: string, lineNumber: number) => ({
    fileName,
    lineNumber,
    columnNumber: 0,
    functionName: null,
  })

  it('labels a hook call by its role and keeps a pre-bundled dependency classified as library', async () => {
    const source = await resolveHookCallsite(
      hookAt('http://localhost:3100/node_modules/.vite/deps/react-i18next.js?v=a', 42),
    )
    expect(source).toMatchObject({
      file: '/node_modules/.vite/deps/react-i18next.js',
      role: 'hook-callsite',
    })
    expect(isLibraryFile(source?.file ?? '')).toBe(true)
  })

  it('maps a base-path esbuild asset entry back to the app hook source', async () => {
    getSourceMap.mockResolvedValue({ version: 3 })
    getSourceFromSourceMap.mockReturnValue({
      fileName: '/src/lab.tsx',
      lineNumber: 39,
      columnNumber: 4,
    })

    await expect(resolveHookCallsite(hookAt('/demo/assets/main.js', 12))).resolves.toMatchObject({
      file: '/src/lab.tsx',
      line: 39,
      column: 5,
    })
  })

  it('maps a Vite-served source module back to its own lines', async () => {
    getSourceMap.mockResolvedValue({ version: 3 })
    getSourceFromSourceMap.mockReturnValue({
      fileName: '/repo/app/src/features/use-activity.ts',
      lineNumber: 13,
      columnNumber: 2,
    })

    await expect(
      resolveHookCallsite(hookAt('http://localhost:5173/src/features/use-activity.ts?t=1', 15)),
    ).resolves.toMatchObject({
      file: '/src/features/use-activity.ts',
      line: 13,
      column: 3,
      sourceMapConfidence: 'mapped',
    })
  })

  describe('in a webpack eval module', () => {
    const MODULE = 'webpack-internal:///./src/features/use-activity.ts'
    const BUNDLE = 'http://localhost:4711/static/js/main.js'
    const CDN_SCRIPT = 'https://cdn.example/analytics.js'
    const map = {
      version: 3,
      sources: ['webpack://app/./src/features/use-activity.ts?9e16'],
      names: [],
      mappings: 'AAAA',
    }
    const evalModule = (id: string, footer: string) =>
      `"${id}": () => { eval(${JSON.stringify(`code()\n${footer}//# sourceURL=${id}\n`)}) },`
    const inlineMap = `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(JSON.stringify(map)).toString('base64')}\n`

    const serveBundle = (modules: string) => {
      const fetchMock = vi.fn(async (url: string) =>
        url === BUNDLE ? new Response(modules) : new Response('', { status: 404 }),
      )
      vi.stubGlobal('fetch', fetchMock)
      vi.stubGlobal('location', { origin: 'http://localhost:4711' })
      vi.stubGlobal('document', {
        baseURI: 'http://localhost:4711/',
        scripts: [{ src: BUNDLE }, { src: CDN_SCRIPT }],
      })
      getSourceFromSourceMap.mockReturnValue({
        fileName: 'webpack://app/./src/features/use-activity.ts?9e16',
        lineNumber: 13,
        columnNumber: 0,
      })
      return fetchMock
    }

    it('maps the hook through the inline map the page script carries', async () => {
      const fetchMock = serveBundle(evalModule(MODULE, inlineMap))

      await expect(
        resolveHookCallsite({ ...hookAt(MODULE, 15), columnNumber: 51 }),
      ).resolves.toMatchObject({
        file: '/src/features/use-activity.ts',
        line: 13,
        column: 1,
        sourceMapConfidence: 'mapped',
      })
      expect(getSourceFromSourceMap).toHaveBeenCalledWith(
        expect.objectContaining({ sources: map.sources }),
        15,
        50,
      )
      expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain(CDN_SCRIPT)
    })

    it("keeps served coordinates when the module carries no map, never borrowing the previous module's", async () => {
      serveBundle(
        evalModule('webpack-internal:///./src/features/other.ts', inlineMap) +
          evalModule(MODULE, ''),
      )

      await expect(
        resolveHookCallsite({ ...hookAt(MODULE, 15), columnNumber: 51 }),
      ).resolves.toMatchObject({
        file: '/src/features/use-activity.ts',
        line: 15,
        column: 51,
        sourceMapConfidence: 'served',
      })
      expect(getSourceFromSourceMap).not.toHaveBeenCalled()
    })
  })

  it('keeps served coordinates when the map names a different source file', async () => {
    getSourceMap.mockResolvedValue({ version: 3 })
    getSourceFromSourceMap.mockReturnValue({
      fileName: '/repo/app/src/features/other.ts',
      lineNumber: 3,
      columnNumber: 2,
    })

    await expect(
      resolveHookCallsite(hookAt('http://localhost:5173/src/features/use-activity.ts', 15)),
    ).resolves.toMatchObject({
      file: '/src/features/use-activity.ts',
      line: 15,
      column: 0,
      sourceMapConfidence: 'served',
    })
  })

  it('keeps served coordinates when a library source-map target is rejected', async () => {
    getSourceMap.mockResolvedValue({ version: 3 })
    getSourceFromSourceMap.mockReturnValue({
      fileName: '/node_modules/dependency/index.js',
      lineNumber: 999,
      columnNumber: 8,
    })

    await expect(resolveHookCallsite(hookAt('/assets/main.js', 12))).resolves.toMatchObject({
      file: '/assets/main.js',
      line: 12,
      column: 0,
    })
  })

  it('does not shadow-render a component for automatic external-store reports', async () => {
    let componentCalls = 0
    const type = () => {
      componentCalls += 1
      return null
    }

    expect(await resolveExternalStoreSourceResolution(asFiber({ type }))).toEqual({
      status: 'shadow-render-disabled',
      hooks: null,
    })
    expect(componentCalls).toBe(0)
    expect(getFiberHooks).not.toHaveBeenCalled()
  })
})

describe('resolveExternalStoreSourceResolution', () => {
  it('resolves the app callsite, primitive source, and custom-hook ancestry in call order', async () => {
    const hooks = [
      hookNode('Consumer', '/node_modules/bippy/source.js', 1, [
        hookNode('Query', '/src/Search.tsx', 20, [
          hookNode('BaseQuery', '/node_modules/@tanstack/react-query/base.js', 30, [
            hookNode('SyncExternalStore', '/node_modules/react/index.js', 40),
          ]),
        ]),
        hookNode('Store', '/src/use-store.ts', 50, [
          hookNode('SyncExternalStore', '/node_modules/react/index.js', 60),
        ]),
      ]),
    ]

    const type = (): null => null
    Object.assign(type, { displayName: 'Consumer' })
    const resolution = await resolveExternalStoreSourceResolution(asFiber({ type }), hooks)
    expect(resolution).toMatchObject({
      status: 'resolved',
      hooks: [
        {
          callsite: { file: '/src/Search.tsx', line: 20 },
          primitiveSource: { file: '/node_modules/react/index.js', line: 40 },
          hookAncestry: [
            { name: 'Query', source: { file: '/src/Search.tsx', line: 20 } },
            {
              name: 'BaseQuery',
              source: { file: '/node_modules/@tanstack/react-query/base.js', line: 30 },
            },
          ],
        },
        {
          callsite: { file: '/src/use-store.ts', line: 50 },
          primitiveSource: { file: '/node_modules/react/index.js', line: 60 },
        },
      ],
    })
  })

  it('reports an unavailable supplied inspection without a plausible hook source', async () => {
    expect(await resolveExternalStoreSourceResolution(asFiber({}), null)).toEqual({
      status: 'inspection-unavailable',
      hooks: null,
    })
  })
})
