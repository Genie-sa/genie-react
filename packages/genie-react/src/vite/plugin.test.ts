import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Plugin, parseAst } from 'vite'
import { describe, expect, it } from 'vitest'
import { GENIE_DISCOVERY_FILE } from '../protocol'
import { genie, hasCloudflarePlugin } from './plugin'

function getHook<T>(plugin: Plugin, name: keyof Plugin): T {
  const hook = plugin[name] as unknown
  const fn = typeof hook === 'function' ? hook : (hook as { handler: unknown }).handler
  return fn as T
}

type ResolveCtx = {
  resolve: (source: string, importer?: string, options?: object) => Promise<unknown>
  parse?: typeof parseAst
  warn?: (message: string) => void
}
type ResolveIdFn = (
  this: ResolveCtx,
  source: string,
  importer: string | undefined,
  options: object,
) => Promise<string | null>
type LoadFn = (this: unknown, id: string) => string | null
type TransformFn = (
  this: ResolveCtx,
  code: string,
  id: string,
) => Promise<{ code: string; map: null } | undefined>
type IndexHtmlFn = (
  this: unknown,
) => { tag: string; attrs: Record<string, string>; injectTo: string }[] | undefined
type ConfigFn = (
  this: unknown,
  userConfig: Record<string, unknown>,
) =>
  | {
      resolve?: { dedupe?: string[] }
      optimizeDeps?: { exclude?: string[]; include?: string[] }
    }
  | undefined

const absent: ResolveCtx = { resolve: async () => null }
const GENIE_IMPORTER = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist', 'index.js')
const APP_IMPORTER = '/app/src/main.tsx'
// What Vite answers in a workspace or linked checkout: genie-react's devDependency, not anything the app installed.
const resolvesFromGenieCheckout: ResolveCtx = {
  resolve: async (source) => ({
    id: join(GENIE_IMPORTER, '..', '..', 'node_modules', source, 'dist', 'esm', 'index.js'),
  }),
}

/** A throwaway app root that installs exactly `peers`, as an app with its own node_modules does. */
async function appRoot(peers: readonly string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'genie-vite-app-'))
  await writeFile(join(root, 'package.json'), '{"name":"app","private":true}')
  for (const peer of peers) {
    await mkdir(join(root, 'node_modules', peer), { recursive: true })
    await writeFile(join(root, 'node_modules', peer, 'package.json'), `{"name":"${peer}"}`)
  }
  return root
}

describe('genie() plugin array', () => {
  it('returns serve, optional-peer, and split production plugins', () => {
    const plugins = genie()
    expect(plugins).toHaveLength(4)
    expect(plugins[0]?.name).toBe('genie')
    expect(plugins[0]?.apply).toBe('serve')
    expect(plugins[1]?.name).toBe('genie:optional-peers')
    // No `apply`: the stub must run in build too, not only serve.
    expect(plugins[1]?.apply).toBeUndefined()
    expect(plugins[2]?.name).toBe('genie:production-noop')
    expect(plugins[2]?.apply).toBe('build')
    expect(plugins[3]?.name).toBe('genie:production-strip-tools')
    expect(plugins[3]?.apply).toBe('build')
  })
})

describe('production component removal', () => {
  const production = genie()[2] as Plugin
  const transform = getHook<TransformFn>(production, 'transform')
  const resolveId = getHook<(source: string) => string | null>(production, 'resolveId')
  const load = getHook<LoadFn>(production, 'load')
  const productionCtx = { ...absent, parse: parseAst }
  const stripTools = getHook<TransformFn>(genie()[3] as Plugin, 'transform')

  it('removes the documented Genie import before Rollup resolves the production graph', async () => {
    const out = await transform.call(
      productionCtx,
      `import { Genie } from 'genie-react'\nexport const app = import.meta.env.DEV && Genie()\n`,
      '/app/src/main.tsx',
    )

    expect(out?.code).not.toContain("from 'genie-react'")
    expect(out?.code).toContain('const Genie = () => null\nexport const app')
    expect(out?.code).toContain('import.meta.env.DEV && Genie()')
  })

  it('supports an aliased Genie component and leaves unrelated modules alone', async () => {
    const out = await transform.call(
      productionCtx,
      `import { Genie as DevGenie } from "genie-react";\nconst app = DevGenie()\n`,
      '/app/src/main.tsx',
    )
    expect(out?.code).toContain('const DevGenie = () => null')
    expect(
      await transform.call(productionCtx, 'export const value = 1', '/app/src/value.ts'),
    ).toBeUndefined()
  })

  it('stubs the full root runtime when production code imports app-tool helpers', () => {
    const id = resolveId.call(null, 'genie-react')
    expect(id).toBe('\0virtual:dev-only-runtime-noop')
    const code = load.call(null, id as string)
    expect(code).toContain('export const useGenieTool = noop')
    expect(code).toContain('export const useGenieTools = noop')
    expect(code).toContain('export const defineGenieTool')
    expect(code).toContain('export class GenieToolError')
    expect(resolveId.call(null, 'genie-react/protocol')).toBeNull()
  })

  it('stubs the TanStack-free tools entry exactly like the root runtime', async () => {
    const id = resolveId.call(null, 'genie-react/tools')
    expect(id).toBe('\0virtual:dev-only-runtime-noop')
    const code = load.call(null, id as string) as string
    const exported = [...code.matchAll(/export (?:const|class) (\w+)/g)].map((match) => match[1])
    expect(exported.sort()).toEqual(Object.keys(await import('../production')).sort())
  })

  it('removes custom-tool helper calls and their protocol-only arguments', async () => {
    const out = await stripTools.call(
      productionCtx,
      `import { defineGenieTool, useGenieTool as useTool } from 'genie-react'
const tool = defineGenieTool({ description: 'query_list', input: schema() })
useTool({ description: 'react_get_tree', handler: () => tool })
`,
      '/app/src/tools.js',
    )

    expect(out?.code).not.toContain('query_list')
    expect(out?.code).not.toContain('react_get_tree')
    expect(out?.code).toContain('const tool = undefined')
  })

  it('removes helper calls imported from genie-react/tools', async () => {
    const out = await stripTools.call(
      productionCtx,
      `import { useGenieTool } from 'genie-react/tools'\nuseGenieTool({ description: 'react_get_tree' })\n`,
      '/app/src/tools.js',
    )

    expect(out?.code).not.toContain('react_get_tree')
  })
})

describe('optional-peer stubs', () => {
  type ConfigResolvedFn = (this: unknown, config: { root: string }) => void

  async function stubsFor(peers: readonly string[]) {
    const optional = genie()[1] as Plugin
    const root = await appRoot(peers)
    getHook<ConfigResolvedFn>(optional, 'configResolved').call(null, { root })
    const resolveId = getHook<ResolveIdFn>(optional, 'resolveId')
    return {
      resolve: (source: string, importer: string | undefined) =>
        resolveId.call(resolvesFromGenieCheckout, source, importer, {}),
      load: getHook<LoadFn>(optional, 'load'),
      cleanup: () => rm(root, { recursive: true, force: true }),
    }
  }

  it("stubs genie-react's router import when the app does not install the router, even though genie-react's own directory resolves it", async () => {
    const stubs = await stubsFor(['@tanstack/react-query'])
    try {
      expect(await stubs.resolve('@tanstack/react-router', GENIE_IMPORTER)).toBe(
        '\0virtual:genie-optional-router',
      )
      expect(await stubs.resolve('@tanstack/react-query', GENIE_IMPORTER)).toBeNull()
    } finally {
      await stubs.cleanup()
    }
  })

  it('stubs @tanstack/react-query with a bare QueryClientContext when the app lacks it', async () => {
    const stubs = await stubsFor([])
    try {
      expect(await stubs.resolve('@tanstack/react-query', GENIE_IMPORTER)).toBe(
        '\0virtual:genie-optional-query',
      )
      const code = stubs.load.call(null, '\0virtual:genie-optional-query')
      expect(code).toContain('export const QueryClientContext')
      expect(code).toContain('createContext(undefined)')
    } finally {
      await stubs.cleanup()
    }
  })

  it("defers to the app's own router when the app installs it", async () => {
    const stubs = await stubsFor(['@tanstack/react-router'])
    try {
      expect(await stubs.resolve('@tanstack/react-router', GENIE_IMPORTER)).toBeNull()
    } finally {
      await stubs.cleanup()
    }
  })

  it("never stubs the app's own import, so a missing dependency still fails loudly", async () => {
    const stubs = await stubsFor([])
    try {
      expect(await stubs.resolve('@tanstack/react-router', APP_IMPORTER)).toBeNull()
      expect(await stubs.resolve('@tanstack/react-router', undefined)).toBeNull()
    } finally {
      await stubs.cleanup()
    }
  })

  it('ignores any other specifier', async () => {
    const stubs = await stubsFor([])
    try {
      expect(await stubs.resolve('@tanstack/query-core', GENIE_IMPORTER)).toBeNull()
    } finally {
      await stubs.cleanup()
    }
  })

  it('serves a no-op useRouter for the stub id and nothing else', async () => {
    const stubs = await stubsFor([])
    try {
      expect(stubs.load.call(null, '\0virtual:genie-optional-router')).toContain(
        'export const useRouter = () => undefined',
      )
      expect(stubs.load.call(null, '/some/other/module.ts')).toBeNull()
    } finally {
      await stubs.cleanup()
    }
  })
})

describe('client-entry hook hoisting', () => {
  const main = genie()[0] as Plugin
  const transform = getHook<TransformFn>(main, 'transform')
  const ctx: ResolveCtx = { resolve: async () => ({ id: 'hook' }), warn: () => {} }

  it('hoists the collector hook above a TanStack Start client entry even with a Vite query suffix', async () => {
    const out = await transform.call(
      ctx,
      'import "react"\n',
      '/app/.tanstack-start/client-entry.tsx?v=abc123',
    )
    expect(out?.code.startsWith('import "genie-react/hook";')).toBe(true)
    expect(out?.code).toContain('import "genie-react/hook-hmr";')
    expect(out?.code).toContain('import "react"')
  })

  it('leaves non-client-entry modules untouched', async () => {
    const out = await transform.call(ctx, 'code', '/app/src/main.tsx')
    expect(out).toBeUndefined()
  })

  it('does nothing when react instrumentation is disabled', async () => {
    const noReact = genie({ react: false })[0] as Plugin
    const t = getHook<TransformFn>(noReact, 'transform')
    const out = await t.call(ctx, 'code', '/app/.tanstack-start/client-entry.tsx')
    expect(out).toBeUndefined()
  })
})

describe('client injection for index.html shapes', () => {
  const main = genie()[0] as Plugin
  const indexHtml = getHook<IndexHtmlFn>(main, 'transformIndexHtml')

  it('head-prepends the genie client module script', () => {
    const tags = indexHtml.call(null)
    expect(tags?.[0]?.attrs.src).toContain('virtual:genie-client')
    expect(tags?.[0]?.injectTo).toBe('head-prepend')
  })

  it('injects nothing when disabled', () => {
    const disabled = genie({ enabled: false })[0] as Plugin
    const fn = getHook<IndexHtmlFn>(disabled, 'transformIndexHtml')
    expect(fn.call(null)).toBeUndefined()
  })
})

describe('config dedupe (avoids dual-React under genie link)', () => {
  const main = genie()[0] as Plugin
  const config = getHook<ConfigFn>(main, 'config')

  it('dedupes react + react-dom to a single copy', () => {
    const cfg = config.call(null, {})
    expect(cfg?.resolve?.dedupe).toContain('react')
    expect(cfg?.resolve?.dedupe).toContain('react-dom')
  })

  it('returns no config when disabled', () => {
    const disabled = genie({ enabled: false })[0] as Plugin
    expect(getHook<ConfigFn>(disabled, 'config').call(null, {})).toBeUndefined()
  })
})

describe('cloudflare coexistence', () => {
  it('detects the cloudflare plugin under all its registered names', () => {
    expect(hasCloudflarePlugin([{ name: 'vite-plugin-cloudflare' }])).toBe(true)
    expect(hasCloudflarePlugin([{ name: 'vite-plugin-cloudflare:assets' }])).toBe(true)
    expect(hasCloudflarePlugin([{ name: '@cloudflare/vite-plugin' }])).toBe(true)
    expect(hasCloudflarePlugin([{ name: 'genie' }, { name: '@vitejs/plugin-react' }])).toBe(false)
  })

  it('starts a standalone hub and dials the injected client at it', async () => {
    const main = genie({ react: false })[0] as Plugin
    const configResolved = getHook<(this: unknown, config: unknown) => void>(main, 'configResolved')
    const configureServer = getHook<(this: unknown, server: unknown) => Promise<void>>(
      main,
      'configureServer',
    )
    const load = getHook<(this: unknown, id: string) => Promise<string | null>>(main, 'load')

    configResolved.call(null, { plugins: [{ name: 'vite-plugin-cloudflare' }] })
    const httpServer = new EventEmitter()
    const root = await mkdtemp(join(tmpdir(), 'genie-cf-plugin-'))
    const logs: string[] = []
    try {
      await configureServer.call(null, {
        config: { root, logger: { info: (message: string) => logs.push(message) } },
        httpServer,
        middlewares: { use: () => undefined },
      })
      expect(logs.join('\n')).toContain('standalone hub')
      expect(existsSync(join(root, GENIE_DISCOVERY_FILE))).toBe(true)

      const module = await load.call({}, '\0virtual:genie-client')
      expect(module).toMatch(/url: "ws:\/\/127\.0\.0\.1:\d+\/__genie\/ws"/)
    } finally {
      httpServer.emit('close')
      await new Promise((resolve) => setTimeout(resolve, 100))
      await rm(root, { recursive: true, force: true })
    }
  })

  it('keeps the standalone hub alive across a Vite restart, which opens the new server first', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genie-cf-restart-'))
    const start = async () => {
      const main = genie({ react: false })[0] as Plugin
      getHook<(this: unknown, config: unknown) => void>(main, 'configResolved').call(null, {
        plugins: [{ name: 'vite-plugin-cloudflare' }],
      })
      const httpServer = new EventEmitter()
      await getHook<(this: unknown, server: unknown) => Promise<void>>(
        main,
        'configureServer',
      ).call(null, {
        config: { root, logger: { info: () => undefined } },
        httpServer,
        middlewares: { use: () => undefined },
      })
      const module = await getHook<(this: unknown, id: string) => Promise<string | null>>(
        main,
        'load',
      ).call({}, '\0virtual:genie-client')
      return { httpServer, url: /url: "(ws:[^"]+)"/.exec(module ?? '')?.[1] }
    }
    const reachable = (url: string | undefined) =>
      new Promise<boolean>((resolve) => {
        const socket = new WebSocket(`${url}?role=app`)
        socket.onopen = () => {
          socket.close()
          resolve(true)
        }
        socket.onerror = () => resolve(false)
      })
    try {
      const first = await start()
      const restarted = await start()
      first.httpServer.emit('close')
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(restarted.url).toBe(first.url)
      expect(await reachable(restarted.url)).toBe(true)
      restarted.httpServer.emit('close')
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(await reachable(restarted.url)).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('keeps the same-origin client url without cloudflare', async () => {
    const main = genie({ react: false })[0] as Plugin
    const configResolved = getHook<(this: unknown, config: unknown) => void>(main, 'configResolved')
    const load = getHook<(this: unknown, id: string) => Promise<string | null>>(main, 'load')
    configResolved.call(null, { plugins: [{ name: '@vitejs/plugin-react' }] })
    const module = await load.call({}, '\0virtual:genie-client')
    expect(module).toContain('url: undefined')
  })
})

describe('config optimizeDeps (dep optimizer bypasses the peer stubs)', () => {
  type ConfigEnvironmentFn = (
    this: unknown,
    name: string,
    environment: { consumer?: string; optimizeDeps?: { exclude?: string[] } },
  ) => { optimizeDeps: { include: string[] } } | undefined

  async function configured(peers: readonly string[]) {
    const main = genie()[0] as Plugin
    const root = await appRoot(peers)
    const cfg = getHook<ConfigFn>(main, 'config').call(null, { root })
    return {
      cfg,
      environment: getHook<ConfigEnvironmentFn>(main, 'configEnvironment'),
      cleanup: () => rm(root, { recursive: true, force: true }),
    }
  }

  it('excludes genie-react so esbuild never pre-bundles the bare @tanstack imports', async () => {
    const { cfg, cleanup } = await configured([])
    await cleanup()
    expect(cfg?.optimizeDeps?.exclude).toContain('genie-react')
  })

  it('pre-lists nested hard deps so the first post-install boot avoids a mid-run re-optimize', async () => {
    const { cfg, cleanup } = await configured([])
    await cleanup()
    expect(cfg?.optimizeDeps?.include).toContain('genie-react > bippy')
    expect(cfg?.optimizeDeps?.include).toContain('genie-react > bippy/source')
    expect(cfg?.optimizeDeps?.include).toContain('genie-react > superjson')
    expect(cfg?.optimizeDeps?.include).not.toContain('genie-react > zod')
    expect(cfg?.optimizeDeps?.include).toContain('react')
  })

  it('pre-bundles only the TanStack peers the app installs, in the client environment', async () => {
    const { environment, cleanup } = await configured(['@tanstack/react-query'])
    await cleanup()
    expect(environment.call(null, 'client', {})?.optimizeDeps.include).toEqual([
      'genie-react > @tanstack/react-query',
    ])
    expect(environment.call(null, 'ssr', {})).toBeUndefined()
  })

  it('leaves out a peer the client environment excludes, as TanStack Start does for the router', async () => {
    const { environment, cleanup } = await configured([
      '@tanstack/react-router',
      '@tanstack/react-query',
    ])
    await cleanup()
    const startClient = {
      optimizeDeps: { exclude: ['@tanstack/react-start', '@tanstack/react-router'] },
    }
    expect(environment.call(null, 'client', startClient)?.optimizeDeps.include).toEqual([
      'genie-react > @tanstack/react-query',
    ])
  })
})
