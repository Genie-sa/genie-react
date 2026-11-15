#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import { releaseAll, track } from '../lib/cleanup.mjs'
import { delay, freePort, killAllChildren, run, start, waitForHttp } from '../lib/process.mjs'

/**
 * @typedef {{ file: string, find: string, replace: string }} Edit
 * @typedef {{ name: string, pass: boolean, detail: string, evidence: 'genie' | 'control' }} Check
 * @typedef {{ module?: string, status?: 'blocked', missingEvidence?: string, control?: string }} ProbeSpec
 * @typedef {{ id: string, kind: 'bug' | 'decoy', referenceFix?: Edit[], probe: ProbeSpec, path: string }} Entry
 * @typedef {{ appDir: string, dev: { command: string, args: string[], bundlers: Record<string, string[]>, env?: Record<string, string> }, warmup: string[] }} AppConfig
 * @typedef {{ outcome: 'pass' | 'fail' | 'error', checks: Check[], error?: string }} ProbeResult
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CLI = join(ROOT, 'packages/cli/dist/cli.js')
const SERVER_READY_TIMEOUT_MS = 180_000
const RECOMPILE_SETTLE_MS = 1_500
const CLI_TIMEOUT_MS = 60_000
const APP_TOOL_REGISTRATION_TIMEOUT_MS = 10_000
const NOT_YET_REGISTERED = new Set(['unknown_tool', 'tool_unavailable'])

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    only: { type: 'string', multiple: true },
    bundler: { type: 'string', default: 'turbopack' },
    output: { type: 'string' },
    headed: { type: 'boolean', default: false },
    url: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
})

const appName = positionals[0]
if (!appName) {
  process.stderr.write(
    'usage: node evals/realworld/run-probes.mjs <app> [--dry-run] [--only <id>]... [--bundler <name>] [--url <running dev server>] [--output <file>]\n',
  )
  process.exit(2)
}

const suiteDir = join(ROOT, 'evals/realworld', appName)
/** @type {AppConfig} */
const config = JSON.parse(await readFile(join(suiteDir, 'app.json'), 'utf8'))
const appDir = join(ROOT, config.appDir)

/**
 * @param {string} directory
 * @returns {Promise<Entry[]>}
 */
async function loadEntries(directory) {
  if (!existsSync(directory)) return []
  const names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort()
  return Promise.all(
    names.map(async (name) => {
      const path = join(directory, name)
      return { ...JSON.parse(await readFile(path, 'utf8')), path }
    }),
  )
}

/**
 * Rejects an answer-key entry whose shape the runner cannot execute.
 * @param {Entry} entry
 */
function assertWellFormed(entry) {
  const where = relative(ROOT, entry.path)
  if (typeof entry.id !== 'string' || !where.endsWith(`${entry.id}.json`)) {
    throw new Error(`${where}: id must match the file name`)
  }
  if (entry.kind !== 'bug' && entry.kind !== 'decoy') throw new Error(`${where}: unknown kind`)
  if (entry.kind === 'bug' && !entry.referenceFix?.length) {
    throw new Error(`${where}: a bug needs referenceFix edits`)
  }
  if (entry.probe.status === 'blocked' && !entry.probe.missingEvidence) {
    throw new Error(`${where}: a blocked probe must name the missing evidence`)
  }
}

/**
 * Fails fast when a reference fix no longer matches the shipped source exactly once.
 * @param {Entry} entry
 */
async function assertFixApplies(entry) {
  for (const edit of entry.referenceFix ?? []) {
    const source = await readFile(join(appDir, edit.file), 'utf8')
    const matches = source.split(edit.find).length - 1
    if (matches !== 1) {
      throw new Error(`${entry.id}: referenceFix find matches ${matches} times in ${edit.file}`)
    }
  }
}

/**
 * Applies the edits in place and returns a function that restores every touched file.
 * @param {Entry} entry
 */
async function applyFix(entry) {
  /** @type {Map<string, string>} */
  const originals = new Map()
  const restore = async () => {
    await Promise.all([...originals].map(([path, text]) => writeFile(path, text)))
  }
  track(`fix:${entry.id}`, restore)
  for (const edit of entry.referenceFix ?? []) {
    const path = join(appDir, edit.file)
    const source = await readFile(path, 'utf8')
    if (!originals.has(path)) originals.set(path, source)
    await writeFile(path, source.replace(edit.find, edit.replace))
  }
  return restore
}

/**
 * @param {string} baseUrl
 * @param {() => boolean} isAlive
 * @param {() => string} describe
 */
async function warmUp(baseUrl, isAlive, describe) {
  await delay(RECOMPILE_SETTLE_MS)
  for (const path of config.warmup) {
    await waitForHttp(new URL(path, baseUrl).toString(), {
      timeoutMs: SERVER_READY_TIMEOUT_MS,
      isAlive,
      describe,
    })
  }
}

/**
 * @param {{ baseUrl: string, runtimeDir: string, browser: import('playwright').Browser, session: string, options: { locale?: string, timezoneId?: string } }} setup
 */
function createProbeContext({ baseUrl, runtimeDir, browser, session, options }) {
  /** @type {Check[]} */
  const checks = []
  /** @type {import('playwright').BrowserContext | null} */
  let context = null
  /** @type {import('playwright').Page | null} */
  let page = null

  /**
   * @param {string[]} args
   * @returns {Promise<{ code: number | null, parsed: any, stdout: string }>}
   */
  const invoke = async (args) => {
    const result = await run(process.execPath, [CLI, ...args, '--session', session, '--json'], {
      cwd: appDir,
      env: runtimeDir ? { ...process.env, XDG_RUNTIME_DIR: runtimeDir } : process.env,
      timeoutMs: CLI_TIMEOUT_MS,
    })
    try {
      return { code: result.code, parsed: JSON.parse(result.stdout), stdout: result.stdout }
    } catch {
      throw new Error(
        `genie-react ${args.join(' ')} returned non-JSON: ${result.stdout}${result.stderr}`,
      )
    }
  }

  /**
   * Runs the CLI and returns its parsed JSON; app tools register after the page loads, so their calls retry until registered.
   * @param {string[]} args
   * @returns {Promise<any>}
   */
  const cli = async (args) => {
    const retryUntil = args[1]?.startsWith('app_')
      ? Date.now() + APP_TOOL_REGISTRATION_TIMEOUT_MS
      : 0
    for (;;) {
      const { code, parsed, stdout } = await invoke(args)
      if (code === 0 && parsed?.status !== 'error') return parsed
      if (!NOT_YET_REGISTERED.has(parsed?.reason) || Date.now() > retryUntil) {
        throw new Error(`genie-react ${args.join(' ')} failed: ${stdout.slice(0, 2_000)}`)
      }
      await delay(250)
    }
  }

  const ensurePage = async () => {
    if (page) return page
    context = await browser.newContext({
      locale: options.locale ?? 'en-US',
      timezoneId: options.timezoneId ?? 'UTC',
      viewport: { width: 1280, height: 900 },
    })
    page = await context.newPage()
    return page
  }

  return {
    checks,
    session,
    /** @returns {import('playwright').Page} */
    get page() {
      if (!page) throw new Error('Call ctx.open before using ctx.page')
      return page
    },
    /** @param {string} path */
    url(path) {
      const target = new URL(path, baseUrl)
      target.searchParams.set('_genie', session)
      return target.toString()
    },
    /**
     * Opens a document and waits until its Genie session reports ready.
     * @param {string} path
     */
    async open(path) {
      const current = await ensurePage()
      await current.goto(this.url(path), { waitUntil: 'load' })
      await cli(['status', '--wait', '15000'])
      return current
    },
    /**
     * @param {string} tool
     * @param {Record<string, unknown>} [args]
     */
    call(tool, args = {}) {
      return cli(['call', tool, JSON.stringify(args)])
    },
    /** Waits for React commits to go quiet; a timeout leaves the capture incomplete, so it throws. */
    async quiesce() {
      const result = await cli(['call', 'react_quiesce', '{"idleMs":400,"timeoutMs":10000}'])
      if (result.outcome !== 'idle') throw new Error(`react_quiesce ended ${result.outcome}`)
      return result
    },
    /**
     * @param {string} name
     * @param {boolean} pass
     * @param {string} detail
     * @param {'genie' | 'control'} [evidence]
     */
    check(name, pass, detail, evidence = 'genie') {
      checks.push({ name, pass, detail, evidence })
    },
    async close() {
      await context?.close()
    },
  }
}

/**
 * @typedef {ReturnType<typeof createProbeContext>} ProbeContext
 */

/**
 * @param {string} modulePath
 * @param {{ baseUrl: string, runtimeDir: string, browser: import('playwright').Browser, label: string }} setup
 * @returns {Promise<ProbeResult>}
 */
async function runProbeModule(modulePath, { baseUrl, runtimeDir, browser, label }) {
  const probeModule = await import(pathToFileURL(join(suiteDir, modulePath)).toString())
  const session = `${label}-${Date.now().toString(36)}`
  const ctx = createProbeContext({
    baseUrl,
    runtimeDir,
    browser,
    session,
    options: probeModule.options ?? {},
  })
  try {
    await probeModule.probe(ctx)
    if (ctx.checks.length === 0)
      return { outcome: 'error', checks: [], error: 'probe made no checks' }
    return {
      outcome: ctx.checks.every((check) => check.pass) ? 'pass' : 'fail',
      checks: ctx.checks,
    }
  } catch (error) {
    return {
      outcome: 'error',
      checks: ctx.checks,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    await ctx.close()
  }
}

/**
 * The probe the runner executes for an entry: its Genie probe, or for a blocked one its control probe, if any.
 * @param {Entry} entry
 * @returns {{ module: string, evidence: 'genie' | 'control' } | null}
 */
function probeToRun(entry) {
  if (entry.probe.status === 'blocked') {
    return entry.probe.control ? { module: entry.probe.control, evidence: 'control' } : null
  }
  if (!entry.probe.module) throw new Error(`${entry.id}: probe.module is required unless blocked`)
  return { module: entry.probe.module, evidence: 'genie' }
}

/**
 * @param {ProbeResult} result
 */
function formatOutcome(result) {
  if (result.outcome === 'pass') return 'pass'
  const failing = result.checks.filter((check) => !check.pass).map((check) => check.detail)
  return `${result.outcome} (${result.error ?? failing.join('; ')})`
}

/**
 * Reuses a dev server the caller already runs; its hub token lives in the caller's runtime dir.
 * @param {string} url
 */
function attachToServer(url) {
  return {
    baseUrl: url,
    runtimeDir: process.env.XDG_RUNTIME_DIR ?? '',
    isAlive: () => true,
    log: () => '',
  }
}

/** The pid that published this app's hub discovery file, when that process is still alive. */
async function liveHubOwner() {
  const discovery = join(appDir, '.genie/bridge.json')
  if (!existsSync(discovery)) return null
  const { pid } = JSON.parse(await readFile(discovery, 'utf8'))
  if (typeof pid !== 'number') return null
  try {
    process.kill(pid, 0)
    return pid
  } catch {
    return null
  }
}

/** Starts the app's dev server on free ports with a private runtime dir for its hub token. */
async function startServer() {
  const owner = await liveHubOwner()
  if (owner !== null) {
    throw new Error(
      `Another dev server (pid ${owner}) owns this app's Genie hub; stop it or pass --url to attach to it.`,
    )
  }
  const bundlerArgs = config.dev.bundlers[flags.bundler]
  if (!bundlerArgs) throw new Error(`Unknown bundler ${flags.bundler}`)
  const runtimeDir = await mkdtemp(join(tmpdir(), 'genie-realworld-'))
  track('runtime-dir', () => rm(runtimeDir, { recursive: true, force: true }))
  const [port, hubPort] = [await freePort(), await freePort()]
  const substitute = (/** @type {string} */ value) =>
    value.replaceAll('{port}', String(port)).replaceAll('{hubPort}', String(hubPort))
  const server = start(
    join(appDir, config.dev.command),
    [...config.dev.args.map(substitute), ...bundlerArgs],
    {
      cwd: appDir,
      env: {
        ...process.env,
        ...Object.fromEntries(
          Object.entries(config.dev.env ?? {}).map(([key, value]) => [key, substitute(value)]),
        ),
        XDG_RUNTIME_DIR: runtimeDir,
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  )
  track('server', () => server.stop())
  return {
    baseUrl: `http://localhost:${port}`,
    runtimeDir,
    isAlive: () => !server.exited(),
    log: server.log,
  }
}

async function main() {
  if (!existsSync(CLI))
    throw new Error('packages/cli/dist/cli.js is missing; run `pnpm build` first')
  const bugs = await loadEntries(join(suiteDir, 'bugs'))
  const decoys = await loadEntries(join(suiteDir, 'decoys'))
  const selected = [...bugs, ...decoys].filter(
    (entry) => !flags.only || flags.only.includes(entry.id),
  )
  for (const entry of selected) {
    assertWellFormed(entry)
    await assertFixApplies(entry)
    const toRun = probeToRun(entry)
    if (toRun) {
      const loaded = await import(pathToFileURL(join(suiteDir, toRun.module)).toString())
      if (typeof loaded.probe !== 'function')
        throw new Error(`${toRun.module} must export probe(ctx)`)
    }
  }
  if (flags['dry-run']) {
    const counts = { bug: 0, decoy: 0 }
    for (const entry of selected) counts[entry.kind] += 1
    process.stdout.write(
      `${appName}: ${counts.bug} bugs and ${counts.decoy} decoys are well formed and their reference fixes apply\n`,
    )
    return true
  }

  const { baseUrl, runtimeDir, isAlive, log } = flags.url
    ? attachToServer(flags.url)
    : await startServer()
  await warmUp(baseUrl, isAlive, log)

  const browser = await chromium.launch({ headless: !flags.headed })
  track('browser', () => browser.close())

  const runnable = selected.flatMap((entry) => {
    const toRun = probeToRun(entry)
    return toRun ? [{ entry, ...toRun }] : []
  })
  const results = []
  for (const { entry, module, evidence } of runnable) {
    const setup = { baseUrl, runtimeDir, browser, label: entry.id }
    const shipped = await runProbeModule(module, setup)
    /** @type {ProbeResult | null} */
    let fixed = null
    if (entry.kind === 'bug') {
      const restore = await applyFix(entry)
      try {
        await warmUp(baseUrl, isAlive, log)
        fixed = await runProbeModule(module, setup)
      } finally {
        await restore()
        await warmUp(baseUrl, isAlive, log)
      }
    }
    const verdict =
      entry.kind === 'decoy'
        ? shipped.outcome === 'pass'
        : shipped.outcome === 'fail' && fixed?.outcome === 'pass'
    results.push({
      id: entry.id,
      kind: entry.kind,
      evidence,
      blocked: entry.probe.status === 'blocked',
      verdict: verdict ? 'ok' : 'unexpected',
      shipped,
      fixed,
    })
    const fixedText = fixed ? ` | fixed: ${formatOutcome(fixed)}` : ''
    process.stdout.write(
      `${(verdict ? 'ok' : 'UNEXPECTED').padEnd(10)} ${entry.kind.padEnd(5)} ${evidence.padEnd(7)} ${entry.id}\n           shipped: ${formatOutcome(shipped)}${fixedText}\n`,
    )
  }

  const blocked = selected
    .filter((entry) => entry.probe.status === 'blocked')
    .map((entry) => entry.id)
  const summary = {
    app: appName,
    bundler: flags.bundler,
    ok: results.filter((result) => result.verdict === 'ok').length,
    unexpected: results.filter((result) => result.verdict !== 'ok').map((result) => result.id),
    blockedGenieProbes: blocked,
    results,
  }
  if (flags.output) {
    await mkdir(dirname(resolve(flags.output)), { recursive: true })
    await writeFile(resolve(flags.output), `${JSON.stringify(summary, null, 2)}\n`)
  }
  process.stdout.write(
    `\n${summary.ok}/${results.length} as expected on ${flags.bundler}; Genie probe blocked for: ${blocked.join(', ') || 'none'}\n`,
  )
  return summary.unexpected.length === 0
}

for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
  process.once(signal, () => {
    releaseAll().finally(() => {
      killAllChildren()
      process.exit(130)
    })
  })
}

try {
  const passed = await main()
  process.exitCode = passed ? 0 : 1
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
} finally {
  await releaseAll()
}
