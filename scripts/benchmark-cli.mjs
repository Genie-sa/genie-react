#!/usr/bin/env node
// End-to-end CLI latency against a real Vite app in headless Chromium, on free ports; no model calls. Run `pnpm build` first.
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import {
  breakdown,
  cleanEnv,
  defaultCli,
  median,
  PHASES,
  percentile,
  probed,
  root,
  round,
  timed,
} from './cli-bench-support.mjs'
import { measureWrappers } from './cli-wrappers.mjs'

const { values: options } = parseArgs({
  options: {
    runs: { type: 'string', default: '30' },
    'cold-runs': { type: 'string', default: '10' },
    node: { type: 'string', multiple: true },
    cli: { type: 'string', multiple: true },
    wrappers: { type: 'boolean', default: false },
    only: { type: 'string' },
    json: { type: 'string' },
  },
})
const runs = Number(options.runs)
const coldRuns = Number(options['cold-runs'])
const nodes = options.node ?? [process.execPath]
const clis = (options.cli ?? [defaultCli]).map((cli) => resolve(cli))
const SESSION = 'cli-bench'

const require = createRequire(join(root, 'apps/router-demo/package.json'))
const { createServer } = await import(require.resolve('vite'))
const { genie } = await import(join(root, 'packages/genie-react/dist/vite.js'))
const fixture = await mkdtemp(join(root, 'apps/router-demo/.genie-cli-bench-'))
const cacheRoot = await mkdtemp(join(tmpdir(), 'genie-cli-bench-cache-'))
let server
let browser

const BATCH = JSON.stringify([
  { tool: 'devtools_status', args: {} },
  { tool: 'react_get_tree', args: {} },
  { tool: 'react_render_causes', args: {} },
  { tool: 'react_get_renders', args: {} },
  { tool: 'query_list', args: {} },
])
const COMMANDS = [
  { name: '--version', argv: ['--version'] },
  { name: '--help', argv: ['--help'] },
  { name: 'status', argv: ['status'] },
  { name: 'status --session', argv: ['status', '--session', SESSION] },
  { name: 'tools', argv: ['tools'] },
  { name: 'tools <name>', argv: ['tools', 'react_get_tree'] },
  { name: 'call react_get_tree', argv: ['call', 'react_get_tree', '{}'] },
  { name: 'call react_render_causes', argv: ['call', 'react_render_causes', '{}'] },
  { name: 'batch (5 calls)', argv: ['batch', BATCH] },
  { name: 'call unknown tool (fails)', argv: ['call', 'react_get_treee', '{}'], code: 1 },
].filter((command) => options.only === undefined || command.name.includes(options.only))

async function startApp() {
  await writeFile(
    join(fixture, 'index.html'),
    '<div id="root"></div><script type="module" src="/main.js"></script>',
  )
  await writeFile(
    join(fixture, 'main.js'),
    `
import { createElement as h, memo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { Genie } from 'genie-react'
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })
const Row = memo(function Row({ index, tick }) { return h('li', null, 'row ' + index + ' @' + tick) })
function Rows({ tick }) { return h('ul', null, Array.from({ length: 120 }, (_, index) => h(Row, { key: index, index, tick: index % 3 === 0 ? tick : 0 }))) }
function Summary() {
  const query = useQuery({ queryKey: ['summary'], queryFn: async () => ({ total: 120 }) })
  return h('p', null, query.data ? 'total ' + query.data.total : 'loading')
}
function App() {
  const [tick, setTick] = useState(0)
  return h('main', null, h('button', { onClick: () => setTick((value) => value + 1) }, 'Tick'), h(Summary), h(Rows, { tick }))
}
createRoot(document.getElementById('root')).render(h(QueryClientProvider, { client: queryClient }, h(App), h(Genie, { queryClient })))
`,
  )
  server = await createServer({
    configFile: false,
    root: fixture,
    logLevel: 'error',
    plugins: [genie()],
    optimizeDeps: { include: ['@tanstack/react-router', '@tanstack/react-query'] },
    server: { host: '127.0.0.1', port: 0 },
  })
  await server.listen()
  const address = server.httpServer.address()
  assert.ok(address && typeof address !== 'string')
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(`http://127.0.0.1:${address.port}/?_genie=${SESSION}`)
  await page.getByRole('button', { name: 'Tick' }).waitFor()
  const ready = await timed(
    process.execPath,
    [clis[0], 'call', 'devtools_wait', '{"condition":"ready","timeoutMs":15000}', '--json'],
    { cwd: fixture, env: cleanEnv() },
  )
  assert.equal(ready.code, 0, ready.stdout + ready.stderr)
  for (let click = 0; click < 5; click++) await page.getByRole('button', { name: 'Tick' }).click()
}

/** Cold runs get an empty compile cache each, as the first run after a build would; a build without one has no cold state to emulate. */
async function measure(node, cli, command, { cold, cacheRoot }) {
  const env = cleanEnv()
  const runEnv = async () =>
    cold ? { ...env, NODE_COMPILE_CACHE: await mkdtemp(join(cacheRoot, 'cold-')) } : env
  if (!cold) {
    for (let warmup = 0; warmup < 3; warmup++) {
      await timed(node, [cli, ...command.argv], { cwd: fixture, env })
    }
  }
  const totals = []
  const phases = []
  for (let run = 0; run < (cold ? coldRuns : runs); run++) {
    const plain = await timed(node, [cli, ...command.argv], { cwd: fixture, env: await runEnv() })
    assert.equal(plain.code, command.code ?? 0, `${command.name}: ${plain.stdout}\n${plain.stderr}`)
    totals.push(plain.ms)
    const traced = await probed(node, cli, command.argv, { cwd: fixture, env: await runEnv() })
    phases.push(breakdown(traced))
  }
  const phaseMedians = Object.fromEntries(
    PHASES.map((phase) => [phase, round(median(phases.map((sample) => sample[phase])))]),
  )
  return {
    median: round(median(totals)),
    p95: round(percentile(totals, 0.95)),
    phases: phaseMedians,
  }
}

async function usesCompileCache(node, cli) {
  const { report } = await probed(node, cli, ['--version'], { cwd: fixture, env: cleanEnv() })
  return report.compileCacheDir !== null
}

async function floor(node) {
  const empty = join(fixture, 'empty.mjs')
  await writeFile(empty, '')
  const samples = { eval: [], esm: [] }
  for (let run = 0; run < runs; run++) {
    samples.eval.push((await timed(node, ['-e', '0'])).ms)
    samples.esm.push((await timed(node, [empty])).ms)
  }
  return {
    eval: { median: round(median(samples.eval)), p95: round(percentile(samples.eval, 0.95)) },
    esm: { median: round(median(samples.esm)), p95: round(percentile(samples.esm, 0.95)) },
  }
}

function table(result) {
  const lines = [
    `### ${result.cli} on Node ${result.nodeVersion}`,
    '',
    result.compileCache
      ? 'Cold runs start with an empty compile cache.'
      : 'This build keeps no compile cache, so cold and warm runs are the same measurement.',
    '',
    `Node floor: \`node -e 0\` ${result.floor.eval.median} ms (p95 ${result.floor.eval.p95}), empty ESM file ${result.floor.esm.median} ms (p95 ${result.floor.esm.p95})`,
    '',
    `| command | warm median | warm p95 | cold median | cold p95 | ${PHASES.join(' | ')} |`,
    `|---|---:|---:|---:|---:|${PHASES.map(() => '---:').join('|')}|`,
  ]
  for (const row of result.commands) {
    lines.push(
      `| ${row.name} | ${row.warm.median} | ${row.warm.p95} | ${row.cold.median} | ${row.cold.p95} | ${PHASES.map((phase) => row.warm.phases[phase]).join(' | ')} |`,
    )
  }
  return lines.join('\n')
}

try {
  await startApp()
  const results = []
  for (const node of nodes) {
    const nodeVersion = (await timed(node, ['--version'])).stdout.trim()
    const nodeFloor = await floor(node)
    const builds = []
    for (const cli of clis) {
      const compileCache = await usesCompileCache(node, cli)
      builds.push({
        cli: cli.replace(root, ''),
        node,
        nodeVersion,
        compileCache,
        floor: nodeFloor,
        commands: [],
      })
    }
    // Builds alternate per command, so load from other work on the machine lands on all of them alike.
    for (const command of COMMANDS) {
      for (const [index, cli] of clis.entries()) {
        process.stderr.write(`${nodeVersion} ${cli} ${command.name}\n`)
        const warm = await measure(node, cli, command, { cold: false, cacheRoot })
        const cold = builds[index].compileCache
          ? await measure(node, cli, command, { cold: true, cacheRoot })
          : warm
        builds[index].commands.push({ name: command.name, warm, cold })
      }
    }
    for (const build of builds) {
      results.push(build)
      console.log(`${table(build)}\n`)
    }
  }
  const wrappers = options.wrappers ? await measureWrappers({ runs, fixture }) : undefined
  if (wrappers) console.log(wrappers.markdown)
  if (options.json) {
    await mkdir(resolve(options.json, '..'), { recursive: true })
    await writeFile(
      options.json,
      `${JSON.stringify({ runs, coldRuns, results, wrappers }, null, 2)}\n`,
    )
  }
} finally {
  const cleanup = await Promise.allSettled([browser?.close(), server?.close()])
  await rm(fixture, { recursive: true, force: true })
  await rm(cacheRoot, { recursive: true, force: true })
  for (const step of cleanup) if (step.status === 'rejected') console.error(step.reason)
}
