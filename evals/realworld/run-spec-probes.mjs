#!/usr/bin/env node
import { access, chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import { killAllChildren, run } from '../lib/process.mjs'
import { createProbeContext } from './lib/probe-context.mjs'
import { loadSpecs, readEditedSources } from './lib/specs.mjs'
import { createVariant, startVariant } from './lib/workspace.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const APPS = {
  dashboard: {
    appDir: join(ROOT, 'apps/realworld-dashboard'),
    catalogueDir: join(ROOT, 'evals/realworld/dashboard'),
  },
}
const USAGE = `Usage: node evals/realworld/run-probes.mjs <app> [options]

Proves the seeded-bug catalogue for one realistic app: every bug probe must fail on the shipped app and
pass with its reference fix, and every decoy probe must match its declared expectation.

Apps: ${Object.keys(APPS).join(', ')}

Options:
  --only <ids>   Comma-separated spec ids to run
  --dry-run      Validate specs and apply every reference fix in memory; no browser or server
  --typecheck    With --dry-run, also typecheck the shipped app and every fixed variant
  --keep         Keep variant workspaces under the app's .variants directory
  --headed       Show the browser
  -h, --help     Show this help`

/**
 * @typedef {import('./lib/specs.mjs').Spec} Spec
 * @typedef {import('./lib/probe-context.mjs').Check} Check
 * @typedef {{ variant: 'shipped' | 'fixed', pass: boolean, checks: Check[], error?: string, diagnostics?: { pageErrors: string[], serverLog: string, url: string }, durationMs: number }} ProbeRun
 * @typedef {{ spec: Spec, runs: ProbeRun[], verdict: string, ok: boolean }} SpecResult
 */

function parseCli() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      only: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      typecheck: { type: 'boolean', default: false },
      keep: { type: 'boolean', default: false },
      headed: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })
  if (values.help) {
    process.stdout.write(`${USAGE}\n`)
    process.exit(0)
  }
  const [appName, ...extra] = positionals
  if (!appName || extra.length > 0 || !(appName in APPS)) {
    process.stderr.write(`${USAGE}\n`)
    process.exit(2)
  }
  return { appName: /** @type {keyof typeof APPS} */ (appName), ...values }
}

/**
 * @param {string} path
 * @param {string} hint
 */
async function requireFile(path, hint) {
  try {
    await access(path)
  } catch {
    throw new Error(`${relative(ROOT, path)} is missing; ${hint}`)
  }
}

/**
 * @param {string} appDir
 * @param {string} dir
 */
async function typecheck(appDir, dir) {
  const result = await run(
    process.execPath,
    [join(appDir, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', dir],
    { cwd: dir, timeoutMs: 120_000 },
  )
  if (result.code !== 0)
    throw new Error(`typecheck failed in ${relative(ROOT, dir)}:\n${result.stdout}${result.stderr}`)
}

/**
 * @param {string} appDir
 * @param {Spec[]} specs
 * @param {{ typecheck: boolean }} options
 */
async function dryRun(appDir, specs, options) {
  const variantsDir = join(appDir, '.variants', `dry-run-${process.pid}`)
  try {
    if (options.typecheck) {
      await typecheck(appDir, appDir)
      process.stdout.write('ok  shipped app typechecks\n')
    }
    for (const spec of specs) {
      const edits = spec.referenceFix ?? []
      await readEditedSources(appDir, edits)
      await requireFile(
        join(dirname(spec.path), spec.probe.script),
        'every spec needs its probe script',
      )
      if (options.typecheck && edits.length > 0) {
        await typecheck(appDir, await createVariant({ appDir, variantsDir, name: spec.id, edits }))
      }
      process.stdout.write(
        `ok  ${spec.id} (${spec.kind}, ${edits.length} edit${edits.length === 1 ? '' : 's'}${options.typecheck && edits.length > 0 ? ', typechecks' : ''})\n`,
      )
    }
  } finally {
    await rm(variantsDir, { recursive: true, force: true })
  }
}

/**
 * @param {{ browser: import('playwright').Browser, variant: import('./lib/workspace.mjs').RunningVariant, cliPath: string, runtimeDir: string, spec: Spec, label: 'shipped' | 'fixed' }} options
 * @returns {Promise<ProbeRun>}
 */
async function runProbe({ browser, variant, cliPath, runtimeDir, spec, label }) {
  const startedAt = Date.now()
  const session = `rw-${spec.id}-${label}`.slice(0, 64)
  const { default: probe } = await import(
    pathToFileURL(join(dirname(spec.path), spec.probe.script)).href
  )
  const ctx = await createProbeContext({ browser, variant, cliPath, runtimeDir, session })
  try {
    await probe(ctx)
    const pass = ctx.checks.length > 0 && ctx.checks.every((check) => check.pass)
    return { variant: label, pass, checks: ctx.checks, durationMs: Date.now() - startedAt }
  } catch (error) {
    return {
      variant: label,
      pass: false,
      checks: ctx.checks,
      error: error instanceof Error ? error.message : String(error),
      diagnostics: {
        pageErrors: ctx.pageErrors.slice(-5),
        serverLog: variant.log().slice(-2_000),
        url: ctx.page.url(),
      },
      durationMs: Date.now() - startedAt,
    }
  } finally {
    await ctx.close()
  }
}

/**
 * @param {Spec} spec
 * @param {ProbeRun[]} runs
 */
function judge(spec, runs) {
  const shipped = runs.find((run) => run.variant === 'shipped')
  const fixed = runs.find((run) => run.variant === 'fixed')
  if (spec.kind === 'decoy') {
    const flagged = !shipped?.pass
    if (shipped?.error) return { verdict: `probe error: ${shipped.error}`, ok: false }
    if (spec.expectation === 'known-false-positive') {
      return flagged
        ? { verdict: `flagged by Genie (known false positive ${spec.finding})`, ok: true }
        : { verdict: `no longer flagged; update expectation for ${spec.finding}`, ok: false }
    }
    return flagged
      ? { verdict: 'flagged by Genie (false positive)', ok: false }
      : { verdict: 'not flagged', ok: true }
  }
  if (spec.probe.genie === 'blocked')
    return { verdict: `blocked: ${spec.probe.blockedReason}`, ok: true }
  const failedBefore = shipped !== undefined && !shipped.pass && shipped.error === undefined
  const passedAfter = fixed?.pass === true
  if (failedBefore && passedAfter) return { verdict: 'fails on shipped, passes with fix', ok: true }
  const reasons = []
  if (!failedBefore)
    reasons.push(
      shipped?.error ? `shipped probe errored: ${shipped.error}` : 'shipped probe passed',
    )
  if (!passedAfter)
    reasons.push(fixed?.error ? `fixed probe errored: ${fixed.error}` : 'fixed probe failed')
  return { verdict: reasons.join('; '), ok: false }
}

/**
 * @param {SpecResult[]} results
 */
function printSummary(results) {
  const lines = ['', 'id                                         kind   shipped  fixed    verdict']
  for (const { spec, runs, verdict, ok } of results) {
    const cell = (/** @type {'shipped' | 'fixed'} */ label) => {
      const run = runs.find((entry) => entry.variant === label)
      if (!run) return '-'
      return run.error ? 'error' : run.pass ? 'pass' : 'fail'
    }
    lines.push(
      `${ok ? '✓' : '✗'} ${spec.id.padEnd(41)} ${spec.kind.padEnd(6)} ${cell('shipped').padEnd(8)} ${cell('fixed').padEnd(8)} ${verdict}`,
    )
    for (const run of runs) {
      for (const check of run.checks)
        lines.push(
          `      ${run.variant.padEnd(7)} ${check.pass ? 'pass' : 'fail'} ${check.name}: ${check.detail}`,
        )
    }
  }
  const failed = results.filter((result) => !result.ok).length
  lines.push('', `${results.length - failed}/${results.length} specs behave as declared`)
  process.stdout.write(`${lines.join('\n')}\n`)
}

async function main() {
  const options = parseCli()
  const { appDir, catalogueDir } = APPS[options.appName]
  const only = options.only ? new Set(options.only.split(',').map((id) => id.trim())) : null
  const specs = (await loadSpecs(catalogueDir)).filter((spec) => !only || only.has(spec.id))
  if (only && specs.length !== only.size)
    throw new Error(
      `Unknown spec id in --only: ${[...only].filter((id) => !specs.some((spec) => spec.id === id)).join(', ')}`,
    )
  if (options['dry-run']) {
    await dryRun(appDir, specs, { typecheck: options.typecheck })
    return 0
  }

  const cliPath = join(appDir, 'node_modules/@genie-react/cli/dist/cli.js')
  const viteBin = join(appDir, 'node_modules/vite/bin/vite.js')
  await requireFile(cliPath, 'run `pnpm build` first')
  await requireFile(viteBin, 'run `pnpm install` first')

  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`
  const variantsDir = join(appDir, '.variants', runId)
  const runtimeDir = await mkdtemp(join(tmpdir(), 'genie-realworld-'))
  await chmod(runtimeDir, 0o700)
  const browser = await chromium.launch({ headless: !options.headed })
  /** @type {import('./lib/workspace.mjs').RunningVariant | null} */
  let shipped = null
  let shippedDir = ''
  /** @type {SpecResult[]} */
  const results = []
  try {
    shippedDir = await createVariant({ appDir, variantsDir, name: 'shipped', edits: [] })
    shipped = await startVariant({ name: 'shipped', dir: shippedDir, viteBin, runtimeDir })
    for (const spec of specs) {
      process.stderr.write(`· ${spec.id}\n`)
      const runs = [
        await runProbe({ browser, variant: shipped, cliPath, runtimeDir, spec, label: 'shipped' }),
      ]
      if (spec.kind === 'bug' && spec.probe.genie === 'observable') {
        const dir = await createVariant({
          appDir,
          variantsDir,
          name: spec.id,
          edits: spec.referenceFix ?? [],
          warmCacheFrom: shippedDir,
        })
        const fixed = await startVariant({ name: spec.id, dir, viteBin, runtimeDir })
        try {
          runs.push(
            await runProbe({ browser, variant: fixed, cliPath, runtimeDir, spec, label: 'fixed' }),
          )
        } finally {
          await fixed.stop()
          if (!options.keep) await rm(dir, { recursive: true, force: true })
        }
      }
      results.push({ spec, runs, ...judge(spec, runs) })
    }
  } finally {
    await shipped?.stop()
    await browser.close()
    if (!options.keep) await rm(variantsDir, { recursive: true, force: true })
    await rm(runtimeDir, { recursive: true, force: true })
  }

  printSummary(results)
  const resultsDir = join(ROOT, 'evals/results')
  await mkdir(resultsDir, { recursive: true })
  const reportPath = join(resultsDir, `realworld-${options.appName}-${runId}.json`)
  await writeFile(
    reportPath,
    `${JSON.stringify(
      results.map(({ spec, runs, verdict, ok }) => ({
        id: spec.id,
        kind: spec.kind,
        category: spec.category,
        ok,
        verdict,
        runs,
      })),
      null,
      2,
    )}\n`,
  )
  process.stdout.write(`Report: ${relative(ROOT, reportPath)}\n`)
  return results.every((result) => result.ok) ? 0 : 1
}

const stop = () => {
  killAllChildren()
  process.exit(130)
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)

main().then(
  (code) => process.exit(code),
  (error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    killAllChildren()
    process.exit(1)
  },
)
