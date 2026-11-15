import { execFile, spawn } from 'node:child_process'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

export const appDir = fileURLToPath(new URL('../../../apps/realworld-legacy/', import.meta.url))
const CLI_PATH = join(appDir, 'node_modules/@genie-react/cli/dist/cli.js')
const DEMO_TOKEN = 'tok-u-1'
const MOCK_LATENCY_MS = 40
const BUILD_TIMEOUT_MS = 60_000
const CLI_TIMEOUT_MS = 30_000

export const MAX_RENDER_BUDGET = {
  adaptive: false,
  fiberLimit: 20_000,
  operationLimit: 2_000_000,
  timeLimitMs: 500,
  targetOperationReserve: 100_000,
  targetTimeReserveMs: 100,
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function freePort() {
  const server = createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  await new Promise((resolve) => server.close(resolve))
  return port
}

async function waitFor(condition, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await condition()) return
    await delay(50)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

function startHub(cwd, port) {
  const hub = spawn(process.execPath, [CLI_PATH, 'hub', '--port', String(port), '--json'], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const ready = new Promise((resolve, reject) => {
    const lines = createInterface({ input: hub.stdout })
    lines.on('line', (line) => {
      const event = JSON.parse(line)
      if (event.event === 'ready') resolve(event.data)
      else if (event.status === 'error') reject(new Error(`hub failed: ${event.message}`))
    })
    hub.once('exit', (code) => reject(new Error(`hub exited with ${code}`)))
  })
  return { hub, ready }
}

async function startDevServer({ sourceDir, port, hubPort }) {
  const require = createRequire(join(appDir, 'package.json'))
  const webpack = require('webpack')
  const WebpackDevServer = require('webpack-dev-server')
  Object.assign(process.env, {
    APP_SOURCE_DIR: sourceDir,
    PORT: String(port),
    GENIE_HUB_PORT: String(hubPort),
    MOCK_LATENCY_MS: String(MOCK_LATENCY_MS),
  })
  const config = require(join(appDir, 'webpack.config.js'))({}, { mode: 'development' })
  config.infrastructureLogging = { level: 'error' }
  config.stats = 'errors-only'
  config.devServer = { ...config.devServer, liveReload: false, client: false }
  const compiler = webpack(config)
  const build = { invalidations: 0, completed: 0, stats: null }
  compiler.hooks.invalid.tap('probe-harness', () => {
    build.invalidations += 1
  })
  compiler.hooks.done.tap('probe-harness', (stats) => {
    build.completed = build.invalidations
    build.stats = stats
  })
  const server = new WebpackDevServer(config.devServer, compiler)
  await server.start()
  await waitFor(() => build.stats !== null, BUILD_TIMEOUT_MS, 'the first webpack build')
  return { server, build }
}

/** Starts a private hub and dev server against a scratch copy of the app's src/ so reference fixes never touch the checkout. */
export async function start() {
  const workDir = await mkdtemp(join(appDir, '.probe-'))
  const sourceDir = join(workDir, 'src')
  await cp(join(appDir, 'src'), sourceDir, { recursive: true })
  const hubRoot = await mkdtemp(join(tmpdir(), 'realworld-legacy-hub-'))
  const [port, hubPort] = [await freePort(), await freePort()]
  const { hub, ready } = startHub(hubRoot, hubPort)
  let dev = null
  const stop = async () => {
    await dev?.server.stop()
    hub.kill('SIGTERM')
    await rm(workDir, { recursive: true, force: true })
    await rm(hubRoot, { recursive: true, force: true })
  }
  try {
    await ready
    dev = await startDevServer({ sourceDir, port, hubPort })
  } catch (error) {
    await stop()
    throw error
  }
  const { build } = dev
  const baseUrl = `http://127.0.0.1:${port}`
  const originals = new Map()

  const rebuild = async (write) => {
    const before = build.invalidations
    await write()
    await waitFor(
      () => build.invalidations > before && build.completed === build.invalidations,
      BUILD_TIMEOUT_MS,
      'webpack to rebuild',
    )
    await delay(300)
    await waitFor(() => build.completed === build.invalidations, BUILD_TIMEOUT_MS, 'rebuild')
    if (build.stats.hasErrors()) {
      throw new Error(build.stats.toString({ all: false, errors: true }))
    }
  }

  return {
    baseUrl,
    async applyEdits(edits) {
      await rebuild(async () => {
        for (const edit of edits) {
          const path = join(workDir, edit.file)
          const text = await readFile(path, 'utf8')
          if (!originals.has(path)) originals.set(path, text)
          const occurrences = text.split(edit.find).length - 1
          if (occurrences !== 1) {
            throw new Error(`${edit.file}: expected one match for the edit, found ${occurrences}`)
          }
          await writeFile(
            path,
            text.replace(edit.find, () => edit.replace),
          )
        }
      })
    },
    async restore() {
      if (originals.size === 0) return
      await rebuild(async () => {
        for (const [path, text] of originals) await writeFile(path, text)
      })
      originals.clear()
    },
    async resetBackend(options = {}) {
      const response = await fetch(`${baseUrl}/api/__control/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      })
      if (!response.ok) throw new Error(`backend reset failed with ${response.status}`)
    },
    session: (page, name) => createSession({ page, name, baseUrl, hubRoot }),
    stop,
  }
}

function runCli(args, { cwd, session }) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [CLI_PATH, ...args, '--session', session, '--json'],
      {
        cwd,
        env: { ...process.env, GENIE_SESSION: session },
        timeout: CLI_TIMEOUT_MS,
        maxBuffer: 20_000_000,
      },
      (error, stdout, stderr) => resolve({ code: error ? (error.code ?? 1) : 0, stdout, stderr }),
    )
  })
}

function createSession({ page, name, baseUrl, hubRoot }) {
  const cli = async (args) => {
    const result = await runCli(args, { cwd: hubRoot, session: name })
    let parsed
    try {
      parsed = JSON.parse(result.stdout)
    } catch {
      throw new Error(
        `genie-react ${args.join(' ')} printed non-JSON: ${result.stdout}${result.stderr}`,
      )
    }
    if (result.code !== 0) {
      throw new Error(
        `genie-react ${args.slice(0, 2).join(' ')} failed: ${parsed.reason}: ${parsed.message} ${JSON.stringify(parsed.details ?? {})}`,
      )
    }
    return parsed
  }
  const call = (tool, args = {}) => cli(['call', tool, JSON.stringify(args)])

  return {
    name,
    page,
    call,
    async open(path, { signedIn = true } = {}) {
      if (signedIn)
        await page.addInitScript(
          (token) => window.localStorage.setItem('acme.token', token),
          DEMO_TOKEN,
        )
      const separator = path.includes('?') ? '&' : '?'
      await page.goto(`${baseUrl}${path}${separator}_genie=${encodeURIComponent(name)}`)
      const status = await cli(['status', '--wait', '20000'])
      if (status.ready !== true) throw new Error(`Genie session ${name} is not ready`)
    },
    async clearRenders(components) {
      return call('react_clear_renders', { components, budget: MAX_RENDER_BUDGET })
    },
    async quiesce() {
      const result = await call('react_quiesce', { idleMs: 500, timeoutMs: 10_000 })
      if (result.outcome !== 'idle') throw new Error(`react_quiesce ended ${result.outcome}`)
      return result
    },
    /** Sums updates across every record whose name is one of `names`, and reports whether any commit work went unmeasured. */
    async renderUpdates(component, names = [component]) {
      const report = await call('react_get_renders', { component, appOnly: false, limit: 50 })
      const records = report.components.filter((entry) => names.includes(entry.name))
      const coverage = report.coverage ?? {}
      return {
        updates: records.reduce((sum, entry) => sum + entry.updates, 0),
        totalUpdates: report.summary?.totalUpdates ?? null,
        records,
        measured:
          report.tracking === true &&
          coverage.skippedCommitFibers === 0 &&
          coverage.budgetExhaustedCommits === 0,
      }
    },
    async cohort(component) {
      return call('react_component_cohort', { component, exact: true, limit: 1 })
    },
    async findComponents(component) {
      const result = await call('react_find_components', { component, exact: true, limit: 100 })
      return result.matches
    },
    async inspect(id) {
      return call('react_inspect_component', { id })
    },
    async recordTimeline(label, action, options = {}) {
      const { id } = await call('timeline_start', { name: label, ...options })
      try {
        await action()
      } finally {
        await call('timeline_stop', { id })
      }
      const events = []
      for (let offset = 0; offset !== null; ) {
        const pageOfEvents = await call('timeline_read', { id, offset, limit: 500 })
        events.push(...pageOfEvents.events)
        offset = pageOfEvents.nextOffset ?? null
      }
      return events
    },
    async reduxState(path) {
      return call('redux_state', { path, depth: 6 })
    },
    async reduxLatestSequence() {
      return (await call('redux_actions', { limit: 1 })).latestSequence
    },
    /** Every retained redux_actions record after `afterSequence`, read page by page. */
    async reduxActions({ afterSequence = 0, ...filters } = {}) {
      const records = []
      for (let cursor = afterSequence; ; ) {
        const page = await call('redux_actions', { ...filters, afterSequence: cursor, limit: 200 })
        records.push(...page.records)
        if (!page.more) return { records, coverage: page.coverage }
        cursor = page.nextAfterSequence
      }
    },
  }
}

export function check(name, pass, detail) {
  return { name, pass: Boolean(pass), detail }
}
