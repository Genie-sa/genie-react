#!/usr/bin/env node
import { createWriteStream, existsSync, constants as fsConstants, realpathSync } from 'node:fs'
import { access, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir, constants as osConstants, tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import {
  AGENTS,
  agentCommand,
  agentStateDirs,
  buildPrompt,
  claudeSandboxSettings,
  isolationLabel,
  outsideRoots,
} from './lib/agents.mjs'
import { interrupted, releaseAll } from './lib/cleanup.mjs'
import { extractAnswer, gradeAnswer } from './lib/grade.mjs'
import { closeBrowserSession, openBrowserSession, runProbe } from './lib/probe.mjs'
import { killAllChildren, run } from './lib/process.mjs'
import { renderMarkdown, summarizeTasks } from './lib/report.mjs'
import {
  AGENT_TEMP_MARKER,
  evaluateSandboxProbe,
  SIBLING_MARKER,
  sandboxProbes,
  sandboxPrompt,
} from './lib/sandbox-check.mjs'
import { checkTaskAgainstFixture, loadTasks, selectTasks } from './lib/tasks.mjs'
import { commandMetrics, parseTranscript } from './lib/transcript.mjs'
import { appendTrial, isolateTrial, readTrials } from './lib/trials.mjs'
import {
  applyEdits,
  assertFixtureInstalled,
  copyFixture,
  FIXTURE_ROOT,
  prepareConsumer,
  prepareTrialWorkspace,
  REPO_ROOT,
  removeWorkspace,
  repositoryRoots,
  startDevServer,
  temporaryDirectory,
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
  --sandbox-check         Run fixed commands through Claude in a trial and assert what it can read,
                          write, and run
  --skip-build            Reuse existing package builds
  --keep                  Keep trial workspaces for inspection
  -h, --help              Show this help

Results: evals/results/<run-id>.jsonl (one trial per line, written as trials finish), <run-id>.json,
<run-id>.md, and transcripts in <run-id>/.`

const TASKS_DIR = join(REPO_ROOT, 'evals/tasks')
const RESULTS_DIR = join(REPO_ROOT, 'evals/results')
const BROWSER_SOCKET_DIR = join(homedir(), '.agent-browser')
const OPTIONAL_TOOLS = ['pnpm', 'jq']
const TEMP_ROOT = realpathSync(tmpdir())
const CLAUDE_SANDBOX_TEMP = process.env.CLAUDE_TMPDIR ?? `/tmp/claude-${process.getuid?.() ?? 0}`

/**
 * Claude captures each sandboxed command's output under its temp directory in a folder named after the working
 * directory; the trial may read only that folder, not the rest of Claude's temp files.
 * @param {string} dir
 */
function claudeTrialTemp(dir) {
  const folder = dir.replace(/[^a-zA-Z0-9]/g, '-')
  return withRealpaths([CLAUDE_SANDBOX_TEMP]).map((base) => join(base, folder))
}

/**
 * Lists each path and, when it exists and differs, its real path, since the sandbox may match either form
 * (`/tmp` and `/private/tmp` on macOS).
 * @param {string[]} paths
 */
function withRealpaths(paths) {
  const forms = paths.flatMap((path) => {
    try {
      return [path, realpathSync(path)]
    } catch {
      return [path]
    }
  })
  return [...new Set(forms)]
}

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
      'sandbox-check': { type: 'boolean', default: false },
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
  if (values['sandbox-check'] && agent !== 'claude') {
    throw new Error('--sandbox-check only applies to --agent claude')
  }
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
    sandboxCheck: values['sandbox-check'],
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
 * Finds `name` on the harness PATH outside `excludedRoots`; agents get a minimal PATH, so tools are passed by location.
 * @param {string} name
 * @param {string[]} [excludedRoots]
 * @returns {Promise<string | null>}
 */
async function findExecutable(name, excludedRoots = []) {
  const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean)
  for (const dir of outsideRoots(dirs, excludedRoots)) {
    const path = join(dir, name)
    const executable = await access(path, fsConstants.X_OK).then(
      () => true,
      () => false,
    )
    if (executable) return path
  }
  return null
}

/**
 * @param {string} name
 * @param {string[]} [excludedRoots]
 * @returns {Promise<string>}
 */
async function requireExecutable(name, excludedRoots) {
  const path = await findExecutable(name, excludedRoots)
  if (path === null || (await run(path, ['--version'], { timeoutMs: 30_000 })).code !== 0) {
    throw new Error(`\`${name}\` is not installed or not on PATH`)
  }
  return path
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
    await requireExecutable('agent-browser')
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
 * @typedef {{ executable: string, toolDirs: string[], deniedReadRoots: string[] }} AgentContext
 * @typedef {AgentContext & { runId: string, transcriptDir: string, consumer: Consumer }} RunContext
 * @typedef {Awaited<ReturnType<typeof prepareTrialWorkspace>>} Workspace
 * @typedef {Awaited<ReturnType<typeof startDevServer>>} DevServer
 * @typedef {{
 *   workspace: Workspace,
 *   server: DevServer,
 *   url: string,
 *   browserSession: string,
 *   transcriptPath: string,
 *   command: import('./lib/agents.mjs').AgentCommand,
 * }} Trial
 */

/**
 * Locates the agent and its tools outside the repository and lists the paths it must not read.
 * @param {Options} options
 * @returns {Promise<AgentContext>}
 */
async function agentContext(options) {
  const roots = await repositoryRoots()
  const browser = await requireExecutable('agent-browser', roots)
  const executable = await requireExecutable(options.agent, roots)
  const optionalTools = await Promise.all(OPTIONAL_TOOLS.map((name) => findExecutable(name, roots)))
  const tools = [process.execPath, browser, ...optionalTools.filter((path) => path !== null)]
  return {
    executable,
    toolDirs: outsideRoots(
      tools.map((path) => dirname(path)),
      roots,
    ),
    deniedReadRoots: withRealpaths([
      ...roots,
      ...agentStateDirs(process.env, homedir()),
      CLAUDE_SANDBOX_TEMP,
    ]),
  }
}

/**
 * Prepares a trial workspace, dev server, browser session, and sandboxed agent command, runs `body`, and tears
 * everything down.
 * @template T
 * @param {{ label: string, mode: Task['mode'], screen: string }} spec
 * @param {Options} options
 * @param {RunContext} context
 * @param {(trial: Trial) => Promise<T>} body
 * @returns {Promise<T>}
 */
async function withTrial({ label, mode, screen }, options, context, body) {
  const { runId, transcriptDir, consumer } = context
  const browserSession = `genie-eval-${runId}-${label}`
  /** @type {Workspace | undefined} */
  let workspace
  /** @type {DevServer | undefined} */
  let server
  try {
    workspace = await prepareTrialWorkspace({ label, agent: options.agent, consumer })
    server = await startDevServer(workspace.dir)
    const url = `${server.url}?screen=${screen}`
    log(`▶ ${label} in ${workspace.dir} (${url})`)
    await openBrowserSession(browserSession, url)
    const settingsPath = join(transcriptDir, `${label}.settings.json`)
    const settings = claudeSandboxSettings({
      dir: workspace.dir,
      mode,
      readableRoots: [
        consumer.root,
        ...claudeTrialTemp(workspace.dir),
        ...withRealpaths(context.toolDirs.map((dir) => dirname(dir))),
        BROWSER_SOCKET_DIR,
      ],
      deniedReadRoots: [...context.deniedReadRoots, TEMP_ROOT, ...withRealpaths([homedir()])],
      browserSocketDir: BROWSER_SOCKET_DIR,
    })
    await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`)
    const command = agentCommand({
      agent: options.agent,
      executable: context.executable,
      mode,
      dir: workspace.dir,
      model: options.model,
      maxTurns: options.maxTurns,
      maxBudgetUsd: options.maxBudgetUsd,
      browserSession,
      toolDirs: context.toolDirs,
      settingsPath,
      appOrigin: new URL(server.url).origin,
      readableRoots: [consumer.root],
      deniedReadRoots: context.deniedReadRoots,
    })
    const transcriptPath = join(transcriptDir, `${label}.jsonl`)
    return await body({ workspace, server, url, browserSession, transcriptPath, command })
  } finally {
    await closeBrowserSession(browserSession)
    await server?.stop()
    if (workspace && !options.keep) await removeWorkspace(workspace.dir)
  }
}

/**
 * Runs the agent with `prompt` in the trial, streaming its output to `transcriptPath`.
 * @param {{ dir: string, command: import('./lib/agents.mjs').AgentCommand, prompt: string, transcriptPath: string }} invocation
 * @param {Options} options
 */
async function runAgent({ dir, command, prompt, transcriptPath }, options) {
  const transcriptFile = createWriteStream(transcriptPath)
  const result = await run(command.command, command.args, {
    cwd: dir,
    env: command.env,
    input: prompt,
    timeoutMs: options.timeoutMs,
    onStdout: (chunk) => transcriptFile.write(chunk),
  })
  await new Promise((resolve) => transcriptFile.end(resolve))
  const transcript = parseTranscript(options.agent, await readFile(transcriptPath, 'utf8'))
  return { result, transcript }
}

/**
 * @param {Task} task
 * @param {number} trial
 * @param {Options} options
 * @param {RunContext} context
 */
async function executeTrial(task, trial, options, context) {
  const label = `${task.id}-${trial}`
  const spec = { label, mode: task.mode, screen: task.screen }
  return withTrial(spec, options, context, async (current) => {
    const { workspace, server, url, browserSession, transcriptPath, command } = current
    const prompt = buildPrompt(task, url)
    const { result, transcript } = await runAgent(
      { dir: workspace.dir, command, prompt, transcriptPath },
      options,
    )
    await closeBrowserSession(browserSession)
    const metrics = commandMetrics(transcript.commands)
    const grade = gradeAnswer(extractAnswer(transcript.finalText), task.truth, {
      projectRoot: workspace.dir,
    })
    const diff = await workspaceDiff(workspace.dir)
    /** @type {Check[]} */
    const checks = []
    if (task.mode === 'diagnose') {
      checks.push(...grade.checks, {
        name: 'no-edits',
        pass: diff.files.length === 0,
        detail: diff.files.length === 0 ? 'no files changed' : `changed ${diff.files.join(', ')}`,
      })
    } else {
      const outsideSource = diff.files.filter((file) => !file.startsWith('src/'))
      checks.push({
        name: 'diff-scope',
        pass: diff.files.length > 0 && outsideSource.length === 0,
        detail:
          diff.files.length === 0
            ? 'no files changed'
            : `changed ${diff.files.join(', ')}${outsideSource.length > 0 ? '; only src/ may change' : ''}`,
      })
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
      answerChecks: task.mode === 'fix' ? grade.checks : undefined,
      answer: grade.answer,
      agent: options.agent,
      model: transcript.model ?? options.model ?? null,
      skillInstalled: workspace.skillInstalled,
      skillDiscovered: transcript.skills === null ? null : transcript.skills.includes('genie'),
      initStatus: workspace.initReceipt?.status ?? null,
      genieCalls: metrics.genieCalls,
      genieToolCalls: metrics.genieToolCalls,
      genieSuccessfulToolCalls: metrics.genieSuccessfulToolCalls,
      browserCalls: metrics.browserCalls,
      otherCommands: metrics.otherCommands,
      failedCommands: metrics.failedCommands,
      deniedCommands: metrics.deniedCommands,
      runtimeEvidence: metrics.genieSuccessfulToolCalls > 0,
      deniedBeforeGenie: metrics.deniedBeforeGenieSuccess,
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
      `${pass ? '✓' : '✗'} ${label}: genie=${metrics.genieCalls} tool-calls=${metrics.genieSuccessfulToolCalls}/${metrics.genieToolCalls} browser=${metrics.browserCalls} denied=${metrics.deniedCommands} tokens=${transcript.usage.total} ${(result.durationMs / 1000).toFixed(0)}s${failure ? ` (${failure})` : ''}`,
    )
    return record
  })
}

/**
 * @param {Task[]} tasks
 * @param {Options} options
 */
async function liveRun(tasks, options) {
  const agent = await agentContext(options)
  const consumer = await installConsumer(options)
  const runId = new Date().toISOString().replace(/[:.]/g, '-')
  const transcriptDir = join(RESULTS_DIR, runId)
  const trialsPath = join(RESULTS_DIR, `${runId}.jsonl`)
  await mkdir(transcriptDir, { recursive: true })
  const context = { ...agent, runId, transcriptDir, consumer }

  try {
    for (const task of tasks) {
      for (let trial = 1; trial <= options.trials; trial += 1) {
        const identity = {
          task: task.id,
          split: task.split,
          mode: task.mode,
          trial,
          agent: options.agent,
          model: options.model ?? null,
        }
        const record = await isolateTrial(identity, () =>
          executeTrial(task, trial, options, context),
        )
        if (interrupted()) throw new Error('interrupted')
        if (record.failure?.startsWith('harness:')) log(`✗ ${task.id}-${trial}: ${record.failure}`)
        await appendTrial(trialsPath, record)
      }
    }
  } finally {
    await removeWorkspace(consumer.root)
  }

  const trials = await readTrials(trialsPath)
  const summary = summarizeTasks(trials)
  const runInfo = {
    id: runId,
    agent: options.agent,
    model: options.model ?? null,
    trialsPerTask: options.trials,
    isolation: isolationLabel(options.agent),
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

/**
 * Runs each fixed probe command through Claude in a fresh fix-mode trial built by the same code as real trials, then
 * checks its effect. Blocked probes also run with permission checks bypassed, so the OS sandbox alone must stop them.
 * @param {Task[]} tasks
 * @param {Options} options
 */
async function sandboxCheck(tasks, options) {
  const [task] = tasks
  if (!task) throw new Error('no tasks selected')
  const agent = await agentContext(options)
  const consumer = await installConsumer(options)
  const runId = `sandbox-check-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const transcriptDir = join(RESULTS_DIR, runId)
  await mkdir(transcriptDir, { recursive: true })
  const sibling = await temporaryDirectory('genie-eval-sibling-')
  await writeFile(join(sibling, 'marker.txt'), `${SIBLING_MARKER}\n`)
  const agentTempFile = existsSync(CLAUDE_SANDBOX_TEMP)
    ? join(CLAUDE_SANDBOX_TEMP, `genie-eval-sandbox-check-${process.pid}.txt`)
    : null
  if (agentTempFile) await writeFile(agentTempFile, `${AGENT_TEMP_MARKER}\n`)
  try {
    const context = { ...agent, runId, transcriptDir, consumer }
    const spec = { label: 'sandbox', mode: /** @type {const} */ ('fix'), screen: task.screen }
    const results = await withTrial(spec, options, context, async (trial) => {
      const probes = sandboxProbes({
        trial: trial.workspace.dir,
        consumerModules: consumer.modules,
        repoFile: task.path,
        sibling,
        agentTempFile,
        agentConfigDir: process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'),
        home: homedir(),
        url: trial.url,
      })
      for (const { link } of probes) if (link) await symlink(link.target, link.path)
      const sandboxOnly = trial.command.args.map((arg) =>
        arg === 'dontAsk' ? 'bypassPermissions' : arg,
      )
      const runs = probes.flatMap((probe, index) => [
        { probe, index, layer: 'permissions + sandbox', args: trial.command.args },
        ...(probe.expect === 'blocked'
          ? [{ probe, index, layer: 'sandbox only', args: sandboxOnly }]
          : []),
      ])
      /** @type {import('./lib/sandbox-check.mjs').SandboxResult[]} */
      const results = []
      for (const { probe, index, layer, args } of runs) {
        const read = () => (probe.file ? readFile(probe.file, 'utf8').catch(() => '') : '')
        const before = await read()
        const { transcript } = await runAgent(
          {
            dir: trial.workspace.dir,
            command: { ...trial.command, args },
            prompt: sandboxPrompt(probe),
            transcriptPath: join(
              transcriptDir,
              `probe-${index}-${layer.replace(/\W+/g, '-')}.jsonl`,
            ),
          },
          options,
        )
        const result = evaluateSandboxProbe(probe, {
          layer,
          transcript,
          before,
          after: await read(),
        })
        log(`${result.pass ? '✓' : '✗'} ${result.name} [${layer}]: ${result.detail}`)
        results.push(result)
      }
      return results
    })
    const failed = results.filter((result) => !result.pass)
    if (failed.length > 0) throw new Error(`sandbox check failed ${failed.length} probe run(s)`)
    log(`✓ sandbox check passed (transcripts: ${transcriptDir})`)
  } finally {
    if (agentTempFile) await rm(agentTempFile, { force: true })
    await removeWorkspace(sibling)
    await removeWorkspace(consumer.root)
  }
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
  if (options.sandboxCheck) {
    await sandboxCheck(tasks, options)
    return
  }
  if (!(await liveRun(tasks, options))) process.exitCode = 1
}

for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
  process.once(signal, async () => {
    killAllChildren()
    await releaseAll()
    killAllChildren()
    process.exit(128 + osConstants.signals[signal])
  })
}

main()
  .catch((error) => {
    killAllChildren()
    log(`✗ ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
  .finally(releaseAll)
