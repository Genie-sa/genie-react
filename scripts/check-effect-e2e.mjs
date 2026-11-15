#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES = [join(ROOT, 'packages/genie-react'), join(ROOT, 'packages/cli')]
const CONSUMER_DEPENDENCIES = ['react@19.2.7', 'react-dom@19.2.7', 'vite@8.1.0']
const MAX_OUTPUT = 1_000_000

// Each fixture writes what really ran to window.__oracle so assertions compare Genie's report with ground truth from the page.
const APP = `import { Activity, Component, StrictMode, createElement as h, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

const oracle = (window.__oracle = [])

function Cascade() {
  const [count, setCount] = useState(0)
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    oracle.push('cascade ' + count)
    if (count < 3) setCount(count + 1)
  }, [armed, count])
  return h('button', { id: 'cascade', onClick: () => setArmed(true) }, 'cascade ' + count)
}

function Subscriber() {
  useEffect(() => {
    oracle.push('subscribe')
    return () => oracle.push('unsubscribe')
  }, [])
  return h('span', { id: 'subscriber' }, 'subscribed')
}

function Panel() {
  useEffect(() => {
    oracle.push('panel connected')
    return () => oracle.push('panel disconnected')
  }, [])
  return h('span', null, 'panel')
}

function Tabs() {
  const [mode, setMode] = useState('visible')
  return h('div', null,
    h('button', { id: 'toggle-panel', onClick: () => setMode(mode === 'visible' ? 'hidden' : 'visible') }, 'toggle panel'),
    h(Activity, { mode }, h(Panel)))
}

let broken = false
function Fragile() {
  if (broken) throw new Error('fragile failed')
  return h('span', { id: 'fragile' }, 'fragile ok')
}

class Boundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return h('button', { id: 'retry', onClick: () => { broken = false; this.setState({ error: null }) } }, 'retry')
  }
}

function Shell() {
  const [tick, setTick] = useState(0)
  const [, rerender] = useState(0)
  return h('main', { id: 'lab' },
    h('button', { id: 'tick', onClick: () => setTick(tick + 1) }, 'tick ' + tick),
    h('button', { id: 'break', onClick: () => { broken = true; rerender((value) => value + 1) } }, 'break'),
    h(Boundary, null, h(Fragile, { tick })),
    h(Cascade),
    h(Tabs),
    h(Subscriber))
}

createRoot(document.getElementById('root')).render(h(StrictMode, null, h(Shell)))
`

const children = new Set()
let browser
let workspace

function appendBounded(current, chunk) {
  const combined = current + chunk.toString()
  return combined.length <= MAX_OUTPUT ? combined : combined.slice(-MAX_OUTPUT)
}

function delay(ms) {
  return new Promise((done) => setTimeout(done, ms))
}

function assert(condition, message, detail) {
  if (!condition) {
    throw new Error(
      detail === undefined ? message : `${message}\n${JSON.stringify(detail, null, 2)}`,
    )
  }
}

async function freePort() {
  const server = createServer()
  await new Promise((done, fail) => {
    server.once('error', fail)
    server.listen(0, '127.0.0.1', done)
  })
  const address = server.address()
  await new Promise((done) => server.close(done))
  if (!address || typeof address === 'string') throw new Error('Could not allocate a port')
  return address.port
}

function spawnTracked(command, args, options) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options })
  children.add(child)
  child.output = ''
  child.stdout.on('data', (chunk) => {
    child.output = appendBounded(child.output, chunk)
  })
  child.stderr.on('data', (chunk) => {
    child.output = appendBounded(child.output, chunk)
  })
  child.once('close', () => children.delete(child))
  return child
}

async function run(command, args, { cwd, timeoutMs = 120_000 } = {}) {
  const child = spawnTracked(command, args, { cwd })
  let stdout = ''
  child.stdout.on('data', (chunk) => {
    stdout = appendBounded(stdout, chunk)
  })
  const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
  const [code] = await once(child, 'close')
  clearTimeout(timer)
  if (code !== 0) throw new Error(`${command} ${args.join(' ')} exited ${code}\n${child.output}`)
  return stdout
}

async function waitFor(label, probe, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const value = await probe()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await delay(150)
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`)
}

async function prepareWorkspace() {
  workspace = await mkdtemp(join(tmpdir(), 'genie-effect-e2e-'))
  await mkdir(join(workspace, 'src'))
  await writeFile(
    join(workspace, 'package.json'),
    '{"name":"genie-effect-e2e","private":true,"type":"module"}\n',
  )
  await writeFile(
    join(workspace, 'index.html'),
    '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.js"></script></body></html>\n',
  )
  await writeFile(
    join(workspace, 'vite.config.mjs'),
    "import { defineConfig } from 'vite'\nimport { genie } from 'genie-react/vite'\n\nexport default defineConfig({ plugins: [genie()] })\n",
  )
  await writeFile(join(workspace, 'src/main.js'), APP)
  const tarballs = []
  for (const packageRoot of PACKAGES) {
    const packed = JSON.parse(
      await run('pnpm', ['pack', '--json', '--pack-destination', workspace], { cwd: packageRoot }),
    )
    tarballs.push(resolve(packed.filename))
  }
  await run(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      ...tarballs,
      ...CONSUMER_DEPENDENCIES,
    ],
    { cwd: workspace },
  )
}

async function cli(tool, input = {}) {
  const entry = join(workspace, 'node_modules/@genie-react/cli/dist/cli.js')
  const stdout = await run(
    process.execPath,
    [entry, 'call', tool, JSON.stringify(input), '--json', '--wait', '5000'],
    { cwd: workspace, timeoutMs: 20_000 },
  )
  return JSON.parse(stdout)
}

async function effectEvents(component) {
  const timeline = await cli('react_effect_timeline', { component, limit: 200 })
  return timeline.events.filter((event) => event.componentName === component).reverse()
}

const reactUpdates = (event) =>
  event.consequences.events
    .filter((item) => item.kind === 'react-update')
    .map((item) => item.status)

const resultingCommits = (event) =>
  event.consequences.events
    .filter((item) => item.kind === 'resulting-commit')
    .map((item) => item.documentCommitId)

async function settle(page) {
  await cli('react_quiesce', { idleMs: 300, timeoutMs: 10_000 })
  return page.evaluate(() => window.__oracle.splice(0))
}

async function main() {
  await prepareWorkspace()
  const port = await freePort()
  const vite = spawnTracked(
    process.execPath,
    [
      join(workspace, 'node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    { cwd: workspace, detached: process.platform !== 'win32' },
  )
  await waitFor('Vite', async () => {
    if (vite.exitCode !== null) throw new Error(`Vite exited early\n${vite.output}`)
    return (await fetch(`http://127.0.0.1:${port}/`)).ok
  })

  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })
  await page.locator('#lab').waitFor({ timeout: 10_000 })
  await waitFor(
    'a ready session',
    async () => (await cli('react_get_tree', { depth: 2 })).nodes?.length > 0,
  )

  const strict = await effectEvents('Subscriber')
  const strictOracle = (await settle(page)).filter((entry) => entry.endsWith('subscribe'))
  assert(
    JSON.stringify(strictOracle) === JSON.stringify(['subscribe', 'unsubscribe', 'subscribe']),
    'StrictMode oracle changed',
    strictOracle,
  )
  assert(
    strict.length === 1 &&
      strict[0].execution.trigger === 'strict-mode-replay' &&
      strict[0].cleanupExecution.reason === 'not-yet-observed',
    'StrictMode replay was not labelled, or the live subscription was reported as cleaned up',
    strict,
  )

  await cli('react_clear_renders', {})
  await page.click('#cascade')
  const cascadeOracle = await settle(page)
  const cascade = (await effectEvents('Cascade')).filter(
    (event) => event.execution.status === 'observed',
  )
  assert(
    JSON.stringify(cascadeOracle) ===
      JSON.stringify(['cascade 0', 'cascade 1', 'cascade 2', 'cascade 3']),
    'Cascade oracle changed',
    cascadeOracle,
  )
  assert(
    cascade.length === 4 &&
      cascade
        .slice(0, 3)
        .every(
          (event, index) =>
            reactUpdates(event).join() === 'scheduled' &&
            resultingCommits(event).join() === String(cascade[index + 1].documentCommitId),
        ) &&
      reactUpdates(cascade[3]).length === 0 &&
      resultingCommits(cascade[3]).length === 0,
    'Cascade steps were not linked to the commits that processed their updates',
    cascade.map((event) => event.consequences.events),
  )

  await cli('react_clear_renders', {})
  await page.click('#toggle-panel')
  await page.click('#toggle-panel')
  const panelOracle = await settle(page)
  const panel = await effectEvents('Panel')
  assert(
    JSON.stringify(panelOracle) ===
      JSON.stringify([
        'panel disconnected',
        'panel connected',
        'panel disconnected',
        'panel connected',
      ]),
    'Activity oracle changed',
    panelOracle,
  )
  const revealRuns = panel.flatMap((event) =>
    event.timeline
      .filter((entry) => entry.stage !== 'schedule')
      .map((entry) => `${entry.stage}:${entry.trigger ?? '-'}`),
  )
  assert(
    JSON.stringify(revealRuns) ===
      JSON.stringify([
        'execution:reconnect',
        'cleanup:strict-mode-replay',
        'execution:strict-mode-replay',
      ]),
    'The Activity reveal and its StrictMode replay were not reported as they ran',
    panel.map((event) => event.timeline),
  )

  await page.click('#break')
  await page.locator('#retry').waitFor({ timeout: 5_000 })
  await page.click('#tick')
  await cli('react_clear_renders', {})
  const failing = await cli('react_error_state', { includeSource: false })
  assert(
    failing.caughtErrors.length === 1 &&
      failing.caughtErrors[0].status === 'active' &&
      failing.caughtErrors[0].message === 'fragile failed' &&
      failing.caughtErrors[0].throwingComponent === 'Fragile',
    'A fallback still on screen was not reported after a re-render and a new observation',
    failing,
  )
  await page.click('#retry')
  await page.locator('#fragile').waitFor({ timeout: 5_000 })
  const healthy = await cli('react_error_state', { includeSource: false })
  assert(
    healthy.caughtErrors.length === 0 && healthy.blankTreeHint === null,
    'A recovered boundary was still reported',
    healthy,
  )
  process.stdout.write(
    'Effect and error E2E passed: StrictMode replay, cascade updates, Activity reconnect, boundary state.\n',
  )
}

async function cleanup() {
  if (browser) await browser.close().catch(() => {})
  for (const child of children) {
    try {
      if (child.spawnargs.includes('--strictPort') && child.pid && process.platform !== 'win32') {
        process.kill(-child.pid, 'SIGTERM')
      } else {
        child.kill('SIGTERM')
      }
    } catch {}
  }
  await delay(300)
  if (workspace) await rm(workspace, { recursive: true, force: true })
}

try {
  await main()
} catch (error) {
  process.exitCode = 1
  console.error(error)
} finally {
  await cleanup()
}
