#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const appRoot = join(root, 'apps/vite-demo')
const require = createRequire(join(appRoot, 'package.json'))
const { createServer } = await import(require.resolve('vite'))
const { genie } = await import(new URL('../packages/genie-react/dist/vite.js', import.meta.url))
const { readAgentToken } = await import(
  new URL('../packages/genie-react/dist/hub.js', import.meta.url)
)
const reactVersion = require('react/package.json').version
const run = promisify(execFile)
const fixture = await mkdtemp(join(appRoot, '.genie-suspense-'))
const SESSION = 'suspense-e2e'
const HOLD_MS = 400

const gates = new Map()
function gate(key) {
  let entry = gates.get(key)
  if (!entry) {
    entry = { released: false, waiting: [] }
    gates.set(key, entry)
  }
  return entry
}
function release(key) {
  const entry = gate(key)
  entry.released = true
  for (const respond of entry.waiting.splice(0)) respond()
}

let server
let browser

try {
  await writeFile(
    join(fixture, 'index.html'),
    '<div id="root"></div><script type="module" src="/main.js"></script>',
  )
  await writeFile(join(fixture, 'styles.css'), '#styled { color: rgb(1, 2, 3); }\n')
  await writeFile(
    join(fixture, 'chart.js'),
    `import { createElement as h } from 'react'
export default function ChartBody() {
  return h('figure', { id: 'chart' }, 'chart ready')
}
`,
  )
  await writeFile(
    join(fixture, 'main.js'),
    `import { createElement as h, lazy, startTransition, Suspense, use, useState } from 'react'
import { createRoot } from 'react-dom/client'

const hold = (key) => fetch('/api/hold?key=' + key).then((response) => response.text())
const profile = hold('profile')
const Chart = lazy(() => hold('chart').then(() => import('./chart.js')))
let search = null

function ProfileCard() {
  return h('output', { id: 'profile' }, use(profile))
}
function Results({ request }) {
  return h('p', { id: 'results' }, use(request))
}
function Search() {
  const [request, setRequest] = useState(null)
  const start = () => {
    search ??= Object.assign(hold('search'), { displayName: 'searchResults' })
    startTransition(() => setRequest(search))
  }
  return h('section', null,
    h('button', { id: 'search', onClick: start }, 'Search'),
    h(Suspense, { name: 'Results', fallback: h('p', { id: 'results-fallback' }, 'searching') },
      request ? h(Results, { request }) : h('p', { id: 'results' }, 'no search yet')))
}
function ProfileSection() {
  return h(Suspense, { name: 'Profile', fallback: h('p', { id: 'profile-fallback' }, 'loading profile') }, h(ProfileCard))
}
function ChartSection() {
  return h(Suspense, { name: 'Chart', fallback: h('p', { id: 'chart-fallback' }, 'loading chart') }, h(Chart))
}
function StyledSection() {
  return h(Suspense, { name: 'Styled', fallback: 'styling' },
    h('link', { rel: 'stylesheet', href: '/styles.css', precedence: 'default' }),
    h('p', { id: 'styled' }, 'styled'))
}
function App() {
  return h('main', null,
    h(ProfileSection),
    h(ChartSection),
    h(Search),
    h(StyledSection),
    h(Suspense, { name: 'Static', fallback: null }, h('p', null, 'static')))
}
createRoot(document.getElementById('root')).render(h(App))
`,
  )
  server = await createServer({
    configFile: false,
    root: fixture,
    logLevel: 'error',
    plugins: [
      genie(),
      {
        name: 'suspense-fixture-api',
        configureServer(vite) {
          vite.middlewares.use('/api/hold', (request, response) => {
            const key = new URL(request.url ?? '', 'http://fixture').searchParams.get('key') ?? ''
            const respond = () => {
              response.setHeader('Content-Type', 'text/plain')
              response.end(`${key} ready`)
            }
            const entry = gate(key)
            if (entry.released) respond()
            else entry.waiting.push(respond)
          })
        },
      },
    ],
    server: { host: '127.0.0.1', port: 0 },
  })
  await server.listen()
  const address = server.httpServer.address()
  assert.ok(address && typeof address !== 'string')
  const url = `http://127.0.0.1:${address.port}`
  const env = {
    ...process.env,
    GENIE_BRIDGE_URL: `ws://127.0.0.1:${address.port}/__genie/ws`,
    GENIE_SESSION: SESSION,
  }
  const cli = async (args) => {
    const result = await run(process.execPath, [join(root, 'packages/cli/dist/cli.js'), ...args], {
      cwd: fixture,
      env,
      timeout: 20_000,
      maxBuffer: 2_000_000,
    })
    return JSON.parse(result.stdout)
  }
  const suspense = (args = {}) => cli(['call', 'react_suspense', JSON.stringify(args), '--json'])
  const boundary = (report, name) => {
    const found = report.boundaries.find((candidate) => candidate.name === name)
    assert.ok(found, `boundary ${name} missing from ${JSON.stringify(report.boundaries)}`)
    return found
  }

  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${url}/?_genie=${SESSION}`)
  await page.locator('#profile-fallback').waitFor()
  assert.equal(
    (await cli(['call', 'devtools_wait', '{"condition":"ready","timeoutMs":10000}', '--json'])).ok,
    true,
  )
  env.GENIE_BRIDGE_TOKEN = await readAgentToken(fixture)

  const contract = await cli(['tools', 'react_suspense', '--json'])
  assert.equal(contract.name, 'react_suspense')
  assert.equal(contract.annotations?.readOnlyHint, true)

  await new Promise((resolve) => setTimeout(resolve, HOLD_MS))
  const waiting = await suspense({ waitingOnly: true })
  assert.equal(waiting.view, 'summary', 'summary must be the default view')
  assert.equal(waiting.capability.asyncDebugInfo, 'available', JSON.stringify(waiting.capability))
  assert.equal(waiting.capability.reactVersion, reactVersion)
  assert.deepEqual(
    waiting.boundaries.map((entry) => entry.name).sort(),
    ['Chart', 'Profile'],
    'only the two waiting boundaries are returned with waitingOnly',
  )
  const profileWaiting = boundary(waiting, 'Profile')
  assert.equal(profileWaiting.state, 'fallback')
  assert.equal(profileWaiting.blockerStatus, 'pending-observed')
  assert.deepEqual(
    profileWaiting.blockers.map((blocker) => [blocker.kind, blocker.kindEvidence, blocker.status]),
    [['use', 'exact', 'pending']],
  )
  assert.ok(profileWaiting.blockers[0].pendingForMs >= HOLD_MS / 2, 'pending time must be measured')
  assert.ok(!('awaitStack' in profileWaiting.blockers[0]), 'summary blockers omit stacks')
  const chartWaiting = boundary(waiting, 'Chart')
  assert.deepEqual(
    chartWaiting.blockers.map((blocker) => [blocker.kind, blocker.phase, blocker.status]),
    [['lazy', 'pending', 'pending']],
  )
  assert.match(waiting.waitingHint ?? '', /shows its fallback, waiting on/)
  const errorState = await cli(['call', 'react_error_state', '{}', '--json'])
  assert.deepEqual(
    errorState.suspended.map((entry) => entry.boundaryId).sort(),
    waiting.boundaries.map((entry) => entry.id).sort(),
    'boundary IDs must match react_error_state boundaryId',
  )

  release('profile')
  await page.locator('#profile').waitFor()
  const afterProfile = await suspense({ view: 'full' })
  const profileContent = boundary(afterProfile, 'Profile')
  assert.equal(profileContent.state, 'content')
  const awaited = profileContent.blockers[0]
  assert.equal(awaited.phase, 'awaited-by-content')
  assert.equal(awaited.status, 'fulfilled')
  assert.equal(awaited.description, 'profile ready')
  assert.equal(awaited.awaitedBy?.name, 'ProfileCard')
  assert.ok(
    awaited.durationMs >= HOLD_MS,
    `profile waited at least the hold, got ${awaited.durationMs}`,
  )
  const tree = await cli([
    'call',
    'react_get_tree',
    JSON.stringify({ depth: 40, maxNodes: 400, appOnly: false }),
    '--json',
  ])
  assert.ok(
    tree.nodes.some((node) => node.id === awaited.awaitedBy.id && node.name === 'ProfileCard'),
    'awaitedBy.id must be the react_get_tree ID',
  )
  assert.equal(boundary(afterProfile, 'Chart').state, 'fallback')

  release('chart')
  await page.locator('#chart').waitFor()
  const afterChart = await suspense({ view: 'full' })
  const chart = boundary(afterChart, 'Chart').blockers[0]
  assert.equal(chart.kind, 'lazy')
  assert.equal(chart.recordedBy, 'lazy-type')
  assert.equal(chart.description, 'ChartBody')
  assert.match(chart.location ?? '', /main\.js:\d+$/, `lazy() call site, got ${chart.location}`)
  assert.ok(
    chart.ioStack.length > 0 &&
      chart.ioStack.every(
        (frame) => !/node_modules\/(?:\.pnpm\/)?react(?:-dom)?[@/]/.test(frame.file ?? ''),
      ),
    `React's own frames must be dropped from the lazy() stack: ${JSON.stringify(chart.ioStack)}`,
  )

  const styled = boundary(afterChart, 'Styled')
  assert.equal(styled.state, 'content')
  const stylesheet = styled.blockers.find((blocker) => blocker.kind === 'asset')
  assert.ok(stylesheet, `stylesheet asset missing from ${JSON.stringify(styled)}`)
  assert.equal(stylesheet.status, 'fulfilled')
  assert.match(stylesheet.description ?? '', /\/styles\.css$/)
  assert.deepEqual(
    [boundary(afterChart, 'Static').blockerStatus, boundary(afterChart, 'Static').blockers],
    ['none', []],
  )

  await page.locator('#search').click()
  await new Promise((resolve) => setTimeout(resolve, HOLD_MS))
  assert.equal(await page.locator('#results').textContent(), 'no search yet')
  const transition = await suspense({ waitingOnly: true })
  const results = boundary(transition, 'Results')
  assert.equal(results.state, 'transition-pending')
  assert.equal(results.stateEvidence, 'inferred')
  assert.deepEqual(
    results.blockers.map((blocker) => [blocker.kind, blocker.name, blocker.status]),
    [['use', 'searchResults', 'pending']],
  )
  release('search')
  await page.waitForFunction(
    () => document.querySelector('#results')?.textContent === 'search ready',
  )
  const settled = await suspense({ waitingOnly: true })
  assert.deepEqual(settled.boundaries, [], 'nothing waits once every hold is released')
  assert.equal(settled.waitingHint, null)

  assert.deepEqual(errors, [], 'the fixture must remain functional')
  console.log(
    JSON.stringify(
      { status: 'passed', react: reactVersion, waiting, afterProfile, afterChart, transition },
      null,
      2,
    ),
  )
} finally {
  for (const key of gates.keys()) release(key)
  await browser?.close()
  await server?.close()
  await rm(fixture, { recursive: true, force: true })
}
