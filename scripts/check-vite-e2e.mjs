#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, rmdir, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RUNTIME_PACKAGE_ROOT = join(ROOT, 'packages/genie-react')
const CLI_PACKAGE_ROOT = join(ROOT, 'packages/cli')
const MAX_PROCESS_OUTPUT = 1_000_000
const CONSUMER_DEPENDENCIES = [
  'react@19.2.7',
  'react-dom@19.2.7',
  'react-freeze@1.0.4',
  'vite@8.1.0',
  '@vitejs/plugin-react@6.0.3',
  '@rolldown/plugin-babel@0.2.3',
  '@babel/core@7.29.7',
  '@tanstack/react-query@5.101.2',
]

const childProcesses = new Set()
let browser
let viteProcess
let ownedDiscovery
let cleanupPromise
let interrupted = false
let temporaryRoot
let cliEntry
let viteEntry
let discoveryDirectory
let discoveryFile

function appendBounded(current, chunk) {
  const combined = current + chunk.toString()
  return combined.length <= MAX_PROCESS_OUTPUT ? combined : combined.slice(-MAX_PROCESS_OUTPUT)
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error && typeof error === 'object' && error.code === 'EPERM'
  }
}

async function readDiscovery() {
  if (!discoveryFile) return undefined
  try {
    const value = JSON.parse(await readFile(discoveryFile, 'utf8'))
    if (!value || typeof value !== 'object') return undefined
    return {
      pid: typeof value.pid === 'number' ? value.pid : undefined,
      url: typeof value.url === 'string' ? value.url : undefined,
    }
  } catch {
    return undefined
  }
}

async function availablePort() {
  const server = createServer()
  await new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  await new Promise((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  )
  if (!address || typeof address === 'string') throw new Error('Could not allocate an E2E port')
  return address.port
}

function startVite(port) {
  if (!temporaryRoot || !viteEntry) throw new Error('Packed Vite consumer is not installed')
  const child = spawn(
    process.execPath,
    [viteEntry, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: temporaryRoot,
      detached: process.platform !== 'win32',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  childProcesses.add(child)
  child.once('close', () => childProcesses.delete(child))
  child.stdout.on('data', (chunk) => {
    child.stdoutLog = appendBounded(child.stdoutLog ?? '', chunk)
  })
  child.stderr.on('data', (chunk) => {
    child.stderrLog = appendBounded(child.stderrLog ?? '', chunk)
  })
  return child
}

async function waitFor(label, probe, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const result = await probe()
      if (result) return result
    } catch (error) {
      lastError = error
    }
    await delay(100)
  }
  const detail = lastError instanceof Error ? `: ${lastError.message}` : ''
  throw new Error(`Timed out waiting for ${label}${detail}`)
}

async function waitForVite(port) {
  return waitFor(
    'the Vite demo',
    async () => {
      if (viteProcess.exitCode !== null || viteProcess.signalCode !== null) {
        throw new Error(
          `Vite exited early\nstdout:\n${viteProcess.stdoutLog ?? ''}\nstderr:\n${viteProcess.stderrLog ?? ''}`,
        )
      }
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(1_000),
      })
      return response.ok
    },
    30_000,
  )
}

async function runProcess(command, args, { cwd, env = process.env, timeoutMs = 12_000 } = {}) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  childProcesses.add(child)
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => {
    stdout = appendBounded(stdout, chunk)
  })
  child.stderr.on('data', (chunk) => {
    stderr = appendBounded(stderr, chunk)
  })
  const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
  try {
    const [code, signal] = await once(child, 'close')
    return { code, signal, stdout, stderr }
  } finally {
    clearTimeout(timer)
    childProcesses.delete(child)
  }
}

async function runCli(args, timeoutMs = 12_000) {
  if (!temporaryRoot || !cliEntry) throw new Error('Packed CLI is not installed')
  const env = { ...process.env }
  delete env.GENIE_BRIDGE_URL
  delete env.GENIE_BRIDGE_PORT
  delete env.GENIE_SESSION
  return runProcess(process.execPath, [cliEntry, ...args], { cwd: temporaryRoot, env, timeoutMs })
}

function parseSuccessfulJson(command, result) {
  if (result.code !== 0) {
    throw new Error(
      `${command} exited ${result.code ?? result.signal}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    )
  }
  try {
    return JSON.parse(result.stdout)
  } catch (error) {
    throw new Error(`${command} emitted invalid JSON: ${error.message}\nstdout:\n${result.stdout}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function preparePackagedConsumer() {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'genie-vite-e2e-'))
  discoveryDirectory = join(temporaryRoot, '.genie')
  discoveryFile = join(discoveryDirectory, 'bridge.json')
  await mkdir(join(temporaryRoot, 'src'), { recursive: true })
  await writeFile(
    join(temporaryRoot, 'package.json'),
    `${JSON.stringify({ name: 'genie-vite-e2e', private: true, type: 'module' }, null, 2)}\n`,
  )
  await writeFile(
    join(temporaryRoot, 'index.html'),
    '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.js"></script></body></html>\n',
  )
  await writeFile(
    join(temporaryRoot, 'vite.config.mjs'),
    `import { defineConfig } from 'vite'
import { genie } from 'genie-react/vite'
import genieNames from 'genie-react/babel'
import react from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

export default defineConfig(({ command }) => ({
  plugins: [genie(), react(), command === 'serve' && babel({ plugins: [genieNames] })],
}))
`,
  )
  await writeFile(
    join(temporaryRoot, 'src/main.js'),
    `import { Activity, createElement, memo, useEffect, useRef, useState } from 'react'
import 'genie-react/react-freeze'
import { Freeze } from 'react-freeze'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { Genie } from 'genie-react'

const queryClient = new QueryClient()
const policyKey = ['notification-policy']
const stableData = { value: 1 }
queryClient.setQueryData(policyKey, stableData, { updatedAt: 1 })

function PolicyConsumer({ tick }) {
  const query = useQuery({
    queryKey: policyKey, enabled: false, notifyOnChangeProps: ['data'],
  })
  return createElement('div', { id: 'policy-result' }, query.data.value + ':' + tick)
}

const MemoNameRow = memo(({ value }) => createElement('span', null, value))
const NamedMemoRow = memo(function InnerNamedRow({ value }) { return createElement('span', null, value) })
const ExplicitMemoRow = memo(({ value }) => createElement('span', null, value))
ExplicitMemoRow.displayName = 'CustomMemoRow'

function OwnershipRow({ index, revision }) {
  return createElement('span', { id: 'row-' + index }, index + ':' + revision)
}

function QuiesceCanvas() {
  const canvas = useRef(null)
  const [updates, setUpdates] = useState(0)
  useEffect(() => {
    let frame
    const paint = (time) => {
      const context = canvas.current?.getContext('2d')
      if (context) { context.clearRect(0,0,120,24); context.fillRect(time % 100, 0, 20, 20) }
      frame = requestAnimationFrame(paint)
    }
    frame = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(frame)
  }, [])
  return createElement('section', null,
    createElement('canvas', {ref: canvas, width:120, height:24}),
    createElement('output', {id:'quiesce-updates'}, updates),
    createElement('button', {id:'quiesce-interact', onClick: () => {
      setUpdates(value => value + 1)
      for (const delay of [30,60,90]) setTimeout(() => setUpdates(value => value + 1), delay)
    }}, 'Run canvas interaction'))
}

function FreezeProbe() {
  const [count, setCount] = useState(0)
  return createElement('button', { id: 'freeze-probe', onClick: () => setCount(value => value + 1) }, 'Retained:' + count)
}
function FreezeFallback() { return createElement('span', { id: 'freeze-fallback' }, 'Frozen placeholder') }
function FreezeFixture() {
  const [mode, setMode] = useState('active')
  return createElement('section', null,
    ['active', 'frozen', 'hidden', 'unmounted'].map(mode => createElement('button', { key: mode, id: 'freeze-' + mode, onClick: () => setMode(mode) }, mode)),
    mode !== 'unmounted' && createElement(Activity, { mode: mode === 'hidden' ? 'hidden' : 'visible' },
      createElement(Freeze, { freeze: mode === 'frozen', placeholder: createElement(FreezeFallback) }, createElement(FreezeProbe))),
  )
}

function App() {
  const [value, setValue] = useState(0)
  const [showRows, setShowRows] = useState(false)
  const [revision, setRevision] = useState(0)
  const query = useQuery({ queryKey: ['greeting'], queryFn: async () => 'hello' })
  const [tick, setTick] = useState(0)
  return createElement('main', { id: 'lab' },
    createElement(FreezeFixture),
    createElement('div', { id: 'greeting' }, query.data ?? query.status),
    createElement('button', { onClick: () => setShowRows(true) }, 'Mount rows'),
    createElement('button', { onClick: () => setRevision(value => value + 1) }, 'Update rows'),
    showRows && Array.from({ length: 241 }, (_, index) => createElement(OwnershipRow, { key: index, index, revision })),
    createElement(PolicyConsumer, { tick }),
    createElement(QuiesceCanvas),
    createElement('button', { id: 'metadata-update', onClick: () => {
      queryClient.setQueryData(policyKey, stableData, { updatedAt: 2 })
      setTick(value => value + 1)
    } }, 'Update timestamp and parent'),
    createElement('button', { id: 'data-update', onClick: () => {
      queryClient.setQueryData(policyKey, { value: 2 }, { updatedAt: 3 })
    } }, 'Update subscribed data'),
    createElement('button', { onClick: () => setValue((value) => value + 1) }, 'Update memo rows'),
    createElement(MemoNameRow, { value }), createElement(NamedMemoRow, { value }), createElement(ExplicitMemoRow, { value }),
  )
}

createRoot(document.getElementById('root')).render(
  createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(App),
    createElement(Genie, { queryClient }),
  ),
)
`,
  )

  const tarballs = []
  for (const packageRoot of [RUNTIME_PACKAGE_ROOT, CLI_PACKAGE_ROOT]) {
    const packed = parseSuccessfulJson(
      `pnpm pack ${packageRoot}`,
      await runProcess('pnpm', ['pack', '--json', '--pack-destination', temporaryRoot], {
        cwd: packageRoot,
        timeoutMs: 30_000,
      }),
    )
    assert(
      typeof packed.filename === 'string',
      `pnpm pack did not return a filename for ${packageRoot}`,
    )
    tarballs.push(resolve(packed.filename))
  }

  const installed = await runProcess(
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
    { cwd: temporaryRoot, timeoutMs: 120_000 },
  )
  if (installed.code !== 0) {
    throw new Error(
      `Install packed consumer exited ${installed.code ?? installed.signal}\nstdout:\n${installed.stdout}\nstderr:\n${installed.stderr}`,
    )
  }

  cliEntry = join(temporaryRoot, 'node_modules', '@genie-react', 'cli', 'dist', 'cli.js')
  viteEntry = join(temporaryRoot, 'node_modules', 'vite', 'bin', 'vite.js')
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = once(child, 'close')
  try {
    if (child === viteProcess && process.platform !== 'win32' && child.pid) {
      process.kill(-child.pid, 'SIGTERM')
    } else {
      child.kill('SIGTERM')
    }
  } catch {}
  if (await Promise.race([exited.then(() => true), delay(2_000).then(() => false)])) return
  try {
    if (child === viteProcess && process.platform !== 'win32' && child.pid) {
      process.kill(-child.pid, 'SIGKILL')
    } else {
      child.kill('SIGKILL')
    }
  } catch {}
  await Promise.race([once(child, 'close'), delay(2_000)])
}

async function removeOwnedDiscovery() {
  if (!ownedDiscovery) return
  const current = await readDiscovery()
  if (current?.pid !== ownedDiscovery.pid || current.url !== ownedDiscovery.url) return
  await rm(discoveryFile, { force: true })
  await rmdir(discoveryDirectory).catch(() => {})
}

async function cleanup() {
  if (cleanupPromise) return cleanupPromise
  cleanupPromise = (async () => {
    if (!ownedDiscovery && viteProcess) ownedDiscovery = await readDiscovery()
    if (browser) await Promise.race([browser.close(), delay(3_000)]).catch(() => {})
    await Promise.all([...childProcesses].map(stopChild))
    await removeOwnedDiscovery()
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true })
  })()
  return cleanupPromise
}

function handleSignal(signal) {
  if (interrupted) return
  interrupted = true
  void cleanup().finally(() => {
    process.removeListener('SIGINT', onSigint)
    process.removeListener('SIGTERM', onSigterm)
    process.kill(process.pid, signal)
  })
}

const onSigint = () => handleSignal('SIGINT')
const onSigterm = () => handleSignal('SIGTERM')

async function main() {
  await preparePackagedConsumer()
  const existingDiscovery = await readDiscovery()
  if (existingDiscovery?.pid && processIsAlive(existingDiscovery.pid)) {
    throw new Error(
      `A Genie dev server is already using ${discoveryFile} (pid ${existingDiscovery.pid}); stop it before running the E2E check.`,
    )
  }

  const port = await availablePort()
  viteProcess = startVite(port)
  await waitForVite(port)
  ownedDiscovery = await waitFor('Vite bridge discovery', readDiscovery, 5_000)

  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })
  await page.locator('#lab').waitFor({ state: 'visible', timeout: 10_000 })

  const status = await waitFor(
    'a ready CLI session',
    async () => {
      const result = await runCli(['status', '--json', '--connect-timeout', '1000'], 5_000)
      const value = parseSuccessfulJson('genie-react status --json', result)
      if (value.connected === true && value.ready === true) return value
      throw new Error(`latest status was ${result.stdout.trim()}`)
    },
    20_000,
  )
  assert(
    Array.isArray(status.sessions) && status.sessions.some((session) => session.ready === true),
    'CLI status did not report a ready browser session',
  )

  const tree = await waitFor(
    'React tree data through the CLI',
    async () => {
      const result = await runCli([
        'call',
        'react_get_tree',
        JSON.stringify({ depth: 4, maxNodes: 100 }),
        '--json',
        '--connect-timeout',
        '2000',
        '--wait',
        '5000',
      ])
      const value = parseSuccessfulJson('genie-react call react_get_tree', result)
      if (Array.isArray(value.nodes) && value.nodes.length > 0) return value
      throw new Error(`latest React tree was ${result.stdout.trim()}`)
    },
    15_000,
  )
  assert(
    tree.nodes.some((node) => node?.name === 'App'),
    'React tree did not include the demo App component',
  )

  const queryList = await waitFor(
    'TanStack Query data through the CLI',
    async () => {
      const result = await runCli([
        'call',
        'query_list',
        JSON.stringify({ limit: 20 }),
        '--json',
        '--connect-timeout',
        '2000',
        '--wait',
        '5000',
      ])
      const value = parseSuccessfulJson('genie-react call query_list', result)
      if (Array.isArray(value.queries) && value.queries.length > 0) return value
      throw new Error(`latest Query list was ${result.stdout.trim()}`)
    },
    15_000,
  )
  assert(
    queryList.queries.some((query) => JSON.stringify(query?.queryKey) === '["greeting"]'),
    'Query list did not include the demo greeting query',
  )
  parseSuccessfulJson(
    'clear memo observation',
    await runCli(['call', 'react_clear_renders', '{}', '--json']),
  )
  await page.getByRole('button', { name: 'Update memo rows' }).click()
  for (const component of ['MemoNameRow', 'InnerNamedRow', 'CustomMemoRow']) {
    const report = parseSuccessfulJson(
      'read memo renders',
      await runCli([
        'call',
        'react_get_renders',
        JSON.stringify({ component, appOnly: false, limit: 1 }),
        '--json',
      ]),
    )
    assert(
      report.components?.[0]?.name === component && report.components[0].updates === 1,
      `Memo render report did not preserve ${component}`,
    )
    const cohort = parseSuccessfulJson(
      'read memo cohort',
      await runCli([
        'call',
        'react_component_cohort',
        JSON.stringify({ component, exact: true, limit: 1 }),
        '--json',
      ]),
    )
    assert(
      cohort.instances?.[0]?.componentName === component,
      `Memo cohort did not preserve ${component}`,
    )
  }
  process.stdout.write(
    'Memo naming E2E passed: lexical binding, named inner, and explicit wrapper names.\n',
  )
  const readRows = async () =>
    parseSuccessfulJson(
      'genie-react call react_get_renders',
      await runCli([
        'call',
        'react_get_renders',
        JSON.stringify({ component: 'OwnershipRow', appOnly: true, limit: 1 }),
        '--json',
        '--wait',
        '5000',
      ]),
    )
  for (const stage of ['cold mount', 'document reload']) {
    if (stage === 'document reload') {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.locator('#lab').waitFor({ state: 'visible', timeout: 10_000 })
      await waitFor(
        'reconnected CLI session',
        async () => {
          const result = parseSuccessfulJson('status', await runCli(['status', '--json']))
          return result.connected && result.ready
        },
        15_000,
      )
    }
    parseSuccessfulJson(
      'clear render observation',
      await runCli([
        'call',
        'react_clear_renders',
        JSON.stringify({
          budget: { fiberLimit: 2000, operationLimit: 2000000, timeLimitMs: 500, adaptive: false },
        }),
        '--json',
      ]),
    )
    await page.getByRole('button', { name: 'Mount rows' }).click()
    const cold = await readRows()
    const classification = cold.sourceClassification
    assert(classification?.totalCandidates === 241, `${stage}: missing ownership candidate counts`)
    assert(
      classification.app + classification.library + classification.unknown === 241,
      `${stage}: ownership counts do not account for all rows`,
    )
    if (!classification.complete) {
      assert(
        cold.comparable === false &&
          cold.notComparableReasons.includes('app-source-classification-incomplete'),
        `${stage}: incomplete app sample was comparable`,
      )
    }
    const warm = await waitFor(
      `${stage} source warmup`,
      async () => {
        const report = await readRows()
        return report.sourceClassification?.complete ? report : undefined
      },
      15_000,
    )
    assert(warm.sourceClassification.app === 241, `${stage}: app sources did not recover`)
    assert(
      warm.sourceClassification.unknown === 0 && warm.summary.trackedComponents === 241,
      `${stage}: warm report lost rows`,
    )
    assert(
      warm.components.length === 1 && warm.omittedByLimit === 240,
      `${stage}: output limit was confused with ownership coverage`,
    )
    process.stdout.write(
      `${stage}: ${classification.app}/241 app rows on first read, 241/241 after warmup.\n`,
    )
    const readPage = async (args) =>
      parseSuccessfulJson(
        'render page',
        await runCli(['call', 'react_get_renders', JSON.stringify(args), '--json']),
      )
    const selection = {
      nameFilter: 'OwnershipR?w',
      excludeNames: ['*Internal*'],
      minUpdates: 1,
      appOnly: true,
      limit: 200,
    }
    const mountsOnly = await readPage(selection)
    assert(mountsOnly.components.length === 0, `${stage}: minUpdates retained mount-only rows`)
    await page.getByRole('button', { name: 'Update rows' }).click()
    await page.waitForFunction(() => document.querySelector('#row-240')?.textContent === '240:1')
    const first = await readPage(selection)
    assert(
      first.sourceClassification.complete && first.pagination.totalComponents === 241,
      `${stage}: updated app rows were not fully classified`,
    )
    assert(
      first.components.length === 200 && first.omittedByLimit === 41 && first.nextCursor,
      `${stage}: first page did not retain a recoverable remainder`,
    )
    await page.getByRole('button', { name: 'Update rows' }).click()
    await page.waitForFunction(() => document.querySelector('#row-240')?.textContent === '240:2')
    const quiet = parseSuccessfulJson(
      'quiet wait between render pages',
      await runCli([
        'call',
        'devtools_wait',
        JSON.stringify({
          condition: 'react-quiet',
          quietMs: 400,
          timeoutMs: 5_000,
        }),
        '--json',
      ]),
    )
    assert(quiet.ok, `${stage}: render quiet wait failed between pages`)
    const second = await readPage({ cursor: first.nextCursor, limit: 200 })
    assert(
      second.components.length === 41 && second.nextCursor === null && second.omittedByLimit === 0,
      `${stage}: continuation did not exhaust the selected snapshot`,
    )
    const rows = [...first.components, ...second.components]
    assert(
      new Set(rows.map((row) => row.id)).size === 241,
      `${stage}: cursor introduced duplicated or missing rows`,
    )
    assert(
      rows.every((row) => row.updates === 1),
      `${stage}: a later commit changed frozen row counts`,
    )
    assert(
      second.documentCommitId === first.documentCommitId &&
        second.summary.totalUpdates === first.summary.totalUpdates,
      `${stage}: continuation changed measurement metadata`,
    )
    const human = await runCli([
      'call',
      'react_get_renders',
      JSON.stringify({ ...selection, limit: 1 }),
    ])
    assert(
      human.code === 0 && human.stdout.includes('next: genie-react call react_get_renders'),
      `${stage}: human CLI omitted continuation guidance`,
    )
    const invalid = await runCli([
      'call',
      'react_get_renders',
      JSON.stringify({ cursor: first.nextCursor, nameFilter: 'Row' }),
      '--json',
    ])
    assert(invalid.code !== 0, `${stage}: cursor accepted conflicting selectors`)
    const failure = JSON.parse(invalid.stdout)
    assert(
      failure.reason === 'invalid-args' && !invalid.stdout.includes('next:'),
      `${stage}: invalid page request did not preserve clean machine errors`,
    )
    process.stdout.write(
      `${stage}: paged 241 updated app rows as 200 + 41 across another live commit.\n`,
    )
  }
  await page.waitForFunction(() => document.querySelector('#greeting')?.textContent === 'hello')
  const callTool = async (name, args = {}) =>
    parseSuccessfulJson(name, await runCli(['call', name, JSON.stringify(args), '--json']))
  await callTool('react_clear_renders', {
    budget: { fiberLimit: 2000, operationLimit: 2000000, timeLimitMs: 500, adaptive: false },
  })
  const freezeCohort = (component = 'FreezeProbe') =>
    callTool('react_component_cohort', { component, exact: true })
  const activeFreeze = await freezeCohort()
  assert(
    activeFreeze.instances[0]?.renderingState === 'mounted-rendering',
    'Active freeze probe was not eligible to render',
  )
  const retainedMountId = activeFreeze.instances[0].instance.mountId
  await page.locator('#freeze-probe').click()
  await page.locator('#freeze-frozen').click()
  await page.locator('#freeze-fallback').waitFor({ state: 'visible' })
  const frozenCohort = await freezeCohort()
  assert(
    frozenCohort.instances[0]?.renderingState === 'mounted-frozen',
    `Actual react-freeze primary was not reported frozen: ${JSON.stringify(frozenCohort)}`,
  )
  assert(
    frozenCohort.instances[0].instance.mountId === retainedMountId,
    'Freezing changed mount identity',
  )
  assert(
    (await freezeCohort('FreezeFallback')).instances[0]?.renderingState === 'mounted-rendering',
    'Freeze fallback was wrongly frozen',
  )
  await page.locator('#freeze-active').click()
  await page.locator('#freeze-probe').waitFor({ state: 'visible' })
  assert(
    (await page.locator('#freeze-probe').textContent()) === 'Retained:1',
    'Thaw lost component state',
  )
  assert(
    (await freezeCohort()).instances[0]?.renderingState === 'mounted-rendering',
    'Thaw retained stale freeze state',
  )
  await page.locator('#freeze-hidden').click()
  await page.locator('#freeze-probe').waitFor({ state: 'hidden' })
  assert(
    (await freezeCohort()).instances[0]?.renderingState === 'mounted-hidden',
    'Activity was conflated with react-freeze',
  )
  await page.locator('#freeze-unmounted').click()
  const removedFreeze = await waitFor(
    'freeze probe unmount',
    async () => {
      const report = await freezeCohort()
      return (
        report.instances.some(
          (row) => row.renderingState === 'unmounted' && row.instance.mountId === retainedMountId,
        ) && report
      )
    },
    10000,
  )
  assert(removedFreeze.unmounted === 1, 'Actual unmount did not preserve a tombstone')
  process.stdout.write(
    'Freeze E2E passed: active → frozen → thawed (state retained) → Activity hidden → unmounted; fallback remained rendering.\n',
  )
  await callTool('react_clear_renders', { components: ['PolicyConsumer'] })
  const notificationsBefore = await callTool('query_notifications')
  await page.locator('#metadata-update').click()
  await page.waitForFunction(() => document.querySelector('#policy-result')?.textContent === '1:1')
  const excluded = await callTool('react_render_causes', {
    component: 'PolicyConsumer',
    appOnly: false,
  })
  assert(
    excluded.events.length > 0,
    'Policy regression must capture the parent-driven consumer render',
  )
  assert(
    excluded.events.every((event) => event.causes.every((cause) => cause.kind !== 'query')),
    `Unsubscribed timestamp update was incorrectly blamed on Query: ${JSON.stringify(excluded.events)}`,
  )
  const notificationsAfter = await callTool('query_notifications')
  assert(
    notificationsAfter.events.length === notificationsBefore.events.length,
    'Timestamp-only update unexpectedly delivered a Query notification',
  )

  await callTool('react_clear_renders', { components: ['PolicyConsumer'] })
  await page.locator('#data-update').click()
  await page.waitForFunction(() => document.querySelector('#policy-result')?.textContent === '2:1')
  const delivered = await callTool('react_render_causes', {
    component: 'PolicyConsumer',
    appOnly: false,
  })
  assert(
    delivered.events.some((event) =>
      event.causes.some(
        (cause) =>
          cause.kind === 'query' &&
          cause.evidence === 'exact' &&
          cause.notification?.changedResultFields.includes('data'),
      ),
    ),
    `Subscribed data update lost its exact Query cause: ${JSON.stringify(delivered.events)}`,
  )
  const canvasRuns = []
  for (let run = 0; run < 10; run++) {
    await callTool('react_clear_renders', { components: ['QuiesceCanvas'] })
    await page.locator('#quiesce-interact').click()
    const settled = await callTool('react_quiesce', { idleMs: 250, timeoutMs: 5000 })
    assert(
      settled.outcome === 'idle',
      `Canvas interaction failed to quiesce: ${JSON.stringify(settled)}`,
    )
    const renders = await callTool('react_get_renders', {
      component: 'QuiesceCanvas',
      appOnly: false,
    })
    assert(
      renders.components.length === 1 && renders.components[0].updates === 4,
      `Canvas run ${run + 1} lost deferred updates: ${JSON.stringify(renders)}`,
    )
    canvasRuns.push(renders.components[0].updates)
  }
  process.stdout.write(
    `React quiesce live canvas: ${canvasRuns.join(', ')} updates across ten consecutive clear→interact→quiesce→report runs.\n`,
  )
  await callTool('react_clear_renders', { components: ['App'] })
  const spanA = await callTool('react_measure', { label: 'outer route' })
  await page.getByRole('button', { name: 'Update memo rows', exact: true }).click()
  const spanB = await callTool('react_measure', { label: 'inner route' })
  await page.getByRole('button', { name: 'Update memo rows', exact: true }).click()
  const inner = await callTool('react_renders_since', {
    handle: spanB.handle,
    close: true,
    component: 'App',
    appOnly: false,
  })
  await callTool('react_clear_renders')
  await page.getByRole('button', { name: 'Update memo rows', exact: true }).click()
  const outer = await callTool('react_renders_since', {
    handle: spanA.handle,
    close: true,
    component: 'App',
    appOnly: false,
  })
  assert(
    inner.label === 'inner route' && outer.label === 'outer route',
    'Span labels must cross the CLI unchanged',
  )
  assert(
    inner.summary.totalUpdates === 1 && outer.summary.totalUpdates === 2,
    `Span counts mixed: ${JSON.stringify({ inner, outer })}`,
  )
  assert(
    outer.excludedCommits > 0 && !outer.commitIds.some((id) => inner.commitIds.includes(id)),
    'Concurrent span commit sets must be disjoint',
  )
  process.stdout.write(
    'Live labelled spans passed: outer=2 updates, inner=1, disjoint commits across global clear.\n',
  )
  assert(pageErrors.length === 0, `Browser page errors:\n${pageErrors.join('\n')}`)

  process.stdout.write(
    `Packed Vite E2E passed on port ${port}: CLI status ready, ${tree.nodes.length} React nodes, and ${queryList.queries.length} Query record(s); unsubscribed metadata cause excluded and subscribed data delivery retained.\n`,
  )
}

process.once('SIGINT', onSigint)
process.once('SIGTERM', onSigterm)

try {
  await main()
} finally {
  await cleanup()
  process.removeListener('SIGINT', onSigint)
  process.removeListener('SIGTERM', onSigterm)
}
