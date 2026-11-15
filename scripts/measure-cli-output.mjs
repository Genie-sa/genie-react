#!/usr/bin/env node
// Measures what the default text output saves over --json on recorded real results; no model calls, deterministic.
//   node scripts/measure-cli-output.mjs            measure packages/cli/fixtures/output and check built-CLI parity
//   node scripts/measure-cli-output.mjs --record   re-record those fixtures from apps/vite-demo in headless Chromium
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createServer as createNetServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { encode } from 'gpt-tokenizer/encoding/o200k_base'

const root = fileURLToPath(new URL('..', import.meta.url))
const fixturesDir = join(root, 'packages/cli/fixtures/output')
const cli = join(root, 'packages/cli/dist/cli.js')
const execute = promisify(execFile)
const HUB_ANSWERED = /^(?:devtools_|react_quiesce$)/

if (process.argv.includes('--record')) await record()
else await measure()

async function measure() {
  const renderers = await loadRenderers()
  const fixtures = readdirSync(fixturesDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      name: file.replace(/\.json$/, ''),
      ...JSON.parse(readFileSync(join(fixturesDir, file), 'utf8')),
    }))
  const rows = fixtures.map(({ name, argv, result }) => {
    const { label, render, bespoke } = rendererFor(renderers, argv, name)
    const json = `${JSON.stringify(result)}\n`
    const text = `${render(result)}\n`
    const generic = `${renderers.encodeText(result)}\n`
    return {
      name,
      label,
      bespoke,
      json: size(json),
      text: size(text),
      generic: size(generic),
    }
  })
  await checkBuiltCliParity(fixtures, renderers)
  const failures = rows.filter((row) => row.bespoke && row.text.tokens >= row.generic.tokens)
  printTable(rows)
  assert.deepEqual(
    failures.map((row) => row.name),
    [],
    'every bespoke renderer must spend fewer tokens than the generic encoder',
  )
}

function size(text) {
  return { bytes: Buffer.byteLength(text, 'utf8'), tokens: encode(text).length }
}

/** The shipped renderers, loaded from source through Vite so this script measures exactly what the CLI renders. */
async function loadRenderers() {
  const require = createRequire(createRequire(import.meta.url).resolve('vitest/package.json'))
  const { createServer } = await import(require.resolve('vite'))
  const server = await createServer({
    configFile: false,
    root,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
  })
  try {
    const load = (path) => server.ssrLoadModule(join(root, 'packages/cli/src', path))
    const [text, cliOutput, contract, doctor, tools, verify] = await Promise.all([
      load('text-output.ts'),
      load('cli-output.ts'),
      load('contract-output.ts'),
      load('doctor-output.ts'),
      load('tool-text-output.ts'),
      load('verify-output.ts'),
    ])
    cliOutput.setOutputFormat('text')
    return {
      encodeText: text.encodeText,
      envelope: cliOutput.renderEnvelopeText,
      tools: contract.renderToolsText,
      doctor: doctor.renderDoctorText,
      verify: verify.renderVerificationText,
      tool: tools.renderToolText,
      bespokeTools: new Set(Object.keys(tools.TOOL_TEXT_RENDERERS)),
    }
  } finally {
    await server.close()
  }
}

/** How the CLI renders the result of this recorded invocation in text. */
function rendererFor(renderers, argv, name) {
  const [command, target] = argv
  const failed = name.startsWith('failure-') || name.startsWith('truncated-')
  if (failed) return { label: 'CLI envelope', render: renderers.envelope, bespoke: true }
  if (command === 'doctor') return { label: 'doctor', render: renderers.doctor, bespoke: true }
  if (command === 'verify') return { label: 'verification', render: renderers.verify, bespoke: true }
  if (command === 'status') {
    return {
      label: 'status',
      render: (value) => renderers.tool('devtools_status', value),
      bespoke: true,
    }
  }
  if (command === 'tools') {
    const view = argv.includes('--all')
      ? 'all'
      : target === undefined
        ? 'index'
        : target.includes('_')
          ? 'contract'
          : 'group'
    return { label: `tools ${view}`, render: renderers.tools(view), bespoke: true }
  }
  return {
    label: renderers.bespokeTools.has(target) ? target : 'generic',
    render: (value) => renderers.tool(target, value),
    bespoke: renderers.bespokeTools.has(target),
  }
}

function printTable(rows) {
  const percent = (part, whole) => `${Math.round((100 * part) / whole)}%`
  const total = (key, unit) => rows.reduce((sum, row) => sum + row[key][unit], 0)
  const lines = [
    '| Result | Renderer | JSON bytes | Text bytes | Text/JSON bytes | JSON tokens | Text tokens | Text/JSON tokens | Generic tokens |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...[...rows]
      .sort((left, right) => right.json.tokens - left.json.tokens)
      .map((row) =>
        [
          row.name,
          row.label,
          row.json.bytes,
          row.text.bytes,
          percent(row.text.bytes, row.json.bytes),
          row.json.tokens,
          row.text.tokens,
          percent(row.text.tokens, row.json.tokens),
          row.bespoke ? row.generic.tokens : '—',
        ].join(' | '),
      )
      .map((line) => `| ${line} |`),
    `| **Total** | | ${total('json', 'bytes')} | ${total('text', 'bytes')} | ${percent(total('text', 'bytes'), total('json', 'bytes'))} | ${total('json', 'tokens')} | ${total('text', 'tokens')} | ${percent(total('text', 'tokens'), total('json', 'tokens'))} | |`,
  ]
  process.stdout.write(
    `${lines.join('\n')}\n\nTokens: o200k_base via gpt-tokenizer, a public proxy; Claude's tokenizer is not published. Bytes include the trailing newline.\n`,
  )
}

/** Replays every app-answered recorded result through a real bridge and requires the built CLI to print the same text and JSON. */
async function checkBuiltCliParity(fixtures, renderers) {
  const { createStandaloneBridge } = await import(join(root, 'packages/genie-react/dist/hub.js'))
  const { decodeFrame, encodeMessage } = await import(
    join(root, 'packages/genie-react/dist/protocol.js')
  )
  const { WebSocket } = createRequire(join(root, 'packages/cli/package.json'))('ws')
  const calls = fixtures.filter(
    ({ argv, exitCode }) => argv[0] === 'call' && exitCode === 0 && !HUB_ANSWERED.test(argv[1]),
  )
  let answering = null
  const bridge = createStandaloneBridge()
  const { url } = await bridge.listen()
  const app = new WebSocket(`${url}?role=app`)
  try {
    await new Promise((resolve, reject) => {
      app.once('open', resolve)
      app.once('error', reject)
    })
    app.on('message', (raw) => {
      const request = decodeFrame(raw.toString())
      if (request.kind !== 'bridge/request') return
      const expected = answering && `${answering.argv[1]} ${answering.argv[2]}`
      const ok = expected === `${request.tool} ${JSON.stringify(request.args ?? {})}`
      app.send(
        encodeMessage({
          kind: 'app/response',
          id: request.id,
          ok,
          ...(ok ? { result: answering.result } : { error: 'unexpected replay request' }),
        }),
      )
    })
    const tools = [...new Set(calls.map(({ argv }) => argv[1]))]
    app.send(
      encodeMessage({
        kind: 'app/hello',
        protocol: 1,
        sessionId: 'measure',
        app: { name: 'measure' },
        capabilities: ['react', 'query', 'timeline', 'app'],
        tools: tools.map((name) => ({
          name,
          title: name,
          description: 'Recorded result',
          group: 'app',
        })),
      }),
    )
    app.send(encodeMessage({ kind: 'app/ready', sessionId: 'measure' }))
    const deadline = Date.now() + 10_000
    while (!bridge.bridge.getStatus().ready) {
      assert(Date.now() < deadline, 'the replay app did not become ready')
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    const env = {
      ...process.env,
      GENIE_BRIDGE_TOKEN: bridge.bridge.agentToken,
      GENIE_OUTPUT: '',
      GENIE_SESSION: '',
    }
    for (const fixture of calls) {
      const { name, argv, result } = fixture
      answering = fixture
      const call = [cli, ...argv, '--url', url, '--max-bytes', '50000000']
      const text = await execute(process.execPath, call, { env, maxBuffer: 1e8 })
      assert.equal(
        text.stdout,
        `${renderers.tool(argv[1], result)}\n`,
        `${name}: built CLI text differs`,
      )
      const json = await execute(process.execPath, [...call, '--json'], { env, maxBuffer: 1e8 })
      assert.equal(json.stdout, `${JSON.stringify(result)}\n`, `${name}: built CLI JSON differs`)
    }
    process.stderr.write(
      `Built CLI parity: ${calls.length} replayed results match in text and JSON.\n`,
    )
  } finally {
    app.close()
    await bridge.close()
  }
}

async function freePort() {
  const server = createNetServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  await new Promise((resolve) => server.close(resolve))
  return port
}

/** Drives apps/vite-demo through the interactions below and saves each result exactly as `--json` printed it. */
async function record() {
  const appDir = join(root, 'apps/vite-demo')
  const port = await freePort()
  const vite = spawn(
    join(appDir, 'node_modules/.bin/vite'),
    ['--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    {
      cwd: appDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let viteLog = ''
  vite.stdout.on('data', (chunk) => {
    viteLog += chunk
  })
  const { chromium } = createRequire(join(root, 'package.json'))('playwright')
  const browser = await chromium.launch({ headless: true })
  try {
    const deadline = Date.now() + 30_000
    while (!viteLog.includes('bridge ready')) {
      assert(Date.now() < deadline, `vite-demo did not start:\n${viteLog}`)
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    const page = await browser.newPage()
    const session = 'measure'
    await page.goto(`http://127.0.0.1:${port}/?_genie=${session}`)
    await page.waitForTimeout(4_000)
    await page.reload()
    await page.getByRole('button', { name: 'Count is' }).waitFor()
    await mkdir(fixturesDir, { recursive: true })
    for (const file of readdirSync(fixturesDir)) rmSync(join(fixturesDir, file))
    const temporary = [realpathSync(tmpdir()), tmpdir()].map(
      (path) => `${path.replace(/\/$/, '')}/`,
    )
    const genie = async (argv, save) => {
      const result = await execute(
        process.execPath,
        [cli, ...argv, '--session', session, '--json'],
        {
          cwd: appDir,
          env: { ...process.env, GENIE_OUTPUT: '', GENIE_SESSION: '' },
          maxBuffer: 1e8,
        },
      ).then(
        (output) => ({ ...output, code: 0 }),
        (error) => error,
      )
      const value = JSON.parse(result.stdout)
      if (save) {
        let serialized = JSON.stringify({ argv, exitCode: result.code, result: value })
        for (const prefix of temporary) serialized = serialized.split(prefix).join('/tmp/')
        writeFileSync(join(fixturesDir, `${save}.json`), `${serialized}\n`)
      }
      return value
    }
    const call = (tool, args, save) => genie(['call', tool, JSON.stringify(args)], save)
    const click = (name) => page.getByRole('button', { name }).first().click()
    const addTask = async () => {
      await page.locator('input[placeholder="new task title"]').fill('Write docs')
      await click('add task')
    }
    await genie(['status'], 'status')
    await genie(['status', '--sessions-only'], 'status-sessions-only')
    await genie(['tools'], 'tools-index')
    await genie(['tools', 'app'], 'tools-group-app')
    await genie(['tools', 'react_get_renders'], 'tools-contract-react_get_renders')
    await genie(['tools', 'app_login_as'], 'tools-contract-app_login_as')
    await genie(['tools', '--all'], 'tools-all')
    await call('app_login_as', { role: 'admin' }, 'app_login_as')
    await page.waitForTimeout(300)
    await call('react_get_tree', {}, 'react_get_tree')
    await call('react_get_tree', { appOnly: false, includeHost: true }, 'react_get_tree-all')
    await call('react_find_components', { component: 'Task' }, 'react_find_components')
    await call('react_clear_renders', { budget: { adaptive: true } }, 'react_clear_renders')
    for (const name of ['Count is', 'toggle featured', 'toggle theme label']) {
      await click(name)
      await page.waitForTimeout(150)
    }
    await addTask()
    await call('react_quiesce', { idleMs: 500, timeoutMs: 10_000 }, 'react_quiesce')
    const renders = await call('react_get_renders', {}, 'react_get_renders')
    await call('react_get_renders', { view: 'full', limit: 20 }, 'react_get_renders-full')
    const target = renders.components?.find((component) => component.updates > 0)?.name ?? 'App'
    await call('react_render_causes', { component: target, limit: 20 }, 'react_render_causes')
    await call('react_render_causes', { limit: 50 }, 'react_render_causes-all')
    await call('react_component_cohort', { component: target }, 'react_component_cohort')
    const found = await call('react_find_components', { component: target, exact: true })
    const id = found.matches?.[0]?.id
    if (id !== undefined) await call('react_inspect_component', { id }, 'react_inspect_component')
    await call('react_effect_timeline', {}, 'react_effect_timeline')
    const queries = await call('query_list', {}, 'query_list')
    const query = queries.queries?.[0]
    if (query) await call('query_get', { queryHash: query.queryHash }, 'query_get')
    const timeline = await call('timeline_start', { name: 'mutation' }, 'timeline_start')
    await click('run mutation')
    await page.waitForTimeout(1_200)
    await addTask()
    await page.waitForTimeout(300)
    await call('timeline_stop', { id: timeline.id }, 'timeline_stop')
    await call('timeline_read', { id: timeline.id, limit: 200 }, 'timeline_read')
    await call('app_session', {}, 'app_session')
    await call('app_flags', {}, 'app_flags')
    const cohorts = { baseline: [], candidate: [] }
    for (const cohort of Object.keys(cohorts)) {
      for (let run = 0; run < 3; run += 1) {
        await call('react_clear_renders', {})
        await addTask()
        await page.waitForTimeout(200)
        await call('react_quiesce', { idleMs: 300, timeoutMs: 5_000 })
        const first = cohort === 'baseline' && run === 0
        const capture = await call(
          'devtools_capture_create',
          { name: `${cohort}-${run}` },
          first ? 'devtools_capture_create' : undefined,
        )
        cohorts[cohort].push(capture.captureId)
      }
    }
    await call('devtools_capture_list', {}, 'devtools_capture_list')
    await call(
      'devtools_capture_compare',
      {
        baselineCaptureIds: cohorts.baseline,
        candidateCaptureIds: cohorts.candidate,
        minimumRuns: 2,
      },
      'devtools_capture_compare',
    )
    await click('throw in bomb')
    await page.waitForTimeout(500)
    await call('react_error_state', {}, 'react_error_state')
    await call('react_get_renders', {}, 'react_get_renders-after-error')
    await call('react_get_renders', { limt: 5 }, 'failure-invalid_args')
    await call('no_such_tool', {}, 'failure-unknown_tool')
    await genie(['tools', '--all', '--max-bytes', '4000'], 'truncated-tools-all')
    await genie(['doctor', '--live'], 'doctor-live')
    const closed = await freePort()
    await genie(
      ['status', '--url', `ws://127.0.0.1:${closed}/__genie/ws`, '--connect-timeout', '200'],
      'failure-bridge_unreachable',
    )
    process.stderr.write(`Recorded ${readdirSync(fixturesDir).length} results in ${fixturesDir}.\n`)
  } finally {
    await browser.close()
    vite.kill('SIGTERM')
  }
}
