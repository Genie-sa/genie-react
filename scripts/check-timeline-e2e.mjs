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
const { createStandaloneBridge, readAgentToken } = await import(
  new URL('../packages/genie-react/dist/hub.js', import.meta.url)
)
const run = promisify(execFile)
const fixture = await mkdtemp(join(root, 'apps/router-demo/.genie-timeline-'))
let server
let browser
let hub
let scriptHubPort

try {
  await writeFile(
    join(fixture, 'index.html'),
    '<div id="root"></div><script type="module" src="/main.js"></script>',
  )
  await writeFile(
    join(fixture, 'main.js'),
    `
import { createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { createRouter, createRootRoute, createRoute, RouterProvider, Outlet, useSearch } from '@tanstack/react-router'
import { Genie } from 'genie-react'
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })
function Layout() {
  return h('main', null,
    h('button', { onClick: () => router.navigate({ to: '/result', search: { mode: 'network' } }) }, 'Slow network'),
    h('button', { onClick: () => router.navigate({ to: '/result', search: { mode: 'render' } }) }, 'Slow render'),
    h(Outlet), h(Genie, { router, queryClient }))
}
function Result() {
  const { mode } = useSearch({ strict: false })
  const query = useQuery({ queryKey: ['timeline-fixture', mode], queryFn: async () => {
    const response = await fetch('/api/data?mode=' + mode)
    return response.json()
  } })
  if (query.data && mode === 'render') {
    const until = performance.now() + 100
    while (performance.now() < until) {}
  }
  return h('output', { id: 'result' }, query.data ? mode + ':ready' : 'loading')
}
const rootRoute = createRootRoute({ component: Layout })
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => h('p', null, 'Ready') })
const resultRoute = createRoute({ getParentRoute: () => rootRoute, path: '/result', component: Result })
const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute, resultRoute]) })
createRoot(document.getElementById('root')).render(h(QueryClientProvider, { client: queryClient }, h(RouterProvider, { router })))
`,
  )
  await writeFile(
    join(fixture, 'script-main.js'),
    `
import { createElement as h, useState } from 'react'
import { createRoot } from 'react-dom/client'
function App() {
  const [done, setDone] = useState(false)
  return h('button', { onClick: async () => { await fetch('/api/data'); setDone(true) } }, done ? 'Script ready' : 'Script action')
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
        name: 'timeline-fixture-api',
        configureServer(vite) {
          vite.middlewares.use('/script-only', (_request, response) => {
            response.setHeader('Content-Type', 'text/html')
            response.end(
              `<div id="root"></div><script src="http://127.0.0.1:${scriptHubPort}/__genie/client.js"></script><script type="module" src="/script-main.js"></script>`,
            )
          })
          vite.middlewares.use('/api/outcome', (request, response) => {
            const kind = new URL(request.url ?? '', 'http://fixture').searchParams.get('kind')
            if (kind === 'reset') {
              setTimeout(() => request.socket.destroy(), 20)
              return
            }
            const timer = setTimeout(() => response.end('ok'), kind === 'abort' ? 5000 : 60)
            response.on('close', () => clearTimeout(timer))
          })
          vite.middlewares.use('/api/race', (request, response) => {
            const params = new URL(request.url ?? '', 'http://fixture').searchParams
            const timer = setTimeout(
              () => {
                response.setHeader('Content-Type', 'application/json')
                response.end(JSON.stringify({ range: params.get('range') }))
              },
              Number(params.get('ms') ?? 0),
            )
            response.on('close', () => clearTimeout(timer))
          })
          vite.middlewares.use('/api/headers-then-stall', (_request, response) => {
            response.writeHead(200, { 'Content-Type': 'text/plain' })
            response.write('partial')
          })
          vite.middlewares.use('/api/hang', () => {})
          vite.middlewares.use('/api/data', (request, response) => {
            const slow = request.url?.includes('mode=network')
            const timer = setTimeout(
              () => {
                response.setHeader('Content-Type', 'application/json')
                response.end('{"ok":true}')
              },
              slow ? 250 : 5,
            )
            response.on('close', () => clearTimeout(timer))
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
    GENIE_SESSION: 'timeline-e2e',
  }
  const cli = async (args) => {
    const result = await run(
      process.execPath,
      [join(root, 'packages/cli/dist/cli.js'), ...args, '--json'],
      {
        cwd: fixture,
        env,
        timeout: 20000,
        maxBuffer: 2_000_000,
      },
    )
    return JSON.parse(result.stdout)
  }
  const call = (name, args) => cli(['call', name, JSON.stringify(args), '--json'])
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${url}/?_genie=timeline-e2e`)
  await page.getByRole('button', { name: 'Slow network' }).waitFor()
  assert.equal((await call('devtools_wait', { condition: 'ready', timeoutMs: 10000 })).ok, true)
  env.GENIE_BRIDGE_TOKEN = await readAgentToken(fixture)
  const docsCheck = await run(
    process.execPath,
    [join(root, 'apps/docs/scripts/check-live-contracts.mjs')],
    { cwd: root, env, timeout: 120000, maxBuffer: 2_000_000 },
  )
  const reports = {}
  for (const mode of ['network', 'render']) {
    const started = await call('timeline_start', { name: `slow-${mode}` })
    await page.getByRole('button', { name: `Slow ${mode}` }).click()
    await page.waitForFunction(
      (expected) => document.querySelector('#result')?.textContent === expected,
      `${mode}:ready`,
    )
    await call('timeline_stop', { id: started.id })
    reports[mode] = await call('timeline_read', { id: started.id, limit: 1000 })
    const frozen = await call('timeline_read', { id: started.id, limit: 1000 })
    assert.deepEqual(frozen, reports[mode], 'stopped evidence must stay frozen')
    assert.equal(frozen.correlation, 'temporal-only')
    for (const domain of ['request', 'query', 'react', 'navigation']) {
      assert.equal(frozen.coverage[domain].status, 'available', `${domain} must be wired`)
      assert.ok(
        frozen.events.some((event) => event.domain === domain),
        `${domain} must have real events`,
      )
    }
    assert.ok(
      frozen.events.some((event) => event.domain === 'query' && event.details.action === 'success'),
      'Query must settle successfully',
    )
    assert.ok(
      frozen.events.some((event) => event.domain === 'navigation' && event.type === 'onResolved'),
      'navigation must resolve',
    )
    assert.ok(
      frozen.events.every(
        (event, index, events) => index === 0 || event.atMs >= events[index - 1].atMs,
      ),
      'all lanes must share ordered observation time',
    )
  }
  const longestRequest = (report) =>
    Math.max(
      ...report.events
        .filter((event) => event.domain === 'request' && event.details.url.endsWith('/api/data'))
        .map((event) => event.details.durationMs),
    )
  const longestRender = (report) =>
    Math.max(
      ...report.events
        .filter((event) => event.domain === 'react')
        .map((event) => event.details.renderDurationMs ?? 0),
    )
  assert.ok(longestRequest(reports.network) >= 200, 'the delayed API request must be visible')
  assert.ok(longestRender(reports.render) >= 80, 'the expensive React render must be visible')
  assert.ok(
    longestRequest(reports.network) > longestRequest(reports.render),
    'the request lane must distinguish the network-heavy flow',
  )
  assert.ok(
    longestRender(reports.render) > longestRender(reports.network),
    'the React lane must distinguish the render-heavy flow',
  )
  const network = new Map()
  page.on('requestfinished', (request) => network.set(request.url(), { failed: false, request }))
  page.on('requestfailed', (request) => network.set(request.url(), { failed: true, request }))
  const outcomes = await call('timeline_start', { name: 'request-outcomes' })
  await page.evaluate(async () => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 40)
    const xhr = new Promise((resolve) => {
      const request = new XMLHttpRequest()
      request.open('GET', '/api/outcome?kind=xhr')
      request.onloadend = resolve
      request.send()
    })
    await Promise.allSettled([
      fetch('/api/outcome?kind=ok').then((response) => response.text()),
      fetch('/api/outcome?kind=abort', { signal: controller.signal }),
      fetch('/api/outcome?kind=reset'),
      xhr,
    ])
  })
  await call('timeline_stop', { id: outcomes.id })
  const outcomeRequests = (await call('timeline_read', { id: outcomes.id, domains: ['request'] }))
    .events
  for (const kind of ['ok', 'abort', 'reset', 'xhr']) {
    const observed = [...network.entries()].find(([requestUrl]) =>
      requestUrl.endsWith(`/api/outcome?kind=${kind}`),
    )?.[1]
    assert.ok(observed, `Playwright must observe the ${kind} request`)
    const recorded = outcomeRequests.filter((event) => event.details.url.endsWith('/api/outcome'))
    const event = recorded.find((candidate) =>
      kind === 'xhr'
        ? candidate.details.initiatorType === 'xmlhttprequest'
        : candidate.details.initiatorType === 'fetch' &&
          candidate.details.responseReceived === !observed.failed &&
          (observed.failed || candidate.details.responseStatus === 200),
    )
    assert.ok(event, `the ${kind} request must be recorded with its real outcome`)
    if (!observed.failed) {
      const { responseEnd } = observed.request.timing()
      assert.ok(
        Math.abs(event.details.durationMs - responseEnd) < 15,
        `${kind} duration ${event.details.durationMs} must match the browser's ${responseEnd}`,
      )
    }
  }
  assert.equal(
    outcomeRequests.filter((event) => event.details.responseReceived === false).length,
    2,
    'only the aborted and reset requests lack a response',
  )
  await checkRequestEvidence(page, call)
  await page.close()
  hub = createStandaloneBridge({
    clientBundlePath: join(root, 'packages/genie-react/dist/client.global.iife.js'),
  })
  const hubAddress = await hub.listen()
  env.GENIE_BRIDGE_URL = hubAddress.url
  env.GENIE_BRIDGE_TOKEN = hub.bridge.agentToken
  scriptHubPort = hubAddress.port
  const scriptPage = await browser.newPage()
  scriptPage.on('pageerror', (error) => errors.push(error.message))
  await scriptPage.goto(`${url}/script-only?_genie=timeline-e2e`)
  await scriptPage.getByRole('button', { name: 'Script action' }).waitFor()
  assert.equal((await call('devtools_wait', { condition: 'ready', timeoutMs: 10000 })).ok, true)
  const scriptRecording = await call('timeline_start', { name: 'script-only' })
  await scriptPage.getByRole('button', { name: 'Script action' }).click()
  await scriptPage.getByRole('button', { name: 'Script ready' }).waitFor()
  await call('timeline_stop', { id: scriptRecording.id })
  reports.script = await call('timeline_read', { id: scriptRecording.id })
  for (const domain of ['request', 'react']) {
    assert.ok(
      reports.script.events.some((event) => event.domain === domain),
      `${domain} must work through the script-tag entry`,
    )
  }
  for (const domain of ['query', 'navigation']) {
    assert.equal(reports.script.coverage[domain].status, 'unavailable')
  }
  assert.deepEqual(errors, [], 'the fixture must remain functional')
  console.error(docsCheck.stdout.trim())
  console.log(JSON.stringify({ status: 'passed', reports }, null, 2))
} finally {
  await browser?.close()
  await hub?.close()
  await server?.close()
  await rm(fixture, { recursive: true, force: true })
}

/** Method, query, abort-after-headers, in-flight-at-stop and a stale response race, as the request lane reports them in Chromium. */
async function checkRequestEvidence(page, call) {
  const exercise = () =>
    page.evaluate(async () => {
      const shown = []
      const slow = fetch('/api/race?range=90d&ms=300')
        .then((response) => response.json())
        .then((data) => shown.push(data.range))
      await new Promise((resolve) => setTimeout(resolve, 30))
      const fast = fetch('/api/race?range=7d&ms=20')
        .then((response) => response.json())
        .then((data) => shown.push(data.range))
      await Promise.all([slow, fast])
      await fetch('/api/race?range=1d&ms=5', { method: 'DELETE' }).then((response) =>
        response.text(),
      )
      const late = new AbortController()
      const stalled = await fetch('/api/headers-then-stall', { signal: late.signal })
      const body = stalled.text().catch(() => 'aborted')
      await new Promise((resolve) => setTimeout(resolve, 30))
      late.abort()
      await body
      fetch('/api/hang').catch(() => {})
      return shown
    })
  const recordRequests = async (queryValues) => {
    const recording = await call('timeline_start', { name: `requests-${queryValues}`, queryValues })
    const shown = await exercise()
    await call('timeline_stop', { id: recording.id })
    const report = await call('timeline_read', { id: recording.id, domains: ['request'] })
    assert.equal(report.queryValues, queryValues)
    return { shown, events: report.events }
  }

  const hashed = await recordRequests('hashed')
  assert.deepEqual(hashed.shown, ['7d', '90d'], 'the slower, older response must land last')
  const races = hashed.events
    .filter((event) => event.details.url.endsWith('/api/race') && event.details.method === 'GET')
    .sort((left, right) => left.details.startMs - right.details.startMs)
  assert.equal(races.length, 2, 'both racing GETs must be recorded with their method')
  const [older, newer] = races
  assert.notEqual(older.details.query, newer.details.query, 'range=90d and range=7d must differ')
  for (const event of races) {
    assert.match(
      event.details.query,
      /^\?range=~[0-9a-f]{10}&ms=~[0-9a-f]{10}$/,
      'hashed query values must not appear in the timeline',
    )
  }
  assert.deepEqual(
    [older, newer].map((event) => [
      event.details.overlappingSameEndpoint,
      event.details.finishedAfterNewer,
      event.details.bodyReadLast,
    ]),
    [
      [1, true, true],
      [1, false, false],
    ],
    'the older request finished after the newer one, and its body was read last',
  )
  assert.ok(
    hashed.events.some(
      (event) => event.details.url.endsWith('/api/race') && event.details.method === 'DELETE',
    ),
    'a DELETE on the same path must be told apart from the GETs',
  )
  const stalled = hashed.events.find((event) =>
    event.details.url.endsWith('/api/headers-then-stall'),
  )
  assert.equal(stalled?.details.outcome, 'aborted-after-response', JSON.stringify(stalled))
  const hanging = hashed.events.find((event) => event.details.url.endsWith('/api/hang'))
  assert.equal(hanging?.type, 'in-flight', JSON.stringify(hanging))
  assert.equal(hanging?.details.endMs, null)

  const plain = await recordRequests('plain')
  const plainRaces = plain.events
    .filter((event) => event.details.url.endsWith('/api/race') && event.details.method === 'GET')
    .map((event) => event.details.query)
    .sort()
  assert.deepEqual(plainRaces, ['?range=7d&ms=20', '?range=90d&ms=300'])
}
