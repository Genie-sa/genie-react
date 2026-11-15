#!/usr/bin/env node
import { access, appendFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import demo from './apps-e2e/apps/demo.mjs'
import nextDemo from './apps-e2e/apps/next-demo.mjs'
import plainDemo from './apps-e2e/apps/plain-demo.mjs'
import routerDemo from './apps-e2e/apps/router-demo.mjs'
import viteDemo from './apps-e2e/apps/vite-demo.mjs'
import { CLI_ENTRY } from './apps-e2e/harness.mjs'
import { DefectTracker, formatKnownDefects, markdownSummary } from './apps-e2e/known-defects.mjs'
import { runApp } from './apps-e2e/run-app.mjs'

const APPS = [viteDemo, routerDemo, demo, plainDemo, nextDemo]
const USAGE = `Usage: node scripts/check-apps-e2e.mjs [--app <name>]... [--skip-production]
Apps: ${APPS.map((app) => app.name).join(', ')}
Requires built packages (pnpm build) and Playwright Chromium.`

const { values } = parseArgs({
  options: {
    app: { type: 'string', multiple: true },
    'skip-production': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

if (values.help) {
  process.stdout.write(`${USAGE}\n`)
  process.exit(0)
}

const unknown = (values.app ?? []).filter((name) => !APPS.some((app) => app.name === name))
if (unknown.length > 0) {
  process.stderr.write(`Unknown app(s): ${unknown.join(', ')}\n${USAGE}\n`)
  process.exit(2)
}

await access(CLI_ENTRY).catch(() => {
  process.stderr.write(`Missing ${CLI_ENTRY}; run pnpm build first.\n`)
  process.exit(2)
})

const selected = values.app ? APPS.filter((app) => values.app.includes(app.name)) : APPS
const defects = new DefectTracker()
const log = (line) => process.stdout.write(`${line}\n`)
const results = []
const browser = await chromium.launch({ headless: true })
let interrupted = false

const shutdown = (signal) => {
  if (interrupted) return
  interrupted = true
  log(`received ${signal}; stopping`)
  void browser.close().finally(() => process.exit(130))
}
process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))

try {
  for (const spec of selected) {
    const started = Date.now()
    try {
      await runApp(spec, { browser, defects, log, production: !values['skip-production'] })
      results.push({ app: spec.name, ok: true, ms: Date.now() - started })
    } catch (error) {
      results.push({ app: spec.name, ok: false, ms: Date.now() - started, error })
      log(`✗ ${spec.name}\n${error instanceof Error ? error.message : String(error)}`)
    }
  }
} finally {
  await browser.close().catch(() => {})
}

log('\napps e2e summary')
for (const result of results) {
  log(`  ${result.ok ? '✓' : '✗'} ${result.app} (${(result.ms / 1000).toFixed(1)} s)`)
}
const reproduced = defects.reproduced()
process.stdout.write(formatKnownDefects(reproduced))
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, markdownSummary(results, reproduced))
}
process.exitCode = results.every((result) => result.ok) ? 0 : 1
