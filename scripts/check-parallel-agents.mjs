#!/usr/bin/env node
// Stress check for several agents on one machine: real Vite hubs per simulated worktree, real app tabs in Chromium, and real CLI processes with their own identities.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createServer as createTcpServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const cliEntry = join(root, 'packages/cli/dist/cli.js')
const LOAD_SECONDS = Number(process.env.GENIE_STRESS_SECONDS ?? 20)
const LOAD_AGENTS = Number(process.env.GENIE_STRESS_AGENTS ?? 6)
const LOAD_TABS = Number(process.env.GENIE_STRESS_TABS ?? 4)
const CLI_KILL_MS = 30_000
const OPTIMIZED_DEPS = [
  'react',
  'react-dom/client',
  '@tanstack/react-query',
  'genie-react',
  'genie-react/tools',
]

// Tokens, spills and drafts go to a private runtime directory, never the developer's real one.
const runtimeDir = await mkdtemp(join(tmpdir(), 'genie-parallel-runtime-'))
process.env.XDG_RUNTIME_DIR = runtimeDir

const require = createRequire(join(root, 'apps/router-demo/package.json'))
const { createServer } = await import(require.resolve('vite'))
const { genie } = await import(new URL('../packages/genie-react/dist/vite.js', import.meta.url))
const { startGenieHub } = await import(
  new URL('../packages/genie-react/dist/hub.js', import.meta.url)
)

setFlagsFromString('--expose_gc')
const collectGarbage = runInNewContext('gc')

const fixtureRoot = await mkdtemp(join(root, 'apps/router-demo/.genie-parallel-'))
const servers = new Set()
const hubs = new Set()
const childProcesses = new Set()
const failures = []
const pageErrors = []
const report = {}
let browser

const APP_SOURCE = `
import { createElement as h, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { Genie } from 'genie-react'
import { defineGenieTool, registerGenieTools } from 'genie-react/tools'
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })
registerGenieTools(
  defineGenieTool({
    name: 'block',
    kind: 'query',
    description: 'Blocks this tab main thread for six seconds.',
    handler: () => {
      const until = performance.now() + 6000
      while (performance.now() < until) {}
      return { blocked: true }
    },
  }),
)
function Row({ index }) {
  return h('li', null, 'row ' + index)
}
function Counter() {
  const [count, setCount] = useState(0)
  const todos = useQuery({ queryKey: ['todos'], queryFn: async () => [1, 2, 3] })
  return h('main', null,
    h('button', { onClick: () => setCount(count + 1) }, 'Increment ' + count),
    h('output', null, todos.data ? 'loaded' : 'loading'),
    h('ul', null, [0, 1, 2, 3].map((index) => h(Row, { key: index, index }))))
}
createRoot(document.getElementById('root')).render(
  h(QueryClientProvider, { client: queryClient }, h(Counter), h(Genie, { queryClient })),
)
`

function check(label, condition, detail) {
  if (!condition) failures.push({ label, ...(detail === undefined ? {} : { detail }) })
}

async function freePort() {
  const server = createTcpServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  await new Promise((resolve) => server.close(resolve))
  return port
}

/** An app root with its own `.git` marker: a directory for a main checkout, a file for a linked worktree. */
async function appRoot(path, { linked = false, git = true } = {}) {
  await mkdir(path, { recursive: true })
  if (git && linked) await writeFile(join(path, '.git'), 'gitdir: elsewhere\n')
  else if (git) await mkdir(join(path, '.git'), { recursive: true })
  await writeFile(
    join(path, 'index.html'),
    '<div id="root"></div><script type="module" src="/main.js"></script>',
  )
  await writeFile(join(path, 'main.js'), APP_SOURCE)
  await mkdir(join(path, 'src'), { recursive: true })
  return path
}

async function startVite(path) {
  const server = await createServer({
    configFile: false,
    root: path,
    // Vite servers sharing one dependency cache race their optimizers into duplicate React copies, so each gets its own.
    cacheDir: join(path, `.vite-cache-${randomUUID()}`),
    // Optimizing at startup avoids the mid-load reload a newly discovered dependency triggers.
    optimizeDeps: {
      include: OPTIMIZED_DEPS,
    },
    logLevel: 'silent',
    plugins: [genie()],
    server: { host: '127.0.0.1', port: 0, strictPort: true },
  })
  await server.listen()
  servers.add(server)
  const discovery = join(path, '.genie/bridge.json')
  const deadline = Date.now() + 10_000
  while (!existsSync(discovery) && Date.now() < deadline) await delay(25)
  return { server, url: `http://127.0.0.1:${server.httpServer.address().port}` }
}

async function stopVite(server) {
  servers.delete(server)
  await server.close()
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const VITE_PROCESS_SOURCE = `
const [viteEntry, pluginEntry, root, cacheDir] = process.argv.slice(2)
const { createServer } = await import(viteEntry)
const { genie } = await import(pluginEntry)
const server = await createServer({
  configFile: false,
  root,
  cacheDir,
  optimizeDeps: { include: JSON.parse(process.env.GENIE_OPTIMIZE_DEPS) },
  logLevel: 'warn',
  plugins: [genie()],
  server: { host: '127.0.0.1', port: 0, strictPort: true },
})
await server.listen()
console.log(JSON.stringify({ port: server.httpServer.address().port }))
process.on('SIGTERM', () => server.close().then(() => process.exit(0)))
`

/** A dev server in its own process, as a second terminal or agent would start it. */
async function viteProcess(path) {
  const script = join(path, `vite-${randomUUID()}.mjs`)
  await writeFile(script, VITE_PROCESS_SOURCE)
  const child = spawn(
    process.execPath,
    [
      script,
      require.resolve('vite'),
      new URL('../packages/genie-react/dist/vite.js', import.meta.url).href,
      path,
      join(path, `.vite-cache-${randomUUID()}`),
    ],
    {
      cwd: path,
      env: { ...process.env, GENIE_OPTIMIZE_DEPS: JSON.stringify(OPTIMIZED_DEPS) },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let output = ''
  child.stdout.on('data', (chunk) => {
    output += chunk
  })
  child.stderr.on('data', (chunk) => {
    output += chunk
  })
  childProcesses.add(child)
  child.once('close', () => childProcesses.delete(child))
  const deadline = Date.now() + 30_000
  let port
  while (port === undefined && Date.now() < deadline) {
    port = output.match(/\{"port":(\d+)\}/)?.[1]
    if (port === undefined) await delay(50)
  }
  assert.ok(port, `dev server process did not start: ${output}`)
  await delay(500)
  return { url: `http://127.0.0.1:${port}`, log: () => output, stop: () => child.kill('SIGTERM') }
}

const CHILD_ENV = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !key.startsWith('GENIE_') &&
        !key.startsWith('AGENT_BROWSER_') &&
        key !== 'CLAUDE_CODE_SESSION_ID' &&
        key !== 'CODEX_THREAD_ID',
    ),
  ),
  // These tabs run in Playwright, so the CLI must not scan the developer's agent-browser sessions for them.
  GENIE_AGENT_BROWSER: join(runtimeDir, 'no-agent-browser'),
}

/** One CLI process, as an agent's shell runs it; `--json` keeps stdout parseable and stderr JSON Lines. */
function cli(args, { cwd, agent, env = {} }) {
  return new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(process.execPath, [cliEntry, ...args, '--json'], {
      cwd,
      env: { ...CHILD_ENV, ...(agent === undefined ? {} : { GENIE_AGENT: agent }), ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    const killer = setTimeout(() => child.kill('SIGKILL'), CLI_KILL_MS)
    child.once('close', (code, signal) => {
      clearTimeout(killer)
      let json
      try {
        json = JSON.parse(stdout)
      } catch {
        json = undefined
      }
      const diagnostics = stderr
        .split('\n')
        .filter(Boolean)
        .flatMap((line) => {
          try {
            return [JSON.parse(line)]
          } catch {
            return []
          }
        })
      resolve({ code, signal, json, stdout, diagnostics, ms: Date.now() - started })
    })
  })
}

const call = (tool, args, options) =>
  cli(['call', tool, JSON.stringify(args), ...sessionFlag(options.session)], options)
const sessionFlag = (session) => (session === undefined ? [] : ['--session', session])

async function openTab(appUrl, name) {
  const context = await browser.newContext()
  const page = await context.newPage()
  page.on('pageerror', (error) =>
    failures.push({ label: `page error in ${name ?? 'tab'}`, detail: error.message }),
  )
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text())
  })
  await page.goto(name === undefined ? appUrl : `${appUrl}/?_genie=${name}`)
  await page.getByRole('button', { name: /Increment/ }).waitFor()
  return page
}

async function waitReady(cwd, agent, session) {
  const result = await cli(['status', '--wait', '15000', ...sessionFlag(session)], { cwd, agent })
  assert.equal(result.json?.ready, true, `session ${session} must be ready: ${result.stdout}`)
  return result.json
}

const failureOf = (result) =>
  result.json?.status === 'error'
    ? { reason: result.json.reason, hubCode: result.json.details?.hubCode }
    : null

async function sharedTabScenario(app) {
  const options = (agent) => ({ cwd: app.root, agent, session: 'shared' })
  await openTab(app.url, 'shared')
  await waitReady(app.root, 'first', 'shared')
  const outcome = {}

  await call('react_clear_renders', {}, options('first'))
  const restart = await call('react_clear_renders', {}, options('second'))
  check(
    'a second agent that restarts the render window is told it displaced another',
    restart.diagnostics.some((line) => line.reason === 'window-displaced'),
    restart.diagnostics,
  )
  const firstRead = await call('react_get_renders', { limit: 5 }, options('first'))
  const secondRead = await call('react_get_renders', { limit: 5 }, options('second'))
  outcome.restartedWindow = failureOf(firstRead)
  check(
    'the first agent read fails as superseded after another agent restarted its window',
    failureOf(firstRead)?.reason === 'conflict' &&
      failureOf(firstRead)?.hubCode === 'OBSERVATION_SUPERSEDED',
    firstRead.json,
  )
  check(
    'the second agent reads its own window',
    secondRead.code === 0 && typeof secondRead.json?.observation?.id === 'string',
    secondRead.json,
  )

  await call('react_profile_start', {}, options('first'))
  await call('react_profile_stop', {}, options('second'))
  const paused = await call('react_profile_report', {}, options('first'))
  outcome.pausedWindow = failureOf(paused)
  check(
    'profiling paused by another agent fails the owner report',
    failureOf(paused)?.hubCode === 'OBSERVATION_SUPERSEDED' &&
      paused.json?.details?.ownership?.cause === 'paused',
    paused.json,
  )

  const timeline = await call('timeline_start', { name: 'first' }, options('first'))
  const blocked = await call('timeline_start', { name: 'second' }, options('second'))
  outcome.timelineHeld = failureOf(blocked)
  check(
    'a second timeline start while another agent records is refused as held',
    failureOf(blocked)?.hubCode === 'STATE_HELD',
    blocked.json,
  )
  await call('timeline_stop', { id: timeline.json?.id }, options('first'))

  const found = await call('react_find_components', { query: 'Row', limit: 1 }, options('first'))
  const rowId = found.json?.matches?.[0]?.id
  const override = await call(
    'react_override_props',
    { id: rowId, props: { index: 99 } },
    options('first'),
  )
  check('the first agent applies an override', override.code === 0, override.json)
  const reset = await call('react_reset_overrides', {}, options('second'))
  outcome.overridesHeld = failureOf(reset)
  check(
    'another agent cannot reset overrides the first applied',
    failureOf(reset)?.hubCode === 'STATE_HELD',
    reset.json,
  )
  const ownReset = await call('react_reset_overrides', {}, options('first'))
  check('the owner resets its overrides', ownReset.code === 0, ownReset.json)

  const simulated = await call(
    'query_simulate_state',
    { queryKey: ['todos'], state: 'error' },
    options('first'),
  )
  check('the first agent simulates a Query error', simulated.code === 0, simulated.json)
  const restore = await call('query_restore_state', { all: true }, options('second'))
  outcome.simulationHeld = failureOf(restore)
  check(
    'another agent cannot restore a simulation the first holds',
    failureOf(restore)?.hubCode === 'STATE_HELD',
    restore.json,
  )
  await call('query_restore_state', { all: true }, options('first'))
  report.sharedTab = outcome
}

async function sessionScenario(app) {
  const outcome = {}
  await openTab(app.url, 'left')
  await openTab(app.url, 'right')
  await waitReady(app.root, 'left-agent', 'left')
  await waitReady(app.root, 'right-agent', 'right')
  const routed = await Promise.all(
    ['left', 'right'].flatMap((session) =>
      Array.from({ length: 4 }, () =>
        cli(['batch', JSON.stringify([{ tool: 'react_get_renders', args: { limit: 1 } }])], {
          cwd: app.root,
          agent: `${session}-agent`,
          env: { GENIE_SESSION: session },
        }).then((result) => ({ session, result })),
      ),
    ),
  )
  for (const { session, result } of routed) {
    check(
      `an agent pinned to ${session} is answered by ${session}`,
      result.json?.[0]?.session?.sessionName === session,
      result.json,
    )
  }

  const untargeted = await call('react_get_renders', { limit: 1 }, { cwd: app.root, agent: 'lost' })
  outcome.untargetedAmongClaimedTabs = failureOf(untargeted)
  check(
    'an agent without a session never lands on tabs other agents use',
    failureOf(untargeted)?.hubCode === 'SESSION_CLAIMED',
    untargeted.json,
  )

  await openTab(app.url, 'twin')
  await openTab(app.url, 'twin')
  const twin = await call(
    'react_get_renders',
    {},
    { cwd: app.root, agent: 'twin-a', session: 'twin' },
  )
  outcome.duplicateName = failureOf(twin)
  check(
    'two tabs opened under one name fail as ambiguous instead of picking one',
    failureOf(twin)?.hubCode === 'SESSION_AMBIGUOUS',
    twin.json,
  )
  report.sessions = outcome
}

async function firstTabRaceScenario() {
  const raceRoot = await appRoot(join(fixtureRoot, 'race'))
  const race = await startVite(raceRoot)
  await openTab(race.url)
  await cli(['status', '--wait', '15000'], { cwd: raceRoot, agent: 'warmup' })
  const results = await Promise.all(
    ['racer-a', 'racer-b', 'racer-c'].map((agent) =>
      call('react_get_renders', { limit: 1 }, { cwd: raceRoot, agent }),
    ),
  )
  const winners = results.filter((result) => result.code === 0).length
  const claimed = results.filter((result) => failureOf(result)?.hubCode === 'SESSION_CLAIMED')
  report.firstTabRace = { winners, claimed: claimed.length }
  check(
    'agents starting at once on one unnamed tab: one owns it, the others are told it is claimed',
    winners === 1 && claimed.length === 2,
    results.map((result) => result.json),
  )
  await stopVite(race.server)
}

async function hubsScenario() {
  const outcome = {}
  const mainRoot = await appRoot(join(fixtureRoot, 'main'))
  const worktreeRoot = await appRoot(join(mainRoot, '.claude/worktrees/feature'), { linked: true })
  const main = await startVite(mainRoot)
  const worktree = await startVite(worktreeRoot)
  await openTab(main.url, 'main-tab')
  await openTab(worktree.url, 'feature-tab')

  const fromWorktree = await cli(['status', '--wait', '15000'], {
    cwd: join(worktreeRoot, 'src'),
    agent: 'feature-agent',
  })
  outcome.worktreeReaches = fromWorktree.json?.app?.url
  check(
    'a CLI inside a nested worktree reaches that worktree hub, not the enclosing checkout',
    fromWorktree.json?.app?.url?.startsWith(worktree.url) &&
      fromWorktree.json.sessions.every((session) => !session.app.url?.startsWith(main.url)),
    fromWorktree.json,
  )
  const fromMain = await cli(['status', '--wait', '15000'], { cwd: mainRoot, agent: 'main-agent' })
  check(
    'a CLI in the main checkout reaches its own hub',
    fromMain.json?.app?.url?.startsWith(main.url),
    fromMain.json,
  )
  await stopVite(worktree.server)
  const afterStop = await cli(['status'], {
    cwd: join(worktreeRoot, 'src'),
    agent: 'feature-agent',
  })
  outcome.worktreeHubStopped = failureOf(afterStop)
  check(
    'with its own hub stopped, a worktree CLI fails instead of falling back to the enclosing checkout hub',
    afterStop.code !== 0 &&
      !(afterStop.json?.sessions ?? []).some((session) => session.app?.url?.startsWith(main.url)),
    afterStop.json,
  )

  const monorepo = join(fixtureRoot, 'monorepo')
  await mkdir(join(monorepo, '.git'), { recursive: true })
  const web = await startVite(await appRoot(join(monorepo, 'apps/web'), { git: false }))
  const admin = await startVite(await appRoot(join(monorepo, 'apps/admin'), { git: false }))
  const ambiguous = await cli(['status'], { cwd: monorepo, agent: 'root-agent' })
  outcome.monorepoRoot = failureOf(ambiguous)
  check(
    'from a monorepo root with several live hubs the CLI lists the choices instead of picking one',
    ambiguous.json?.reason === 'invalid_input' &&
      ambiguous.json.message.includes(join('apps', 'web')) &&
      ambiguous.json.message.includes(join('apps', 'admin')),
    ambiguous.json,
  )
  await stopVite(web.server)
  await stopVite(admin.server)

  const staleRoot = await appRoot(join(fixtureRoot, 'stale'))
  const dead = spawn(process.execPath, ['-e', ''])
  await new Promise((resolve) => dead.once('close', resolve))
  await mkdir(join(staleRoot, '.genie'), { recursive: true })
  await writeFile(
    join(staleRoot, '.genie/bridge.json'),
    JSON.stringify({ url: main.url.replace('http', 'ws') + '/__genie/ws', pid: dead.pid }),
  )
  const stale = await cli(['status'], { cwd: staleRoot, agent: 'stale-agent' })
  outcome.staleBridgeFile = failureOf(stale)
  check(
    'a stale bridge file from a crashed hub is removed and never routes to the live hub it named',
    stale.diagnostics.some((line) => line.reason === 'stale_discovery') &&
      !existsSync(join(staleRoot, '.genie/bridge.json')) &&
      stale.json?.connected !== true,
    { json: stale.json, diagnostics: stale.diagnostics },
  )

  const blocker = createTcpServer()
  const blockedPort = await freePort()
  await new Promise((resolve) => blocker.listen(blockedPort, '127.0.0.1', resolve))
  const unrelated = await appRoot(join(fixtureRoot, 'unrelated'))
  const hub = await startGenieHub({ rootDir: unrelated, port: blockedPort })
  if (hub.status === 'started') hubs.add(hub.handle)
  outcome.portWalk = { requested: blockedPort, bound: hub.port }
  check('a hub whose port is taken walks to another port', hub.port !== blockedPort, hub)
  const unrelatedStatus = await cli(['status'], { cwd: unrelated, agent: 'unrelated-agent' })
  check(
    'the CLI of the unrelated project reaches its walked hub',
    unrelatedStatus.code === 0 && unrelatedStatus.json?.connected === false,
    unrelatedStatus.json,
  )
  blocker.close()

  const twinRoot = await appRoot(join(fixtureRoot, 'twin-servers'))
  const twins = await Promise.all([viteProcess(twinRoot), viteProcess(twinRoot)])
  const published = JSON.parse(await readFile(join(twinRoot, '.genie/bridge.json'), 'utf8'))
  const owner = twins.find((twin) => published.url.includes(`:${new URL(twin.url).port}/`))
  const loser = twins.find((twin) => twin !== owner)
  check(
    'one of two dev servers started at once publishes the project',
    owner !== undefined,
    published,
  )
  check(
    'the other dev server says the CLI reaches the first one',
    loser?.log().includes('another running dev server or hub already publishes this project'),
    loser?.log(),
  )
  if (owner) await openTab(owner.url, 'twin-tab')
  const twinStatus = await cli(['status', '--session', 'twin-tab', '--wait', '15000'], {
    cwd: twinRoot,
    agent: 'twin-agent',
  })
  outcome.twinServers = { published: published.url, statusReady: twinStatus.json?.ready ?? null }
  check(
    'the published endpoint and token belong to the same server',
    twinStatus.json?.ready === true,
    twinStatus.json,
  )
  for (const twin of twins) twin.stop()
  await stopVite(main.server)
  report.hubs = outcome
}

async function sharedFilesScenario(app) {
  await openTab(app.url, 'spill')
  await waitReady(app.root, 'spill-0', 'spill')
  const results = await Promise.all(
    Array.from({ length: 30 }, (_, index) =>
      cli(['call', 'react_get_tree', '{"depth":20}', '--session', 'spill', '--max-bytes', '512'], {
        cwd: app.root,
        agent: `spill-${index % 6}`,
      }),
    ),
  )
  const paths = results.map((result) => result.json?.outputPath).filter(Boolean)
  const missing = []
  for (const path of paths) {
    try {
      JSON.parse(await readFile(path, 'utf8'))
    } catch {
      missing.push(path)
    }
  }
  report.spills = { written: paths.length, missingOrTorn: missing.length }
  check('every concurrent oversized result spills to a file', paths.length === results.length, {
    written: paths.length,
  })
  check(
    'no agent loses a spill another agent wrote meanwhile, and none is torn',
    missing.length === 0,
    missing,
  )
}

async function loadScenario(app) {
  const tabs = Array.from({ length: LOAD_TABS }, (_, index) => `load-${index}`)
  const pages = new Map()
  for (const tab of tabs) pages.set(tab, await openTab(app.url, tab))
  for (const tab of tabs) await waitReady(app.root, `${tab}-warmup`, tab)
  collectGarbage()
  const heapBefore = process.memoryUsage().heapUsed
  const deadline = Date.now() + LOAD_SECONDS * 1_000
  const latencies = []
  const unexpected = []
  let calls = 0
  let crossDelivered = 0
  let reloads = 0

  const allowedDuringReload = new Set(['not_connected', 'busy', 'timeout', 'unknown_session'])
  const disturbances = new Map()
  const disturb = (tab, delta) => disturbances.set(tab, (disturbances.get(tab) ?? 0) + delta)
  const disturbed = (tab) => (disturbances.get(tab) ?? 0) > 0
  const agentsPerTab = new Map()
  for (let index = 0; index < LOAD_AGENTS; index += 1) {
    const tab = tabs[index % tabs.length]
    agentsPerTab.set(tab, (agentsPerTab.get(tab) ?? 0) + 1)
  }
  let conflicts = 0
  let foreignWindows = 0
  const agentLoop = async (index) => {
    const tab = tabs[index % tabs.length]
    const shared = agentsPerTab.get(tab) > 1
    const agent = `load-agent-${index}`
    let window = null
    while (Date.now() < deadline) {
      const tool =
        window === null
          ? { tool: 'react_clear_renders', args: {} }
          : { tool: 'react_get_renders', args: { limit: 3 } }
      const result = await cli(['batch', JSON.stringify([tool])], {
        cwd: app.root,
        agent,
        env: { GENIE_SESSION: tab },
      })
      calls += 1
      latencies.push(result.ms)
      const row = result.json?.[0]
      const reason = row?.reason ?? result.json?.reason
      if (result.signal) {
        unexpected.push({ agent, tab, hung: result.signal })
      } else if (row?.ok) {
        if (row.session?.sessionName !== tab) crossDelivered += 1
        const observation = row.result?.observation?.id
        if (window === null) window = observation ?? null
        else if (observation !== window) foreignWindows += 1
      } else if (reason === 'conflict' && row?.details?.hubCode === 'OBSERVATION_SUPERSEDED') {
        if (row.details.ownership?.cause !== 'reloaded') conflicts += 1
        window = null
        if (!shared && !disturbed(tab)) unexpected.push({ agent, tab, row })
      } else {
        window = null
        if (!(disturbed(tab) && allowedDuringReload.has(reason)))
          unexpected.push({ agent, tab, row: row ?? result.json })
      }
    }
  }
  const reloader = async () => {
    while (Date.now() < deadline - 3_000) {
      await delay(2_500)
      const tab = tabs[reloads % tabs.length]
      disturb(tab, 1)
      await pages.get(tab).reload()
      await pages
        .get(tab)
        .getByRole('button', { name: /Increment/ })
        .waitFor()
      await delay(1_500)
      disturb(tab, -1)
      reloads += 1
    }
  }
  const heavy = async () => {
    await delay(3_000)
    const heavyTab = tabs[0]
    disturb(heavyTab, 1)
    const busy = await call(
      'app_block',
      {},
      { cwd: app.root, agent: 'heavy-agent', session: heavyTab },
    )
    report.heavyCall = { reason: busy.json?.reason ?? null, ms: busy.ms }
    check(
      'a call blocking its own tab main thread fails fast as busy',
      busy.json?.reason === 'busy' && busy.ms < 6_000,
      { json: busy.json, ms: busy.ms },
    )
    await delay(4_000)
    disturb(heavyTab, -1)
  }
  await Promise.all([
    ...Array.from({ length: LOAD_AGENTS }, (_, index) => agentLoop(index)),
    reloader(),
    heavy(),
  ])
  collectGarbage()
  const heapAfter = process.memoryUsage().heapUsed
  latencies.sort((left, right) => left - right)
  const percentile = (p) =>
    latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))]
  report.load = {
    seconds: LOAD_SECONDS,
    agents: LOAD_AGENTS,
    tabs: LOAD_TABS,
    calls,
    reloads,
    crossDelivered,
    foreignWindows,
    conflicts,
    unexpected: unexpected.length,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    heapGrowthMb: Math.round((heapAfter - heapBefore) / 1_048_576),
  }
  check('no call is answered by another agent tab', crossDelivered === 0, { crossDelivered })
  check(
    'no successful read returns evidence from a window the agent did not start',
    foreignWindows === 0,
    { foreignWindows },
  )
  check(
    'agents sharing a tab under load are told when another restarts their window',
    [...agentsPerTab.values()].every((count) => count === 1) || conflicts > 0,
    { conflicts },
  )
  check(
    'every call ends in its own evidence or an expected typed error',
    unexpected.length === 0,
    unexpected.slice(0, 5),
  )
  check('the load ran long enough to mean something', calls >= LOAD_AGENTS * 10, { calls })
  check('hub memory stays bounded under load', heapAfter - heapBefore < 64 * 1_048_576, report.load)
}

async function hubRestartScenario() {
  const restartRoot = await appRoot(join(fixtureRoot, 'restart'))
  let app = await startVite(restartRoot)
  const page = await openTab(app.url, 'restart-tab')
  await waitReady(restartRoot, 'restart-agent', 'restart-tab')
  const inFlight = Array.from({ length: 6 }, (_, index) =>
    call(
      'react_get_renders',
      { limit: 1 },
      { cwd: restartRoot, agent: `restart-${index}`, session: 'restart-tab' },
    ),
  )
  await delay(150)
  await stopVite(app.server)
  const during = await Promise.all(inFlight)
  const typed = new Set([
    'bridge_unreachable',
    'not_connected',
    'operational_failure',
    'bridge_rejected',
    'unknown_session',
  ])
  for (const result of during) {
    check(
      'a call during a hub restart succeeds or fails with a typed connection reason, never hangs',
      !result.signal && (result.code === 0 || typed.has(result.json?.reason)),
      result.json ?? result.stdout,
    )
  }
  app = await startVite(restartRoot)
  await page.goto(`${app.url}/?_genie=restart-tab`)
  const after = await cli(['status', '--session', 'restart-tab', '--wait', '15000'], {
    cwd: restartRoot,
    agent: 'restart-agent',
  })
  report.hubRestart = {
    during: during.map((result) => result.json?.reason ?? 'ok'),
    afterReady: after.json?.ready ?? null,
  }
  check(
    'after the restart the CLI rediscovers the new hub and token',
    after.json?.ready === true,
    after.json,
  )
  await stopVite(app.server)
}

try {
  assert.ok(existsSync(cliEntry), 'Build the packages first: pnpm build')
  browser = await chromium.launch({ headless: true })
  const sharedRoot = await appRoot(join(fixtureRoot, 'shared'))
  const shared = await startVite(sharedRoot)
  const app = { root: sharedRoot, url: shared.url }
  await sharedTabScenario(app)
  await sessionScenario(app)
  await sharedFilesScenario(app)
  await loadScenario(app)
  await stopVite(shared.server)
  await firstTabRaceScenario()
  await hubsScenario()
  await hubRestartScenario()
} catch (error) {
  failures.push({
    label: 'harness error',
    detail: error instanceof Error ? error.stack : String(error),
  })
} finally {
  await browser?.close()
  for (const server of servers) await server.close().catch(() => {})
  for (const hub of hubs) await hub.close().catch(() => {})
  for (const child of childProcesses) child.kill('SIGTERM')
  await rm(fixtureRoot, { recursive: true, force: true })
  await rm(runtimeDir, { recursive: true, force: true })
}

console.log(
  JSON.stringify(
    {
      status: failures.length === 0 ? 'passed' : 'failed',
      report,
      failures,
      pageErrors: pageErrors.slice(0, 10),
    },
    (key, value) => (key === 'handle' ? undefined : value),
    2,
  ),
)
if (failures.length > 0) {
  console.error(
    `${failures.length} parallel-agent check(s) failed: ${failures.map((f) => f.label).join('; ')}`,
  )
  process.exitCode = 1
}
