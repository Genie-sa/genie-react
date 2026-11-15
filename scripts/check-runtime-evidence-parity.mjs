#!/usr/bin/env node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import { openFixturePage, runtimePackage, startFixtureServer } from './runtime-overhead/server.mjs'

const { values: options } = parseArgs({
  options: {
    baseline: { type: 'string' },
    candidate: { type: 'string', default: join(runtimePackage, 'dist') },
    rows: { type: 'string', default: '20,60' },
  },
})
if (!options.baseline) {
  throw new Error(
    'Pass --baseline <dist> built from the reference commit, for example: git worktree add /tmp/base main && (cd /tmp/base && pnpm install && pnpm --filter genie-react build), then --baseline /tmp/base/packages/genie-react/dist',
  )
}

/** A budget no commit in the scenario can exhaust: evidence is only comparable when neither build ran out of time. */
const UNLIMITED_BUDGET = {
  fiberLimit: 20_000,
  operationLimit: 2_000_000,
  timeLimitMs: 500,
  targetOperationReserve: 500_000,
  targetTimeReserveMs: 250,
}
/** Source ownership is classified under a time budget, so app-only filtering can hide different components on a slower run; reads include every component instead. */
const TOOL_CALLS = [
  ['react_get_tree', { appOnly: false }],
  ['react_find_components', { component: 'Row', appOnly: false }],
  ['react_render_causes', { limit: 200, view: 'full', appOnly: false }],
  ['react_effect_timeline', { limit: 200, appOnly: false }],
  ['react_effect_audit', { appOnly: false }],
  ['react_suspense', {}],
  ['react_pending_work', {}],
  ['react_error_state', { appOnly: false }],
  ['react_component_cohort', { component: 'Row', appOnly: false }],
]
const COMPONENTS = [
  'Row',
  'Cell',
  'StatusBadge',
  'Avatar',
  'RowActions',
  'RowSubscription',
  'RowMeasure',
  'MetricWidget',
  'SummaryWidget',
  'Sparkline',
  'Bar',
  'NavItem',
  'Icon',
  'Header',
  'Clock',
  'SearchBox',
  'UserMenu',
  'Sidebar',
  'Dashboard',
  'DataTable',
  'Workspace',
  'ReleaseNotes',
]
/** Wall-clock fields, plus source attribution, which is resolved under a time budget and so completes further on a faster build. */
const TIME_BOUND_KEY =
  /(time|Time|duration|Duration|Ms|At|expires|snapshotId|cursor|Cursor|timestamp|Timestamp)$|^(ownershipCoverage|sourceClassification|source|sourceAttribution|sourceProvenance|sourceOwnership|hookProvenance|producerCandidate)$/
const ID_KEY =
  /^(id|fiberId|componentId|boundaryId|rootId|parentId|ownerId|instanceId|awaiterId|targetId)$/

/** Drop time-bound fields and renumber fiber ids by first appearance: ids are per-document handles, and which number a component gets is not evidence. */
function normalize(value) {
  const ids = new Map()
  const walk = (entry, key) => {
    if (Array.isArray(entry)) return entry.map((item) => walk(item, key))
    if (entry && typeof entry === 'object')
      return Object.fromEntries(
        Object.entries(entry)
          .filter(([name]) => !TIME_BOUND_KEY.test(name))
          .map(([name, item]) => [name, walk(item, name)]),
      )
    if (typeof entry === 'number' && key && ID_KEY.test(key)) {
      if (!ids.has(entry)) ids.set(entry, `#${ids.size}`)
      return ids.get(entry)
    }
    return entry
  }
  return walk(value)
}

/** One fixed sequence: renders since load, a window, a paused stretch, a restarted profile, then every read. */
async function collectEvidence(browser, baseUrl, rows) {
  const session = await openFixturePage(browser, baseUrl, { genie: true, rows })
  const runWorkload = (input) =>
    session.page.evaluate((value) => window.__bench.runWorkload(value), input)
  const readRenders = async (evidence, phase) => {
    for (const name of COMPONENTS) {
      const report = (
        await session.call('react_get_renders', {
          component: name,
          includeCursor: false,
          limit: 200,
          view: 'full',
          appOnly: false,
        })
      ).result
      evidence[`${phase}:${name}`] = report.components
        .filter((component) => component.name === name)
        .sort((left, right) =>
          (left.instance?.logicalPath ?? '').localeCompare(right.instance?.logicalPath ?? ''),
        )
    }
  }
  try {
    const evidence = {}
    await readRenders(evidence, 'rendersSinceLoad')
    await session.call('react_clear_renders', { budget: UNLIMITED_BUDGET })
    await runWorkload({ commitSamples: 4, interactionSamples: 2, warmup: 1 })
    await session.call('react_profile_stop', {})
    await runWorkload({ commitSamples: 2, interactionSamples: 1, warmup: 0 })
    await session.call('react_profile_start', { budget: UNLIMITED_BUDGET })
    await runWorkload({ commitSamples: 3, interactionSamples: 1, warmup: 0 })
    for (const [tool, args] of TOOL_CALLS) evidence[tool] = (await session.call(tool, args)).result
    await readRenders(evidence, 'renders')
    const inspected = evidence.react_find_components.matches?.[3]?.id
    evidence.inspect = (await session.call('react_inspect_component', { id: inspected })).result
    evidence.oracle = await session.page.evaluate(() => window.__bench.oracle)
    session.throwIfFailed()
    return normalize(evidence)
  } finally {
    await session.close()
  }
}

function differences(left, right, path = '', found = []) {
  if (JSON.stringify(left) === JSON.stringify(right)) return found
  const nested =
    left && right && typeof left === 'object' && typeof right === 'object'
      ? Array.isArray(left) === Array.isArray(right)
      : false
  if (!nested) {
    found.push({ path, baseline: left, candidate: right })
    return found
  }
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)]))
    differences(left[key], right[key], path ? `${path}.${key}` : key, found)
  return found
}

const workspace = await mkdtemp(join(tmpdir(), 'genie-evidence-parity-'))
const servers = []
let browser
let failed = false
try {
  const builds = { baseline: resolve(options.baseline), candidate: resolve(options.candidate) }
  const urls = {}
  for (const [name, dist] of Object.entries(builds)) {
    const server = await startFixtureServer(dist, join(workspace, `vite-cache-${name}`))
    servers.push(server)
    urls[name] = server.baseUrl
  }
  browser = await chromium.launch({ headless: true })
  for (const rows of options.rows.split(',').map(Number)) {
    const collected = {}
    for (const [name, url] of Object.entries(urls)) {
      for (let attempt = 1; ; attempt += 1) {
        try {
          collected[name] = await collectEvidence(browser, url, rows)
          break
        } catch (error) {
          if (attempt === 3) throw error
        }
      }
    }
    const found = differences(collected.baseline, collected.candidate)
    console.log(
      `${rows} rows: ${found.length} differences across ${Object.keys(collected.baseline).length} reports`,
    )
    for (const entry of found.slice(0, 20)) console.log(JSON.stringify(entry).slice(0, 400))
    if (found.length > 0) failed = true
  }
} finally {
  await browser?.close()
  for (const server of servers) await server.close()
  await rm(workspace, { recursive: true, force: true })
}
if (failed) process.exitCode = 1
