import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const runtimePackage = join(repositoryRoot, 'packages/genie-react')
export const runtimeRequire = createRequire(join(runtimePackage, 'package.json'))
const packageDirectory = (name) => dirname(runtimeRequire.resolve(`${name}/package.json`))

/** Serve the fixture app with one built Genie runtime. React and Query resolve from the runtime package so app and Genie share one copy; nothing is watched, so edits elsewhere cannot reload a page mid-measurement. */
export async function startFixtureServer(dist, cacheDir) {
  const { createServer } = await import(runtimeRequire.resolve('vite'))
  const server = await createServer({
    configFile: false,
    root: join(repositoryRoot, 'scripts/runtime-overhead'),
    cacheDir,
    logLevel: 'error',
    resolve: {
      alias: [
        { find: /^react(\/.*)?$/, replacement: `${packageDirectory('react')}$1` },
        { find: /^react-dom(\/.*)?$/, replacement: `${packageDirectory('react-dom')}$1` },
        {
          find: /^@tanstack\/react-query$/,
          replacement: packageDirectory('@tanstack/react-query'),
        },
        ...['hook', 'hook-hmr', 'client'].map((entry) => ({
          find: `genie-react/${entry}`,
          replacement: join(dist, `${entry}.js`),
        })),
        { find: /^genie-react$/, replacement: join(dist, 'index.js') },
      ],
    },
    optimizeDeps: { entries: ['main.js', 'app.jsx'] },
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
      fs: { allow: [repositoryRoot] },
      hmr: false,
      watch: null,
    },
  })
  await server.listen()
  const address = server.httpServer.address()
  if (!address || typeof address === 'string') throw new Error('Vite did not report a port')
  return { baseUrl: `http://127.0.0.1:${address.port}`, close: () => server.close() }
}

/** Open the fixture and resolve once its harness is ready; a page error or console error rejects instead of timing out. */
export async function openFixturePage(browser, baseUrl, { genie, rows }) {
  const page = await browser.newPage()
  const errors = []
  let failed
  const failure = new Promise((_, reject) => {
    failed = reject
  })
  const fail = (error) => {
    errors.push(error)
    failed(error)
  }
  page.on('pageerror', fail)
  page.on('console', (message) => {
    if (message.type() === 'error') fail(new Error(message.text()))
  })
  await page.goto(`${baseUrl}/?genie=${genie ? 1 : 0}&rows=${rows}`)
  await Promise.race([
    page.waitForFunction(() => window.__bench !== undefined, null, { timeout: 120_000 }),
    failure,
  ])
  return {
    page,
    errors,
    call: async (tool, args) => {
      const response = await page.evaluate(
        ([name, input]) => window.__bench.callTool(name, input),
        [tool, args],
      )
      if (!response.ok) throw new Error(`${tool} failed: ${response.error}`)
      return response
    },
    throwIfFailed: () => {
      if (errors.length > 0) throw errors[0]
    },
    close: () => page.close(),
  }
}
