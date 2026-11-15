import { readFile, rm, writeFile } from 'node:fs/promises'
import { createServer as createHttpServer, request as httpRequest } from 'node:http'
import { join } from 'node:path'
import { CheckFailure, freePort, waitFor, waitForHttp } from './harness.mjs'

const DISCOVERY_FILE = '.genie/bridge.json'

export function binary(appDir, name, path) {
  return join(appDir, 'node_modules', name, path)
}

export async function discoverySnapshot(appDir) {
  return readFile(join(appDir, DISCOVERY_FILE), 'utf8').catch(() => null)
}

/** Reads the discovery file the app's own dev process published, and fails unless it names a live hub on the expected port. */
export async function discoveredHub(appDir, { port, owner }) {
  return waitFor(
    'the hub discovery file',
    async () => {
      const discovery = JSON.parse(await readFile(join(appDir, DISCOVERY_FILE), 'utf8'))
      if (discovery.port !== port) {
        throw new CheckFailure(`discovery names port ${discovery.port}, expected ${port}`)
      }
      if (owner && discovery.pid !== owner.child.pid) {
        throw new CheckFailure(`discovery is owned by pid ${discovery.pid}, not ${owner.child.pid}`)
      }
      return discovery
    },
    { timeoutMs: 20_000 },
  )
}

/** Writes a throwaway Vite config beside the app's own that merges `overrides` into it; Vite only resolves the app's dependencies from a config inside the app directory. */
export async function writeOverrideConfig(appDir, overrides) {
  const path = join(appDir, `.genie-apps-e2e-${process.pid}.vite.config.mjs`)
  await writeFile(
    path,
    `import { mergeConfig } from 'vite'
import base from './vite.config.ts'
export default (env) => mergeConfig(typeof base === 'function' ? base(env) : base, ${JSON.stringify(overrides)})
`,
  )
  return { path, remove: () => rm(path, { force: true }) }
}

export async function startVite({ processes, appDir }, args = []) {
  const port = await freePort()
  const vite = processes.start(
    'vite dev',
    process.execPath,
    [
      binary(appDir, 'vite', 'bin/vite.js'),
      ...args,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    { cwd: appDir },
  )
  const url = `http://127.0.0.1:${port}/`
  await waitForHttp(vite, url)
  await discoveredHub(appDir, { port, owner: vite })
  return { url, port, server: vite }
}

const REWRITTEN_TYPES = /text\/html|javascript/

/** Serves `target` on a free loopback port and rewrites text bodies; unlike browser-side interception, the page keeps a real loopback origin, so Chromium still lets it reach a loopback hub. */
export async function startRewritingProxy(target, replacements) {
  const server = createHttpServer((request, response) => {
    const headers = { ...request.headers, host: new URL(target).host }
    delete headers['accept-encoding']
    const upstream = httpRequest(
      new URL(request.url, target),
      { method: request.method, headers },
      (reply) => {
        const type = reply.headers['content-type'] ?? ''
        if (!REWRITTEN_TYPES.test(type)) {
          response.writeHead(reply.statusCode, reply.headers)
          reply.pipe(response)
          return
        }
        const chunks = []
        reply.on('data', (chunk) => chunks.push(chunk))
        reply.on('end', () => {
          let body = Buffer.concat(chunks).toString('utf8')
          for (const [from, to] of replacements) body = body.replaceAll(from, to)
          const { 'content-length': _length, ...rest } = reply.headers
          response.writeHead(reply.statusCode, rest)
          response.end(body)
        })
      },
    )
    upstream.on('error', (error) => {
      response.writeHead(502)
      response.end(error.message)
    })
    request.pipe(upstream)
  })
  const port = await freePort()
  await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen))
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise((resolveClose) => server.close(resolveClose)),
  }
}
