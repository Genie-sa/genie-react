#!/usr/bin/env node
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import {
  openFixturePage,
  runtimePackage,
  runtimeRequire,
  startFixtureServer,
} from './runtime-overhead/server.mjs'

const { values: cli } = parseArgs({
  options: {
    rounds: { type: 'string', default: '3' },
    rows: { type: 'string', default: '1000' },
    'tool-rows': { type: 'string', default: '250,1000,4000' },
    'tool-repeats': { type: 'string', default: '5' },
    'commit-samples': { type: 'string', default: '30' },
    'interaction-samples': { type: 'string', default: '10' },
    'session-steps': { type: 'string', default: '1200' },
    modes: { type: 'string', default: 'absent,idle,paused,window,profile,timeline' },
    skip: { type: 'string', default: '' },
    variant: { type: 'string', multiple: true, default: [] },
    output: { type: 'string' },
    guard: { type: 'boolean', default: false },
  },
})

/** CI configuration: two tree sizes so growth is visible, few samples, and only the states the guard checks. */
const GUARD_OPTIONS = {
  rounds: '3',
  rows: '400,1600',
  'tool-rows': '400,1600',
  'tool-repeats': '3',
  'commit-samples': '15',
  'interaction-samples': '0',
  modes: 'absent,idle,paused,window',
  skip: 'memory',
}

/** Ceilings are ratios measured within one run, so a slower runner moves both sides; each sits well above the value measured locally (see docs/runtime-overhead.md). Unmounts get their own ceiling because Bippy's per-fiber unmount dispatch costs several times React's own deletion work. Idle and paused skip the per-component analysis, so they share the tight ceilings; the analysis runs only in a window. A refresh re-renders every row, so it is the steadiest sign of analysis running and gets the tightest one. */
const GUARD_CEILINGS = {
  idleCommitRatio: { default: 2, refresh: 1.5, unmount: 8 },
  pausedCommitRatio: { default: 2, refresh: 1.5, unmount: 8 },
  windowCommitRatio: { default: 5, unmount: 9 },
  perFiberOverheadGrowth: 2,
  toolGrowthExponent: 1.4,
  boundedToolToTickCommit: 8,
}
const GROWTH_KINDS = ['refresh', 'unmount', 'mount']
const NOISE_FLOOR_MS = 0.5
/** Answers below this are treated as this long, so sub-millisecond jitter cannot read as growth. */
const TOOL_TIME_FLOOR_MS = 2
/** These answer from bounded buffers or one component, so their time must not follow the tree size; they are held to a multiple of a small commit measured in the same run. */
const BOUNDED_TOOLS = new Set([
  'react_inspect_component',
  'react_render_causes',
  'react_effect_timeline',
  'query_list',
  'timeline_read',
])

const options = cli.guard ? { ...cli, ...GUARD_OPTIONS } : cli
const integer = (name) => {
  const value = Number(options[name])
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`--${name} must be a non-negative integer`)
  return value
}
const integers = (name) => options[name].split(',').filter(Boolean).map(Number)

/** Each variant is a built Genie runtime; several run interleaved in one session so a before/after comparison shares machine load. */
const variants = (
  options.variant.length > 0 ? options.variant : [`current=${join(runtimePackage, 'dist')}`]
).map((entry) => {
  const separator = entry.indexOf('=')
  if (separator < 1) throw new Error(`--variant expects name=path, got ${entry}`)
  return { name: entry.slice(0, separator), dist: resolve(entry.slice(separator + 1)) }
})

/** How each state is reached: only the hub calls an agent would make, after the page settles. */
const MODE_SETUP = {
  absent: [],
  idle: [],
  paused: [['react_profile_stop', {}]],
  window: [['react_clear_renders', {}]],
  profile: [['react_profile_start', {}]],
  timeline: [['timeline_start', { name: 'benchmark', maxEvents: 10_000, maxDurationMs: 120_000 }]],
}
const modes = options.modes.split(',').filter(Boolean)
for (const mode of modes) if (!(mode in MODE_SETUP)) throw new Error(`Unknown mode ${mode}`)
const cells = modes.flatMap((mode) =>
  mode === 'absent'
    ? [{ label: 'absent', mode, variant: variants[0] }]
    : variants.map((variant) => ({
        label: variants.length === 1 ? mode : `${mode}@${variant.name}`,
        mode,
        variant,
      })),
)
const skipped = new Set(options.skip.split(',').filter(Boolean))
const workload = {
  commitSamples: integer('commit-samples'),
  interactionSamples: integer('interaction-samples'),
  warmup: 3,
}

const median = (values) => {
  const sorted = values.filter((value) => typeof value === 'number').sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const spread = (values) => {
  const numbers = values.filter((value) => typeof value === 'number')
  return numbers.length === 0 ? null : { min: Math.min(...numbers), max: Math.max(...numbers) }
}
const round = (value, digits = 2) =>
  typeof value === 'number' ? Number(value.toFixed(digits)) : value

/** Rotating the start position keeps warm-up, thermal drift and GC history from favouring one cell. */
const rotations = (items, count) =>
  Array.from({ length: count }, (_, index) => [
    ...items.slice(index % items.length),
    ...items.slice(0, index % items.length),
  ])

async function openPage(browser, baseUrl, { genie, rows }) {
  const session = await openFixturePage(browser, baseUrl, { genie, rows })
  const cdp = await session.page.context().newCDPSession(session.page)
  await cdp.send('HeapProfiler.enable')
  const retainedHeap = async () => {
    await cdp.send('HeapProfiler.collectGarbage')
    await cdp.send('HeapProfiler.collectGarbage')
    return (await cdp.send('Runtime.getHeapUsage')).usedSize
  }
  return { ...session, retainedHeap }
}

const longTaskSummary = (tasks) => ({
  count: tasks.length,
  totalBlockingMs: round(tasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0)),
  longestMs: round(tasks.reduce((longest, task) => Math.max(longest, task.duration), 0)),
})

const counterDelta = (after, before) =>
  Object.fromEntries(Object.entries(after).map(([key, value]) => [key, value - before[key]]))

async function measureMode(browser, { label, mode, variant }, rows) {
  const session = await openPage(browser, variant.baseUrl, { genie: mode !== 'absent', rows })
  const evaluate = (callback, argument) => session.page.evaluate(callback, argument)
  try {
    const startup = await evaluate(() => ({
      ...window.__bench.startup,
      longTasks: window.__bench.longTasks.filter(
        (task) => task.startTime < window.__bench.startup.settledAtMs,
      ),
      oracle: { ...window.__bench.oracle },
      fibers: window.__bench.fibers(),
    }))
    for (const [tool, args] of MODE_SETUP[mode]) await session.call(tool, args)
    const heapBefore = skipped.has('memory') ? null : await session.retainedHeap()
    const oracleBefore = await evaluate(() => ({ ...window.__bench.oracle }))
    const longTasksBefore = await evaluate(() => window.__bench.longTasks.length)
    const timings = await evaluate((input) => window.__bench.runWorkload(input), workload)
    const workloadLongTasks = await evaluate(
      (from) => window.__bench.longTasks.slice(from),
      longTasksBefore,
    )
    const oracleAfterWorkload = await evaluate(() => ({ ...window.__bench.oracle }))
    let memory = null
    if (heapBefore !== null) {
      const heapAfterWorkload = await session.retainedHeap()
      await evaluate((steps) => window.__bench.runSession(steps), integer('session-steps'))
      memory = {
        heapAtStartBytes: heapBefore,
        retainedByWorkloadBytes: heapAfterWorkload - heapBefore,
        retainedBySessionBytes: (await session.retainedHeap()) - heapBefore,
      }
    }
    const oracleAfterSession = await evaluate(() => ({ ...window.__bench.oracle }))
    session.throwIfFailed()
    return {
      label,
      mode,
      variant: variant.name,
      rows,
      startup: {
        genieModulesMs: round(startup.genieModulesMs),
        mountMs: round(startup.mountMs),
        settledAtMs: round(startup.settledAtMs),
        longTasks: longTaskSummary(startup.longTasks),
      },
      fibers: startup.fibers,
      ...timings,
      longTasks: longTaskSummary(workloadLongTasks),
      memory,
      oracle: {
        startup: startup.oracle,
        workload: counterDelta(oracleAfterWorkload, oracleBefore),
        session: counterDelta(oracleAfterSession, oracleAfterWorkload),
      },
    }
  } finally {
    await session.close()
  }
}

const TOOL_CALLS = [
  ['react_get_tree', () => ({})],
  ['react_find_components', () => ({ component: 'Row' })],
  ['react_inspect_component', (context) => ({ id: context.rowId })],
  ['react_get_renders', () => ({ includeCursor: false })],
  ['react_render_causes', () => ({})],
  ['react_effect_timeline', () => ({})],
  ['react_suspense', () => ({})],
  ['react_pending_work', () => ({})],
  ['query_list', () => ({})],
  ['timeline_read', (context) => ({ id: context.timelineId })],
]

async function measureTools(browser, variant, rows, repeats = integer('tool-repeats')) {
  const session = await openPage(browser, variant.baseUrl, { genie: true, rows })
  try {
    await session.call('react_clear_renders', {})
    const timeline = await session.call('timeline_start', {
      name: 'tools',
      maxEvents: 10_000,
      maxDurationMs: 120_000,
    })
    await session.page.evaluate((input) => window.__bench.runWorkload(input), {
      commitSamples: 5,
      interactionSamples: 3,
      warmup: 0,
    })
    const found = await session.call('react_find_components', { component: 'Row' })
    const context = { timelineId: timeline.result.id, rowId: found.result.matches?.[0]?.id }
    if (context.rowId === undefined) throw new Error('react_find_components found no Row')
    const fibers = await session.page.evaluate(() => window.__bench.fibers())
    const tools = {}
    for (const [tool, args] of TOOL_CALLS) {
      const samples = []
      for (let repeat = 0; repeat < repeats; repeat += 1)
        samples.push(await session.call(tool, args(context)))
      tools[tool] = {
        answerMs: round(median(samples.map((sample) => sample.answerMs))),
        blockingMs: round(median(samples.map((sample) => sample.blockingMs))),
        maxBlockingMs: round(Math.max(...samples.map((sample) => sample.blockingMs))),
        bytes: median(samples.map((sample) => sample.bytes)),
      }
    }
    session.throwIfFailed()
    return { variant: variant.name, rows, fibers, tools }
  } finally {
    await session.close()
  }
}

/** The first loads let Vite finish optimizing dependencies, which can reload the page; measured pages must not pay for that. */
async function warmUp(browser, variant, genie, rows) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      if (genie) await measureTools(browser, variant, rows, 1)
      else {
        const session = await openPage(browser, variant.baseUrl, { genie, rows })
        session.throwIfFailed()
        await session.close()
      }
      return
    } catch (error) {
      if (attempt === 3) throw error
    }
  }
}

function aggregateCells(runs) {
  const byCell = {}
  for (const { label } of cells) {
    const mine = runs.filter((run) => run.label === label)
    const metric = (select) => {
      const values = mine.map(select)
      return { median: round(median(values)), spread: spread(values.map((value) => round(value))) }
    }
    const operations = (key) =>
      Object.fromEntries(
        Object.keys(mine[0][key]).map((name) => [
          name,
          {
            medianMs: metric((run) => run[key][name].medianMs),
            p95Ms: metric((run) => run[key][name].p95Ms),
          },
        ]),
      )
    byCell[label] = {
      runs: mine.length,
      commits: operations('commits'),
      interactions: operations('interactions'),
      startup: {
        genieModulesMs: metric((run) => run.startup.genieModulesMs),
        mountMs: metric((run) => run.startup.mountMs),
        settledAtMs: metric((run) => run.startup.settledAtMs),
        totalBlockingMs: metric((run) => run.startup.longTasks.totalBlockingMs),
      },
      workloadLongTasks: {
        count: metric((run) => run.longTasks.count),
        totalBlockingMs: metric((run) => run.longTasks.totalBlockingMs),
        longestMs: metric((run) => run.longTasks.longestMs),
      },
      memory: mine[0].memory
        ? {
            heapAtStartBytes: metric((run) => run.memory.heapAtStartBytes),
            retainedByWorkloadBytes: metric((run) => run.memory.retainedByWorkloadBytes),
            retainedBySessionBytes: metric((run) => run.memory.retainedBySessionBytes),
          }
        : null,
    }
  }
  return byCell
}

/** React must do the same work whether or not Genie watches it; any difference is reported, never averaged away. */
function compareOracles(runs) {
  const reference = runs.find((run) => run.mode === 'absent') ?? runs[0]
  const mismatches = []
  for (const run of runs) {
    for (const phase of ['startup', 'workload', 'session']) {
      for (const [counter, value] of Object.entries(reference.oracle[phase])) {
        if (run.oracle[phase][counter] !== value)
          mismatches.push({
            cell: run.label,
            phase,
            counter,
            expected: value,
            actual: run.oracle[phase][counter],
          })
      }
    }
  }
  return { reference: reference.oracle, identical: mismatches.length === 0, mismatches }
}

function growthExponents(toolRuns, variant) {
  const mine = toolRuns.filter((run) => run.variant === variant)
  if (mine.length < 2) return {}
  const [smallest, largest] = [mine[0], mine.at(-1)]
  const sizeRatio = Math.log(largest.fibers.total / smallest.fibers.total)
  return Object.fromEntries(
    Object.keys(largest.tools).map((tool) => {
      const small = Math.max(smallest.tools[tool].answerMs, 0.05)
      const large = Math.max(largest.tools[tool].answerMs, 0.05)
      return [tool, round(Math.log(large / small) / sizeRatio)]
    }),
  )
}

/** Every check is a ratio inside one run or an exact count, so runner speed cancels out. */
function guardChecks(report) {
  const checks = []
  const check = (name, value, ceiling, detail) =>
    checks.push({ name, value: round(value), ceiling, passed: value <= ceiling, detail })
  for (const size of report.sizes) {
    checks.push({
      name: `react-work-identical@${size.rows}`,
      value: size.oracle.mismatches.length,
      ceiling: 0,
      passed: size.oracle.identical,
      detail: 'commit, render and effect counts from the fixture with and without Genie',
    })
  }
  const [smallest, largest] = [report.sizes[0], report.sizes.at(-1)]
  const commitMedian = (size, label, kind) => size.cells[label]?.commits[kind]?.medianMs.median
  for (const variant of variants) {
    const label = (mode) => (variants.length === 1 ? mode : `${mode}@${variant.name}`)
    for (const kind of Object.keys(largest.cells.absent.commits)) {
      const absent = commitMedian(largest, 'absent', kind)
      for (const [mode, ceilings] of [
        ['idle', GUARD_CEILINGS.idleCommitRatio],
        ['paused', GUARD_CEILINGS.pausedCommitRatio],
        ['window', GUARD_CEILINGS.windowCommitRatio],
      ]) {
        const measured = commitMedian(largest, label(mode), kind)
        if (measured === undefined) continue
        check(
          `${label(mode)}/absent ${kind} commit@${largest.rows}`,
          measured / Math.max(absent, NOISE_FLOOR_MS),
          ceilings[kind] ?? ceilings.default,
          `${round(measured)} ms vs ${round(absent)} ms`,
        )
      }
    }
    if (smallest === largest) continue
    for (const kind of GROWTH_KINDS) {
      const perFiber = (size) =>
        Math.max(
          commitMedian(size, label('window'), kind) - commitMedian(size, 'absent', kind),
          NOISE_FLOOR_MS,
        ) / size.fibers.composites
      if (commitMedian(largest, label('window'), kind) === undefined) continue
      check(
        `${label('window')} per-component ${kind} overhead growth ${smallest.rows}→${largest.rows}`,
        perFiber(largest) / perFiber(smallest),
        GUARD_CEILINGS.perFiberOverheadGrowth,
        '1 means overhead grows linearly with the tree; 4 would be quadratic here',
      )
    }
    const toolRuns = report.tools?.runs.filter((run) => run.variant === variant.name) ?? []
    if (toolRuns.length < 2) continue
    const [smallTools, largeTools] = [toolRuns[0], toolRuns.at(-1)]
    const fiberRatio = Math.log(largeTools.fibers.total / smallTools.fibers.total)
    const tick = Math.max(commitMedian(largest, 'absent', 'tick') ?? 0, NOISE_FLOOR_MS)
    for (const tool of Object.keys(largeTools.tools)) {
      const answer = (run) => Math.max(run.tools[tool].answerMs, TOOL_TIME_FLOOR_MS)
      if (BOUNDED_TOOLS.has(tool)) {
        check(
          `${variant.name} ${tool} answer / absent tick commit@${largeTools.rows}`,
          largeTools.tools[tool].answerMs / tick,
          GUARD_CEILINGS.boundedToolToTickCommit,
          `${largeTools.tools[tool].answerMs} ms vs ${round(tick)} ms; a bounded answer must not cost more than a few small commits`,
        )
        continue
      }
      check(
        `${variant.name} ${tool} answer-time growth exponent ${smallTools.rows}→${largeTools.rows}`,
        Math.log(answer(largeTools) / answer(smallTools)) / fiberRatio,
        GUARD_CEILINGS.toolGrowthExponent,
        `${smallTools.tools[tool].answerMs} → ${largeTools.tools[tool].answerMs} ms; 1 is linear, 2 is quadratic`,
      )
    }
  }
  return { passed: checks.every((entry) => entry.passed), ceilings: GUARD_CEILINGS, checks }
}

const workspace = await mkdtemp(join(tmpdir(), 'genie-runtime-overhead-'))
const servers = []
let browser
let guardFailed = false
try {
  for (const variant of variants) {
    const server = await startFixtureServer(
      variant.dist,
      join(workspace, `vite-cache-${variant.name}`),
    )
    servers.push(server)
    variant.baseUrl = server.baseUrl
  }
  browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
    ],
  })
  const rowSizes = integers('rows')
  await warmUp(browser, variants[0], false, rowSizes[0])
  for (const variant of variants) await warmUp(browser, variant, true, rowSizes[0])
  const report = {
    conditions: {
      browser: `Chromium ${browser.version()} headless`,
      react: runtimeRequire('react/package.json').version,
      reactDom: runtimeRequire('react-dom/package.json').version,
      tanstackQuery: runtimeRequire('@tanstack/react-query/package.json').version,
      genieBundles: Object.fromEntries(variants.map((variant) => [variant.name, variant.dist])),
      serving: 'Vite dev server, development React build',
      platform: `${process.platform} ${process.arch}`,
      rounds: integer('rounds'),
      workload,
    },
    sizes: [],
  }
  if (!skipped.has('modes')) {
    for (const rows of rowSizes) {
      const runs = []
      for (const order of rotations(cells, integer('rounds'))) {
        for (const cell of order) {
          runs.push(await measureMode(browser, cell, rows))
          process.stderr.write(`measured ${cell.label} at ${rows} rows\n`)
        }
      }
      report.sizes.push({
        rows,
        fibers: runs[0].fibers,
        cells: aggregateCells(runs),
        oracle: compareOracles(runs),
        runs,
      })
    }
  }
  if (!skipped.has('tools')) {
    const toolRuns = []
    const toolRows = integers('tool-rows')
    const variantOrders = rotations(variants, toolRows.length)
    for (const [sizeIndex, rows] of toolRows.entries()) {
      for (const variant of variantOrders[sizeIndex]) {
        toolRuns.push(await measureTools(browser, variant, rows))
        process.stderr.write(`measured tools at ${rows} rows (${variant.name})\n`)
      }
    }
    toolRuns.sort((left, right) => left.rows - right.rows)
    report.tools = {
      runs: toolRuns,
      growthExponent: Object.fromEntries(
        variants.map((variant) => [variant.name, growthExponents(toolRuns, variant.name)]),
      ),
    }
  }
  if (cli.guard) {
    report.guard = guardChecks(report)
    guardFailed = !report.guard.passed
    for (const entry of report.guard.checks) {
      process.stderr.write(
        `${entry.passed ? 'pass' : 'FAIL'}  ${entry.name}: ${entry.value} (ceiling ${entry.ceiling})${entry.detail ? `  ${entry.detail}` : ''}\n`,
      )
    }
  }
  const json = `${JSON.stringify(report, null, 2)}\n`
  if (options.output) await writeFile(options.output, json)
  else process.stdout.write(json)
} finally {
  await browser?.close()
  for (const server of servers) await server.close()
  await rm(workspace, { recursive: true, force: true })
}
if (guardFailed) process.exitCode = 1
