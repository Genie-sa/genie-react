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
const require = createRequire(join(root, 'apps/router-demo/package.json'))
const { createServer } = await import(require.resolve('vite'))
const { genie } = await import(new URL('../packages/genie-react/dist/vite.js', import.meta.url))
const { readAgentToken } = await import(
  new URL('../packages/genie-react/dist/hub.js', import.meta.url)
)
const run = promisify(execFile)
const fixture = await mkdtemp(join(root, 'apps/router-demo/.genie-render-accuracy-'))
let server
let browser

// Each fixture component counts its committed renders with a dependency-free layout effect, an oracle independent of Genie.
const APP = `
import { Component, createElement as h, memo, startTransition, useDeferredValue, useLayoutEffect, useState, useTransition } from 'react'
import { createRoot } from 'react-dom/client'

window.__commits = {}
window.__bodies = {}
function useOracle(name) {
  window.__bodies[name] = (window.__bodies[name] ?? 0) + 1
  useLayoutEffect(() => { window.__commits[name] = (window.__commits[name] ?? 0) + 1 })
}
function burn(ms) { const until = performance.now() + ms; while (performance.now() < until) {} }

const Results = memo(function Results({ query }) {
  const deferred = useDeferredValue(query)
  useOracle('Results')
  return h('output', { id: 'results' }, 'results:' + deferred)
})

function SlowItem({ filter, index }) { burn(1); return h('li', null, filter + index) }
function SlowList({ filter }) {
  useOracle('SlowList')
  return h('ul', null, Array.from({ length: 150 }, (_, index) => h(SlowItem, { key: index, filter, index })))
}

function Modal() {
  const [count, setCount] = useState(0)
  useOracle('Modal')
  return h('dialog', { open: true }, h('button', { id: 'bump', onClick: () => setCount(count + 1) }, 'bump ' + count))
}

class Ticker extends Component {
  render() { return h('button', { id: 'force', onClick: () => this.forceUpdate() }, 'force') }
}

function Tabs() {
  const [isPending, startTabTransition] = useTransition()
  const [tab, setTab] = useState(0)
  useOracle('Tabs')
  return h('button', { id: 'tab', onClick: () => startTabTransition(() => setTab(tab + 1)) }, 'tab ' + tab + (isPending ? '…' : ''))
}

function App() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState(false)
  return h('main', null,
    h('input', { id: 'search', value: query, onChange: (event) => {
      setQuery(event.target.value)
      startTransition(() => setFilter(event.target.value))
    } }),
    h(Results, { query }),
    h(SlowList, { filter }),
    h('button', { id: 'open', onClick: () => setOpen(true) }, 'open'),
    h('button', { id: 'close', onClick: () => setOpen(false) }, 'close'),
    open && h(Modal),
    h(Ticker),
    h(Tabs),
  )
}
createRoot(document.getElementById('root')).render(h(App))
`

try {
  await writeFile(
    join(fixture, 'index.html'),
    '<div id="root"></div><script type="module" src="/main.js"></script>',
  )
  await writeFile(join(fixture, 'main.js'), APP)
  server = await createServer({
    configFile: false,
    root: fixture,
    logLevel: 'error',
    plugins: [genie()],
    server: { host: '127.0.0.1', port: 0 },
  })
  await server.listen()
  const address = server.httpServer.address()
  assert.ok(address && typeof address !== 'string')
  const env = {
    ...process.env,
    GENIE_BRIDGE_URL: `ws://127.0.0.1:${address.port}/__genie/ws`,
    GENIE_SESSION: 'render-accuracy-e2e',
  }
  const call = async (name, args) => {
    const result = await run(
      process.execPath,
      [join(root, 'packages/cli/dist/cli.js'), 'call', name, JSON.stringify(args), '--json'],
      { cwd: fixture, env, timeout: 20000, maxBuffer: 4_000_000 },
    )
    return JSON.parse(result.stdout)
  }
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`http://127.0.0.1:${address.port}/?_genie=render-accuracy-e2e`)
  await page.locator('#search').waitFor()
  assert.equal((await call('devtools_wait', { condition: 'ready', timeoutMs: 10000 })).ok, true)
  env.GENIE_BRIDGE_TOKEN = await readAgentToken(fixture)

  const observe = async () => {
    await call('react_clear_renders', { budget: { timeLimitMs: 500, adaptive: true } })
    await page.evaluate(() => {
      window.__commits = {}
      window.__bodies = {}
    })
  }
  const settle = () => call('react_quiesce', { idleMs: 300, timeoutMs: 10000 })
  const oracle = () => page.evaluate(() => ({ commits: window.__commits, bodies: window.__bodies }))
  const renders = async (component) => {
    const report = await call('react_get_renders', { component, appOnly: false, view: 'full' })
    assert.equal(report.coverage.complete, true, `${component} coverage must be complete`)
    return report.components.filter((entry) => entry.name === component)
  }
  const results = {}

  await observe()
  await page.locator('#search').pressSequentially('abcde', { delay: 20 })
  await page.waitForFunction(
    () => document.querySelector('#results')?.textContent === 'results:abcde',
  )
  await settle()
  const typed = await oracle()
  const [resultsReport] = await renders('Results')
  const [listReport] = await renders('SlowList')
  assert.equal(resultsReport.renders, typed.commits.Results, 'Results renders must equal commits')
  assert.equal(resultsReport.noObservedInputChange, 0, 'deferred passes are not avoidable')
  const resultEvents = (await call('react_render_causes', { component: 'Results', limit: 50 }))
    .events
  assert.ok(
    resultEvents.some((event) =>
      event.causes.some((cause) => cause.kind === 'state' && cause.name === 'useDeferredValue'),
    ),
    'a deferred pass must name its useDeferredValue',
  )
  assert.equal(listReport.renders, typed.commits.SlowList, 'SlowList renders must equal commits')
  assert.ok(
    typed.bodies.SlowList > typed.commits.SlowList,
    `interrupted transition renders must be discarded: ${JSON.stringify(typed)}`,
  )
  results.typing = { oracle: typed, results: resultsReport.renders, slowList: listReport.renders }

  await observe()
  await page.locator('#open').click()
  await page.locator('#bump').click()
  await page.locator('#bump').click()
  await page.locator('#close').click()
  await settle()
  const modalOracle = await oracle()
  const modalSummary = await call('react_get_renders', { component: 'Modal' })
  assert.deepEqual(
    modalSummary.components.map(({ renders: count, unmounted }) => ({ count, unmounted })),
    [{ count: modalOracle.commits.Modal, unmounted: true }],
    'an unmounted Modal must keep its renders',
  )
  results.modal = { oracle: modalOracle.commits.Modal, genie: modalSummary.components[0] }

  await observe()
  await page.locator('#force').click()
  await settle()
  const [ticker] = await renders('Ticker')
  assert.equal(ticker.necessity, 'unknown', 'forceUpdate must not be graded')
  assert.equal(ticker.noObservedInputChange, 0)

  await observe()
  await page.locator('#tab').click()
  await page.waitForFunction(() => document.querySelector('#tab')?.textContent === 'tab 1')
  await settle()
  const tabsOracle = await oracle()
  const tabEvents = (await call('react_render_causes', { component: 'Tabs', limit: 10 })).events
  assert.equal(tabEvents.length, tabsOracle.commits.Tabs, 'Tabs events must equal commits')
  assert.ok(
    tabEvents.every((event) => event.causes.every((cause) => cause.kind === 'state')),
    `every Tabs render must have an exact state cause: ${JSON.stringify(tabEvents)}`,
  )
  results.tabs = { oracle: tabsOracle.commits.Tabs, events: tabEvents.length }

  assert.deepEqual(errors, [], 'the fixture must remain functional')
  console.log(JSON.stringify({ status: 'passed', results }, null, 2))
} finally {
  await browser?.close()
  await server?.close()
  await rm(fixture, { recursive: true, force: true })
}
