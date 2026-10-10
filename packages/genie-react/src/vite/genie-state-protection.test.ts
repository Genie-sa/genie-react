import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, type InlineConfig, type ViteDevServer } from 'vite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { genie, isGenieStateRequest } from './plugin'

const SECRET = 'genie-state-sentinel'

describe('isGenieStateRequest', () => {
  it.each([
    '/.genie/bridge.json',
    '/.genie/bridge.json?raw',
    '/.genie/bridge.json?import',
    '/.GENIE/bridge.json',
    '/%2egenie/bridge.json',
    '/%2Egenie%2Fbridge.json',
    '/%252egenie/bridge.json',
    '/./.genie/bridge.json',
    '/app/../.genie/bridge.json',
    '/@fs/Users/dev/app/.genie/bridge.json',
    '/@fs/C:\\dev\\app\\.genie\\bridge.json',
    '/.genie./bridge.json',
    '/%E0%A4%A',
  ])('blocks %s', (url) => {
    expect(isGenieStateRequest(url)).toBe(true)
  })

  it.each([
    '/',
    '/src/main.tsx?import',
    '/genie/page',
    '/.genie-notes/x',
    '/my.genie/x',
    '/@id/__x00__virtual:genie-client',
  ])('serves %s', (url) => {
    expect(isGenieStateRequest(url)).toBe(false)
  })
})

describe('genie() keeps .genie out of the dev server', () => {
  let root: string
  let server: ViteDevServer | null = null

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'genie-state-'))
    await mkdir(join(root, '.genie'))
    await writeFile(join(root, '.genie', 'state.json'), JSON.stringify({ secret: SECRET }))
    await writeFile(join(root, 'index.html'), '<!doctype html><title>t</title>')
  })

  afterEach(async () => {
    await server?.close()
    server = null
    await rm(root, { recursive: true, force: true })
  })

  async function start(config: InlineConfig = {}): Promise<string> {
    server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [genie({ react: false })],
      ...config,
      server: { host: '127.0.0.1', port: 0, ...config.server },
    })
    await server.listen()
    const address = server.httpServer?.address()
    if (!address || typeof address === 'string') throw new Error('Vite did not bind a TCP port')
    const { port } = address
    await expect
      .poll(() => readFile(join(root, '.genie', 'bridge.json'), 'utf8').catch(() => ''))
      .toContain(`:${port}/`)
    return `http://127.0.0.1:${port}`
  }

  it("adds .genie to Vite's default deny list without dropping the defaults", async () => {
    await start()
    const deny = server?.config.server.fs.deny ?? []
    expect(deny).toEqual(expect.arrayContaining(['.env', '.env.*', '**/.git/**', '**/.genie/**']))
  })

  it("appends to an app's own deny list rather than replacing it", async () => {
    await start({ server: { fs: { deny: ['secrets/**'] } } })
    expect(server?.config.server.fs.deny).toEqual(['secrets/**', '**/.genie/**'])
  })

  it.each([false, true])(
    'answers 404 for every .genie URL form (fs.strict: %s)',
    async (strict) => {
      const base = await start({ server: { fs: { strict } } })
      const paths = [
        '/.genie/bridge.json',
        '/.genie/state.json',
        '/.genie/state.json?raw',
        '/.genie/state.json?import',
        '/%2egenie/state.json',
        '/./.genie/state.json',
        `/@fs${root}/.genie/state.json`,
        `/@fs${root}/.genie/state.json?raw`,
      ]
      for (const path of paths) {
        const response = await fetch(`${base}${path}`)
        const body = await response.text()
        expect({ path, status: response.status, leaked: body.includes(SECRET) }).toEqual({
          path,
          status: 404,
          leaked: false,
        })
      }
      expect((await fetch(`${base}/`)).status).toBe(200)
    },
  )
})
