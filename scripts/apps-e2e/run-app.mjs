import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { isGenieResourceFailure, openSession } from './browser.mjs'
import { contractSweep, outlineViolations } from './contract-sweep.mjs'
import { CheckFailure, Cli, check, ProcessGroup, ROOT, waitFor } from './harness.mjs'
import { discoverySnapshot } from './servers.mjs'

const READY_WAIT_MS = 45_000
const GENIE_RESOURCE_LOADS = 'source-map resolution'
const STALE_DISCOVERY_DEFECT = 'KD-8'
const GLOBAL_EXCLUSIONS = {
  query_clear: 'wipes every cached query, which would invalidate the checks that follow',
  query_reset:
    'resets app queries to their initial state; query_simulate_state covers state changes',
  query_cancel: 'cancels in-flight app fetches, which no deterministic interaction can hold open',
  router_clear_cache: 'drops every route match; navigation round trips cover the router',
}

function sessionName(app) {
  return `apps-e2e-${app}-${randomBytes(3).toString('hex')}`
}

async function waitForDomains(cli, domains) {
  return waitFor(
    `domains ${domains.join(', ')}`,
    async () => {
      const status = await cli.status()
      const missing = domains.filter((domain) => !status.domains?.includes(domain))
      if (missing.length > 0) {
        throw new CheckFailure(
          `missing ${missing.join(', ')}; advertised ${status.domains?.join(', ')}`,
        )
      }
      return status
    },
    { timeoutMs: 30_000, intervalMs: 500 },
  )
}

async function waitForSession(cli, spec, session) {
  const ready = await cli.run(['status', '--wait', String(READY_WAIT_MS)], {
    timeoutMs: READY_WAIT_MS + 15_000,
  })
  check(ready.code === 0 && ready.json.ready === true, 'session never became ready', ready.json)
  check(
    ready.json.sessionSelector?.resolvedSessionId === ready.json.sessionId &&
      new URL(ready.json.app.url).searchParams.get('_genie') === session,
    'status resolved a session other than the one this run opened',
    ready.json,
  )
  await waitForDomains(cli, spec.domains)
}

function createContext({ spec, cli, page, errors, defects, log, started, session, browser }) {
  const contracts = new Map()
  const called = new Set()
  const ctx = {
    spec,
    cli,
    page,
    errors,
    log,
    started,
    browser,
    contracts,
    called,
    async open(path = '/') {
      const target = new URL(path, started.url)
      target.searchParams.set('_genie', session)
      await page.goto(target.href, { waitUntil: 'domcontentloaded' })
      await waitForSession(cli, spec, session)
    },
    knownDefect: (id, probe) => defects.expect(id, spec.name, probe),
    attempted: (tool) => defects.attempted(spec.name, tool),
    claimSweepFailures: (failures) =>
      failures.filter(
        (failure) =>
          !defects.claim(spec.name, {
            kind: failure.kind,
            tool: failure.tool,
            details: failure.violations,
          }),
      ),
    async call(tool, args = {}, options) {
      const result = await cli.call(tool, args, options)
      called.add(tool)
      defects.attempted(spec.name, tool)
      const violations = outlineViolations(result, contracts.get(tool)?.output)
      const explained =
        violations.length === 0 ||
        defects.claim(spec.name, { kind: 'outline-drift', tool, details: violations })
      check(explained, `${tool} result drifts from its output outline`, violations)
      return result
    },
    resolvers: (produced) => ({
      ...spec.sweepArgs,
      id: () => ctx.probeComponentId,
      queryKey: () => produced.query_list?.queries?.[0]?.queryKey,
      'react_suspense.id': (own) => own?.boundaries?.[0]?.id,
      'timeline_read.id': () => produced.timeline_start?.id,
      'timeline_stop.id': () => produced.timeline_start?.id,
      'mutation_get.mutationId': () => produced.query_list_mutations?.mutations?.[0]?.mutationId,
      'devtools_capture_read.captureId': () =>
        produced.devtools_capture_list?.captures?.[0]?.captureId,
      'plugin_get_events.pluginId': () => produced.plugin_list?.plugins?.[0]?.pluginId,
    }),
  }
  return ctx
}

/** Runs every step even after a failure; a failed step reloads the app before the next one, so one defect is reported once instead of cascading. */
async function runSteps(label, steps, ctx) {
  const failures = []
  let dirty = false
  for (const step of steps) {
    const started = Date.now()
    try {
      if (dirty) {
        await ctx.open()
        await ctx.spec.ready(ctx)
        dirty = false
      }
      await step.run(ctx)
      ctx.log(`  ✓ ${step.name} (${Date.now() - started} ms)`)
    } catch (error) {
      dirty = true
      ctx.log(`  ✗ ${step.name}`)
      failures.push({ step: step.name, error: error instanceof Error ? error.message : error })
    }
  }
  if (failures.length > 0) {
    throw new CheckFailure(
      `${label}: ${failures.length} step(s) failed`,
      failures.map((failure) => `[${failure.step}] ${failure.error}`).join('\n\n'),
    )
  }
}

async function assertCoverage(ctx) {
  const final = await ctx.cli.run(['tools'])
  const names = new Set([...ctx.contracts.keys(), ...final.json.groups.flatMap((g) => g.tools)])
  const excluded = { ...GLOBAL_EXCLUSIONS, ...ctx.spec.exclusions }
  const uncovered = [...names].filter((name) => !ctx.called.has(name) && !(name in excluded))
  check(
    uncovered.length === 0,
    `${ctx.spec.name}: advertised tools with no successful call and no recorded exclusion; add a read-only default, a targeted sequence, or an exclusion with its reason`,
    uncovered,
  )
  const unused = Object.keys(excluded).filter((name) => names.has(name) && ctx.called.has(name))
  check(unused.length === 0, 'excluded tools were called; drop the exclusion', unused)
  const skipped = [...names].filter((name) => name in excluded)
  return { advertised: names.size, called: names.size - skipped.length, skipped }
}

export async function runApp(spec, { browser, defects, log, production }) {
  const processes = new ProcessGroup()
  const appDir = join(ROOT, spec.dir)
  const session = sessionName(spec.name)
  let browserContext
  let started
  if (spec.preflight) {
    const preflightProcesses = new ProcessGroup()
    try {
      await spec.preflight({
        processes: preflightProcesses,
        appDir,
        browser,
        log,
        knownDefect: (id, probe) => defects.expect(id, spec.name, probe),
      })
    } finally {
      await preflightProcesses.stopAll()
    }
  }
  try {
    log(`starting ${spec.name} (${spec.hub})`)
    started = await spec.start({ processes, appDir })
    const cli = new Cli({ cwd: appDir, session })
    const opened = await openSession(browser, started.url, session)
    browserContext = opened.context
    const ctx = createContext({ spec, cli, ...opened, defects, log, started, session, browser })
    await waitForSession(cli, spec, session)
    await spec.ready(ctx)
    ctx.probeComponentId = (
      await cli.call('react_find_components', {
        component: spec.probeComponent,
        exact: true,
        appOnly: false,
      })
    ).matches[0]?.id
    check(ctx.probeComponentId !== undefined, `probe component ${spec.probeComponent} not found`)
    for (const [name, contract] of await contractSweep(ctx)) ctx.contracts.set(name, contract)
    log(`  ✓ contract sweep`)
    await runSteps(spec.name, spec.groundTruth, ctx)
    const coverage = await assertCoverage(ctx)
    log(
      `  ✓ coverage: ${coverage.called}/${coverage.advertised} tools called; excluded with a recorded reason: ${coverage.skipped.join(', ') || 'none'}`,
    )
    defects.attempted(spec.name, GENIE_RESOURCE_LOADS)
    const missingResources = opened.errors.release(isGenieResourceFailure)
    if (missingResources.length > 0) {
      const explained = defects.claim(spec.name, {
        kind: 'genie-resource-failure',
        tool: GENIE_RESOURCE_LOADS,
        details: missingResources.map((entry) => entry.url),
      })
      check(
        explained,
        'Genie requested resources the page cannot load',
        missingResources.slice(0, 20),
      )
    }
    opened.errors.assertClean(spec.name)
    log(`  ✓ no unexpected page or console errors`)
  } finally {
    await browserContext?.close().catch(() => {})
    await processes.stopAll()
    await started?.cleanup?.()
  }
  const noDiscoveryLeft = async () => {
    check(
      (await discoverySnapshot(appDir)) === null,
      'the stopped dev server left .genie/bridge.json',
    )
  }
  if (defects.registered(STALE_DISCOVERY_DEFECT, spec.name)) {
    await defects.expect(STALE_DISCOVERY_DEFECT, spec.name, noDiscoveryLeft)
  } else {
    await noDiscoveryLeft()
  }
  if (production && spec.production) {
    log(`production build: ${spec.name}`)
    const buildProcesses = new ProcessGroup()
    try {
      await spec.production({
        processes: buildProcesses,
        appDir,
        browser,
        log,
        knownDefect: (id, probe) => defects.expect(id, spec.name, probe),
      })
    } finally {
      await buildProcesses.stopAll()
    }
  }
  defects.assertExercised(spec.name)
}
