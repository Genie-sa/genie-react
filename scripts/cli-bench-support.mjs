// Shared by benchmark-cli.mjs and check-cli-startup.mjs: timed CLI spawns, probe reports, statistics and the per-phase breakdown.
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = fileURLToPath(new URL('..', import.meta.url))
export const defaultCli = join(root, 'packages/cli/dist/cli.js')
const probe = join(root, 'scripts/cli-probe.mjs')

/** The caller's environment without Genie selectors or a compile-cache override, so discovery, session choice and caching come from the fixture and the build. */
export function cleanEnv(extra = {}) {
  const env = { ...process.env, NO_COLOR: '1', ...extra }
  for (const key of Object.keys(env)) {
    const selector = key.startsWith('GENIE_') || key.startsWith('NODE_COMPILE_CACHE')
    if (selector && !(key in extra)) delete env[key]
  }
  return env
}

/** Runs one process to completion; `ms` spans spawn to the close of its stdio, as a caller waiting on it sees. */
export function timed(command, args, { cwd, env, input } = {}) {
  return new Promise((resolve, reject) => {
    const spawnedAt = performance.timeOrigin + performance.now()
    const startedAt = performance.now()
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    })
    const stdout = []
    const stderr = []
    child.stdout.on('data', (chunk) => stdout.push(chunk))
    child.stderr.on('data', (chunk) => stderr.push(chunk))
    if (input !== undefined) child.stdin.end(input)
    child.once('error', reject)
    child.once('close', (code, signal) => {
      resolve({
        ms: performance.now() - startedAt,
        spawnedAt,
        closedAt: performance.timeOrigin + performance.now(),
        code,
        signal,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      })
    })
  })
}

/** Runs the CLI under the probe and returns the timed result with the probe's report attached. */
export async function probed(node, cli, argv, { cwd, env, modules = false, input } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'genie-cli-probe-'))
  const reportFile = join(directory, 'report.json')
  try {
    const run = await timed(node, ['--import', probe, cli, ...argv], {
      cwd,
      input,
      env: {
        ...env,
        GENIE_CLI_PROBE_FILE: reportFile,
        ...(modules ? { GENIE_CLI_PROBE_MODULES: '1' } : {}),
      },
    })
    const report = JSON.parse(await readFile(reportFile, 'utf8'))
    return { ...run, report }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export function percentile(samples, fraction) {
  if (samples.length === 0) return Number.NaN
  const sorted = [...samples].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)]
}

export const median = (samples) => percentile(samples, 0.5)

export const PHASES = [
  'spawn',
  'boot',
  'load',
  'args',
  'discovery',
  'token',
  'connect',
  'greeting',
  'calls',
  'render',
  'exit',
  'teardown',
]

/** Splits one probed run into consecutive phases that sum to its wall time; a phase the command never reached is 0. */
export function breakdown({ spawnedAt, closedAt, report }) {
  const marks = new Map()
  for (const [phase, at] of report.phases) {
    if (phase === 'call:answered') marks.set(phase, at)
    else if (!marks.has(phase)) marks.set(phase, at)
  }
  const at = (phase, fallback) => marks.get(phase) ?? fallback
  const startedAt = report.probeStartedAt
  const cliStart = at('cli:start', startedAt)
  const parsed = at('cli:parsed', cliStart)
  const connectStart = at('connect:start', parsed)
  const tokenStart = at('token:start', connectStart)
  const tokenEnd = at('token:end', tokenStart)
  const resolved = at('connect:resolved', connectStart)
  const open = at('socket:open', resolved)
  const ready = at('hub:ready', open)
  const answered = at('call:answered', ready)
  const lastWrite = Math.max(report.stdout.lastWriteAt ?? answered, answered)
  const exitAt = Math.max(report.exitAt, lastWrite)
  return {
    spawn: report.timeOrigin - spawnedAt,
    boot: startedAt,
    load: cliStart - startedAt + (connectStart - parsed),
    args: parsed - cliStart,
    discovery: resolved - connectStart - (tokenEnd - tokenStart),
    token: tokenEnd - tokenStart,
    connect: open - resolved,
    greeting: ready - open,
    calls: answered - ready,
    render: lastWrite - answered,
    exit: exitAt - lastWrite,
    teardown: closedAt - (report.timeOrigin + exitAt),
  }
}

export function round(value, digits = 1) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : value
}
