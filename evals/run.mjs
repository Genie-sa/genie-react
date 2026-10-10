#!/usr/bin/env node
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { AGENTS, agentCommand, buildPrompt } from './lib/agents.mjs'
import { extractAnswer, gradeAnswer } from './lib/grade.mjs'
import { closeBrowserSession, runProbe } from './lib/probe.mjs'
import { killAllChildren, run } from './lib/process.mjs'
import { renderMarkdown, summarizeTasks } from './lib/report.mjs'
import { checkTaskAgainstFixture, loadTasks, selectTasks } from './lib/tasks.mjs'
import { commandMetrics, parseTranscript } from './lib/transcript.mjs'
import {
  applyEdits,
  assertFixtureInstalled,
  copyFixture,
  FIXTURE_ROOT,
  prepareConsumer,
  prepareTrialWorkspace,
  REPO_ROOT,
  removeWorkspace,
  startDevServer,
  typecheck,
  workspaceDiff,
} from './lib/workspace.mjs'

/** @typedef {import('./lib/tasks.mjs').Task} Task */
/** @typedef {import('./lib/grade.mjs').Check} Check */
/** @typedef {import('./lib/agents.mjs').AgentName} AgentName */
/** @typedef {import('./lib/workspace.mjs').Consumer} Consumer */

const USAGE = `Usage: node evals/run.mjs [options]

Runs Genie runtime-debugging tasks against a real coding agent and grades the outcome.

Options:
  --task <id>             Run only this task (repeatable)
  --split <name>          dev | held-out | all (default: dev, or all with --dry-run)
  --trials <n>            Trials per task (default: 3)
  --agent <name>          claude | codex (default: claude)
  --model <name>          Agent model (default: sonnet for claude, codex default otherwise)
  --max-turns <n>         Claude turn cap per trial (default: 40)
  --max-budget-usd <n>    Claude spend cap per trial (default: 2)
  --timeout-ms <n>        Wall-clock cap per trial (default: 900000)
  --dry-run               Validate tasks, graders, and reference fixes without a model
  --runtime               With --dry-run, also run each probe against buggy and fixed apps
  --skip-build            Reuse existing package builds
  --keep                  Keep trial workspaces for inspection
  -h, --help              Show this help

Results: evals/results/<run-id>.json, <run-id>.md, and transcripts in <run-id>/.`

const TASKS_DIR = join(REPO_ROOT, 'evals/tasks')
/** @type {Set<string>} */
const activeBrowserSessions = new Set()
const RESULTS_DIR = join(REPO_ROOT, 'evals/results')

/**
 * @param {string} name
 * @param {string} value
 */
function positiveInteger(name, value) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1)
    throw new Error(`--${name} must be a positive integer`)
  return number
}

function parseOptions() {
  const { values } = parseArgs({
    options: {
      task: { type: 'string', multiple: true, default: [] },
      split: { type: 'string' },
      trials: { type: 'string', default: '3' },
      agent: { type: 'string', default: 'claude' },
      model: { type: 'string' },
      'max-turns': { type: 'string', default: '40' },
      'max-budget-usd': { type: 'string', default: '2' },
      'timeout-ms': { type: 'string', default: '900000' },
      'dry-run': { type: 'boolean', default: false },
      runtime: { type: 'boolean', default: false },
      'skip-build': { type: 'boolean', default: false },
      keep: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
    allowPositionals: false,
  })
  const split = values.split ?? (values['dry-run'] ? 'all' : 'dev')
  if (split !== 'dev' && split !== 'held-out' && split !== 'all') {
    throw new Error('--split must be dev, held-out, or all')
  }
  const agent = /** @type {AgentName} */ (values.agent)
  if (!AGENTS.includes(agent)) throw new Error(`--agent must be one of ${AGENTS.join(', ')}`)
  const maxBudgetUsd = Number(values['max-budget-usd'])
  if (!(maxBudgetUsd > 0)) throw new Error('--max-budget-usd must be a positive number')
  if (values.runtime && !values['dry-run']) throw new Error('--runtime requires --dry-run')
  return {
    help: values.help,
    ids: values.task.flatMap((id) => id.split(',')).filter(Boolean),
    split: /** @type {'dev' | 'held-out' | 'all'} */ (split),
    trials: positiveInteger('trials', values.trials),
    agent,
    model: values.model ?? (agent === 'claude' ? 'sonnet' : undefined),
    maxTurns: positiveInteger('max-turns', values['max-turns']),
    maxBudgetUsd,
    timeoutMs: positiveInteger('timeout-ms', values['timeout-ms']),
    dryRun: values['dry-run'],
    runtime: values.runtime,
    skipBuild: values['skip-build'],
    keep: values.keep,
  }
}

/** @typedef {ReturnType<typeof parseOptions>} Options */

/**
 * @param {string} message
 */
function log(message) {
  process.stderr.write(`${message}\n`)
}

/**
 * @param {string} command
 * @param {string[]} args
 */
async function requireCommand(command, args) {
  const result = await run(command, args, { timeoutMs: 30_000 })
  if (result.code !== 0) throw new Error(`\`${command}\` is not installed or not on PATH`)
}

/**
 * @param {Options} options
 * @returns {Promise<Consumer>}
 */
async function installConsumer(options) {
  if (!options.skipBuild) {
    log('building packages…')
    const result = await run('pnpm', ['build'], { cwd: REPO_ROOT, timeoutMs: 600_000 })
    if (result.code !== 0) throw new Error(`pnpm build failed:\n${result.stdout}${result.stderr}`)
  }
  log('installing packed genie-react into a consumer project…')
  return prepareConsumer()
}

/**
 * @param {Task[]} tasks
 * @param {Options} options
 */
async function dryRun(tasks, options) {
  /** @type {string[]} */
  const problems = []
  for (const task of tasks) problems.push(...(await checkTaskAgainstFixture(task, FIXTURE_ROOT)))

  const fixed = await copyFixture('dry-run', null)
  try {
    const baseline = await typecheck(fixed)
    if (!baseline.pass) problems.push(`fixture does not typecheck:\n${baseline.output}`)
    const editSets = new Map(tasks.map((task) => [JSON.stringify(task.referenceFix), task]))
    for (const task of editSets.values()) {
      await applyEdits(fixed, task.referenceFix).catch((/** @type {Error} */ error) =>
        problems.push(`${task.id}: reference fix does not apply: ${error.message}`),
      )
    }
    const afterFixes = await typecheck(fixed)
    if (!afterFixes.pass) problems.push(`reference fixes do not typecheck:\n${afterFixes.output}`)
  } finally {
    await removeWorkspace(fixed)
  }

  const probed = tasks.filter((task) => task.probe)
  if (options.runtime && probed.length > 0) {
    await requireCommand('agent-browser', ['--version'])
    const consumer = await installConsumer(options)
    try {
      for (const task of probed) problems.push(...(await validateProbe(task, consumer)))
    } finally {
      await removeWorkspace(consumer.root)
    }
  }

  for (const task of tasks) log(`  ${task.id} (${task.split}, ${task.mode})`)
  if (problems.length > 0) {
    for (const problem of problems) log(`✗ ${problem}`)
    throw new Error(`dry run found ${problems.length} problem(s)`)
  }
  log(`✓ ${tasks.length} task(s) valid${options.runtime ? ', probes verified' : ''}`)
}

/**
 * Proves a probe fails on the seeded bug and passes once the reference fix is applied.
 * @param {Task} task
 * @param {Consumer} consumer
 * @returns {Promise<string[]>}
 */
async function validateProbe(task, consumer) {
  const { probe } = task
  if (!probe) return []
  /** @type {string[]} */
  const problems = []
  for (const variant of /** @type {const} */ (['buggy', 'fixed'])) {
    const dir = await copyFixture(`probe-${variant}`, consumer)
    if (variant === 'fixed') await applyEdits(dir, task.referenceFix)
    const server = await startDevServer(dir)
    try {
      const result = await runProbe({
        dir,
        url: server.url,
        screen: task.screen,
        probe,
        session: `genie-eval-probe-${process.pid}-${variant}`,
      })
      const expected = variant === 'fixed'
      const details = result.checks.map((check) => `${check.name}: ${check.detail}`).join('; ')
      log(`  ${task.id} probe on ${variant} app: ${result.pass ? 'pass' : 'fail'} (${details})`)
      if (result.pass !== expected) {
        problems.push(
          `${task.id}: probe should ${expected ? 'pass' : 'fail'} on the ${variant} app: ${JSON.stringify(result.checks)}`,
        )
      }
    } finally {
      await server.stop()
      await removeWorkspace(dir)
    }
  }
  return problems
}

/**
 * @param {Task} task
 * @param {number} trial
 * @param {Options} options
 * @param {{ runId: string, transcriptDir: string, consumer: Consumer }} context
 */
async function runTrial(task, trial, options, { runId, transcriptDir, consumer }) {
  const label = `${task.id}-${trial}`
  const browserSession = `genie-eval-${runId}-${label}`
  activeBrowserSessions.add(browserSession)
  const workspace = await prepareTrialWorkspace({ label, agent: options.agent, consumer })
  const transcriptPath = join(transcriptDir, `${label}.jsonl`)
  /** @type {Awaited<ReturnType<typeof startDevServer>> | undefined} */
  let server

  try {
    server = await startDevServer(workspace.dir)
    const url = `${server.url}?screen=${task.screen}`
    log(`▶ ${label} in ${workspace.dir} (${url})`)
    const command = agentCommand({
      agent: options.agent,
      mode: task.mode,
      dir: workspace.dir,
      model: options.model,
      maxTurns: options.maxTurns,
      maxBudgetUsd: options.maxBudgetUsd,
      browserSession,
      hiddenPaths: ['tasks', 'lib', 'results'].map((path) => join(REPO_ROOT, 'evals', path)),
    })
    const transcriptFile = createWriteStream(transcriptPath)
    const result = await run(command.command, command.args, {
      cwd: workspace.dir,
      env: command.env,
      input: buildPrompt(task, url),
      timeoutMs: options.timeoutMs,
      onStdout: (chunk) => transcriptFile.write(chunk),
    })
    await new Promise((resolve) => transcriptFile.end(resolve))
    await closeBrowserSession(browserSession)

    const transcript = parseTranscript(options.agent, await readFile(transcriptPath, 'utf8'))
    const metrics = commandMetrics(transcript.commands)
    const grade = gradeAnswer(extractAnswer(transcript.finalText), task.truth, {
      projectRoot: workspace.dir,
    })
    const diff = await workspaceDiff(workspace.dir)
    /** @type {Check[]} */
    const checks = [...grade.checks]
    if (task.mode === 'diagnose') {
      checks.push({
        name: 'no-edits',
        pass: diff.files.length === 0,
        detail: diff.files.length === 0 ? 'no files changed' : `changed ${diff.files.join(', ')}`,
      })
    } else {
      const types = await typecheck(workspace.dir)
      checks.push({ name: 'typecheck', pass: types.pass, detail: types.output.slice(0, 2000) })
      if (task.probe) {
        const probe = await runProbe({
          dir: workspace.dir,
          url: server.url,
          screen: task.screen,
          probe: task.probe,
          session: `${browserSession}-probe`,
        })
        checks.push(...probe.checks)
      }
    }
    const failure =
      transcript.failure ??
      (result.timedOut ? 'timeout' : result.code !== 0 ? `exit ${result.code}` : null)
    const pass = failure === null && checks.every((check) => check.pass)
    const record = {
      task: task.id,
      split: task.split,
      mode: task.mode,
      trial,
      pass,
      failure,
      checks,
      answer: grade.answer,
      agent: options.agent,
      model: transcript.model ?? options.model ?? null,
      skillInstalled: workspace.skillInstalled,
      skillDiscovered: transcript.skills === null ? null : transcript.skills.includes('genie'),
      initStatus: workspace.initReceipt?.status ?? null,
      genieCalls: metrics.genieCalls,
      browserCalls: metrics.browserCalls,
      otherCommands: metrics.otherCommands,
      failedCommands: metrics.failedCommands,
      deniedCommands: metrics.deniedCommands,
      runtimeEvidence: metrics.genieEvidenceCommands > 0,
      genieInvocations: metrics.genieInvocations,
      browserSubcommands: metrics.browserSubcommands,
      genieErrorReasons: metrics.genieErrorReasons,
      toolUses: transcript.toolUses,
      permissionDenials: transcript.permissionDenials,
      tokens: transcript.usage.total,
      usage: transcript.usage,
      costUsd: transcript.costUsd,
      turns: transcript.turns,
      wallMs: result.durationMs,
      changedFiles: diff.files,
      patch: diff.patch,
      stderr: result.stderr.slice(-4000),
      transcriptPath,
      workspace: options.keep ? workspace.dir : null,
    }
    log(
      `${pass ? '✓' : '✗'} ${label}: genie=${metrics.genieCalls} browser=${metrics.browserCalls} denied=${metrics.deniedCommands} tokens=${transcript.usage.total} ${(result.durationMs / 1000).toFixed(0)}s${failure ? ` (${failure})` : ''}`,
    )
    return record
  } finally {
    await closeBrowserSession(browserSession)
    activeBrowserSessions.delete(browserSession)
    await server?.stop()
    if (!options.keep) await removeWorkspace(workspace.dir)
  }
}

/**
 * @param {Task[]} tasks
 * @param {Options} options
 */
async function liveRun(tasks, options) {
  await requireCommand('agent-browser', ['--version'])
  await requireCommand(options.agent, ['--version'])
  const consumer = await installConsumer(options)

  const runId = new Date().toISOString().replace(/[:.]/g, '-')
  const transcriptDir = join(RESULTS_DIR, runId)
  await mkdir(transcriptDir, { recursive: true })

  const trials = []
  try {
    for (const task of tasks) {
      for (let trial = 1; trial <= options.trials; trial += 1) {
        trials.push(await runTrial(task, trial, options, { runId, transcriptDir, consumer }))
      }
    }
  } finally {
    await removeWorkspace(consumer.root)
  }

  const summary = summarizeTasks(trials)
  const runInfo = {
    id: runId,
    agent: options.agent,
    model: options.model ?? null,
    trialsPerTask: options.trials,
  }
  const markdown = renderMarkdown(runInfo, summary)
  const resultPath = join(RESULTS_DIR, `${runId}.json`)
  await writeFile(
    resultPath,
    `${JSON.stringify({ ...runInfo, options, tasks: summary, trials }, null, 2)}\n`,
  )
  await writeFile(join(RESULTS_DIR, `${runId}.md`), markdown)
  process.stdout.write(markdown)
  log(`results: ${resultPath}`)
  return trials.every((trial) => trial.pass)
}

async function main() {
  const options = parseOptions()
  if (options.help) {
    process.stdout.write(`${USAGE}\n`)
    return
  }
  assertFixtureInstalled()
  const { tasks: allTasks, problems } = await loadTasks(TASKS_DIR)
  if (problems.length > 0) throw new Error(`invalid task files:\n${problems.join('\n')}`)
  const tasks = selectTasks(allTasks, { ids: options.ids, split: options.split })
  if (tasks.length === 0) throw new Error('no tasks selected')

  if (options.dryRun) {
    await dryRun(tasks, options)
    return
  }
  if (!(await liveRun(tasks, options))) process.exitCode = 1
}

for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
  process.once(signal, async () => {
    killAllChildren()
    await Promise.allSettled([...activeBrowserSessions].map(closeBrowserSession))
    process.exit(130)
  })
}

main().catch((error) => {
  killAllChildren()
  log(`✗ ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
