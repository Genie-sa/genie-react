#!/usr/bin/env node
import { access, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const USAGE =
  'Usage: node evals/realworld/run-probes.mjs <app> [--only <id>]... [--dry-run] [--output <file>]'
const PROBE_TIMEOUT_MS = 120_000
const KINDS = new Set(['bug', 'decoy'])

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    only: { type: 'string', multiple: true },
    'dry-run': { type: 'boolean', default: false },
    output: { type: 'string' },
  },
})
const [appName] = positionals
if (!appName || positionals.length > 1) {
  process.stderr.write(`${USAGE}\n`)
  process.exit(2)
}

const keyDir = fileURLToPath(new URL(`./${appName}/`, import.meta.url))
const entries = []
for (const file of (await readdir(keyDir)).filter((name) => name.endsWith('.json')).sort()) {
  const entry = JSON.parse(await readFile(join(keyDir, file), 'utf8'))
  if (!values.only || values.only.includes(entry.id)) entries.push({ ...entry, file })
}
if (entries.length === 0) {
  process.stderr.write(`No bug or decoy files matched in ${keyDir}\n`)
  process.exit(2)
}
const harness = await import(pathToFileURL(join(keyDir, 'harness.mjs')).href)

async function problemsIn(entry) {
  const problems = []
  if (entry.file !== `${entry.id}.json`) problems.push('file name must match id')
  if (!KINDS.has(entry.kind)) problems.push('kind must be "bug" or "decoy"')
  if (typeof entry.prompt !== 'string' || !entry.prompt) problems.push('prompt is required')
  if (!entry.probe?.script && !entry.probe?.blocked) problems.push('probe needs script or blocked')
  if (entry.probe?.script) {
    await access(join(keyDir, entry.probe.script)).catch(() =>
      problems.push('probe script missing'),
    )
  }
  if (entry.kind === 'bug' && !(entry.referenceFix?.length > 0))
    problems.push('referenceFix is required')
  for (const edit of entry.referenceFix ?? []) {
    const text = await readFile(join(harness.appDir, edit.file), 'utf8').catch(() => null)
    const matches = text === null ? 0 : text.split(edit.find).length - 1
    if (matches !== 1) problems.push(`${edit.file}: edit matches ${matches} times, expected 1`)
  }
  return problems
}

const invalid = []
for (const entry of entries) {
  for (const problem of await problemsIn(entry)) invalid.push(`${entry.file}: ${problem}`)
}
if (invalid.length > 0) {
  process.stderr.write(`${invalid.join('\n')}\n`)
  process.exit(1)
}
if (values['dry-run']) {
  process.stdout.write(`${entries.length} entries valid; every reference fix applies once\n`)
  process.exit(0)
}

function withTimeout(promise, ms, label) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

async function runProbe(app, browser, entry, variant) {
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    const { default: probe } = await import(pathToFileURL(join(keyDir, entry.probe.script)).href)
    await app.resetBackend()
    const session = app.session(page, `${entry.id}-${variant}`)
    const checks = await withTimeout(probe({ app, session, page }), PROBE_TIMEOUT_MS, entry.id)
    return { pass: checks.length > 0 && checks.every((item) => item.pass), checks }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return { pass: false, checks: [{ name: 'probe.error', pass: false, detail }] }
  } finally {
    await context.close()
  }
}

function verdict(entry, shipped, fixed) {
  if (entry.probe.blocked) return 'blocked'
  if (entry.kind === 'decoy') return shipped.pass ? 'ok' : 'flagged'
  if (shipped.pass) return 'not-detected'
  return fixed?.pass ? 'ok' : 'fix-not-verified'
}

const formatChecks = (run) =>
  run.checks.map((item) => `${item.pass ? '✓' : '✗'} ${item.name}: ${item.detail}`).join('\n    ')

const { chromium } = await import('playwright')
const app = await harness.start()
const stopOnSignal = () => {
  void app.stop().finally(() => process.exit(130))
}
process.once('SIGINT', stopOnSignal)
process.once('SIGTERM', stopOnSignal)
const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (const entry of entries) {
    const result = { id: entry.id, kind: entry.kind, category: entry.category }
    if (entry.probe.blocked) {
      result.blocked = entry.probe.blocked
    } else {
      result.shipped = await runProbe(app, browser, entry, 'shipped')
      if (entry.kind === 'bug') {
        await app.applyEdits(entry.referenceFix)
        try {
          result.fixed = await runProbe(app, browser, entry, 'fixed')
        } finally {
          await app.restore()
        }
      }
    }
    result.verdict = verdict(entry, result.shipped, result.fixed)
    results.push(result)
    process.stdout.write(`${result.verdict.padEnd(16)} ${entry.kind.padEnd(5)} ${entry.id}\n`)
    if (result.shipped) process.stdout.write(`  shipped:\n    ${formatChecks(result.shipped)}\n`)
    if (result.fixed) process.stdout.write(`  fixed:\n    ${formatChecks(result.fixed)}\n`)
    if (result.blocked) process.stdout.write(`  blocked: ${result.blocked}\n`)
  }
} finally {
  await browser.close()
  await app.stop()
}

const failed = results.filter((result) => !['ok', 'blocked'].includes(result.verdict))
const blocked = results.filter((result) => result.verdict === 'blocked')
const passed = results.length - failed.length - blocked.length
process.stdout.write(`\n${passed} ok, ${blocked.length} blocked, ${failed.length} failed\n`)
if (values.output) await writeFile(values.output, `${JSON.stringify(results, null, 2)}\n`)
process.exit(failed.length > 0 ? 1 : 0)
