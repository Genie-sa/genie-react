import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const CLI_ENTRY = join(ROOT, 'packages/cli/dist/cli.js')

const DEFAULT_CLI_TIMEOUT_MS = 30_000
const MAX_PROCESS_OUTPUT = 2_000_000
const STOP_GRACE_MS = 3_000
const CLI_FAILURE_REASONS = new Set([
  'invalid_input',
  'invalid_args',
  'unknown_tool',
  'tool_unavailable',
  'tool_error',
  'unknown_session',
  'not_connected',
  'bridge_unreachable',
  'busy',
  'timeout',
  'operational_failure',
])
const BRIDGE_ENV = ['GENIE_BRIDGE_URL', 'GENIE_BRIDGE_PORT', 'GENIE_BRIDGE_TOKEN', 'GENIE_SESSION']

export class CheckFailure extends Error {
  constructor(message, details) {
    super(details === undefined ? message : `${message}\n${formatDetails(details)}`)
    this.name = 'CheckFailure'
  }
}

function formatDetails(details) {
  const text = typeof details === 'string' ? details : JSON.stringify(details, null, 2)
  return text.length > 4_000 ? `${text.slice(0, 4_000)}… (${text.length} chars)` : text
}

class ProcessExited extends CheckFailure {}

export function check(condition, message, details) {
  if (!condition) throw new CheckFailure(message, details)
}

export function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
}

export async function waitFor(label, probe, { timeoutMs = 15_000, intervalMs = 150 } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastError
  let lastValue
  while (Date.now() < deadline) {
    try {
      lastValue = await probe()
      if (lastValue) return lastValue
    } catch (error) {
      if (error instanceof ProcessExited) throw error
      lastError = error
    }
    await delay(intervalMs)
  }
  const reason = lastError instanceof Error ? lastError.message : JSON.stringify(lastValue)
  throw new CheckFailure(`Timed out after ${timeoutMs} ms waiting for ${label}`, reason)
}

export async function freePort() {
  const server = createServer()
  await new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  await new Promise((resolveClose) => server.close(resolveClose))
  if (!address || typeof address === 'string') throw new Error('Could not allocate a free port')
  return address.port
}

function appendBounded(current, chunk) {
  const combined = current + chunk.toString()
  return combined.length <= MAX_PROCESS_OUTPUT ? combined : combined.slice(-MAX_PROCESS_OUTPUT)
}

function cleanEnv(extra = {}) {
  const env = { ...process.env, ...extra }
  for (const name of BRIDGE_ENV) delete env[name]
  // The matrix drives Playwright tabs, so the CLI must not scan the developer's agent-browser sessions.
  delete env.AGENT_BROWSER_SESSION
  env.GENIE_AGENT_BROWSER = join(tmpdir(), 'genie-apps-e2e-no-agent-browser')
  return env
}

/** Owns every process the matrix starts, so cleanup stops exactly those process groups and nothing else on the machine. */
export class ProcessGroup {
  #children = new Set()

  start(label, command, args, { cwd, env = {} } = {}) {
    const child = spawn(command, args, {
      cwd,
      detached: process.platform !== 'win32',
      env: cleanEnv(env),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const handle = { label, child, output: '' }
    child.stdout.on('data', (chunk) => {
      handle.output = appendBounded(handle.output, chunk)
    })
    child.stderr.on('data', (chunk) => {
      handle.output = appendBounded(handle.output, chunk)
    })
    this.#children.add(handle)
    child.once('close', () => this.#children.delete(handle))
    return handle
  }

  async stop(handle) {
    const { child } = handle
    if (child.exitCode !== null || child.signalCode !== null) return
    const closed = once(child, 'close')
    signalGroup(child, 'SIGTERM')
    if (await Promise.race([closed.then(() => true), delay(STOP_GRACE_MS).then(() => false)])) {
      return
    }
    signalGroup(child, 'SIGKILL')
    await Promise.race([closed, delay(STOP_GRACE_MS)])
  }

  async stopAll() {
    await Promise.all([...this.#children].map((handle) => this.stop(handle)))
  }
}

function signalGroup(child, signal) {
  try {
    if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal)
    else child.kill(signal)
  } catch {}
}

function assertAlive(handle) {
  const { child } = handle
  if (child.exitCode !== null || child.signalCode !== null) {
    throw new ProcessExited(
      `${handle.label} exited early (${child.exitCode ?? child.signalCode})`,
      handle.output.slice(-4_000),
    )
  }
}

export async function waitForHttp(handle, url, timeoutMs = 60_000) {
  await waitFor(
    `${handle.label} to serve ${url}`,
    async () => {
      assertAlive(handle)
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) })
      return response.status < 500
    },
    { timeoutMs, intervalMs: 250 },
  )
}

export async function waitForOutput(handle, pattern, timeoutMs = 60_000) {
  return waitFor(
    `${handle.label} to print ${pattern}`,
    () => {
      assertAlive(handle)
      return pattern.exec(handle.output)
    },
    { timeoutMs, intervalMs: 100 },
  )
}

export async function runToCompletion(label, command, args, { cwd, env, timeoutMs }) {
  const child = spawn(command, args, { cwd, env: cleanEnv(env), stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', (chunk) => {
    output = appendBounded(output, chunk)
  })
  child.stderr.on('data', (chunk) => {
    output = appendBounded(output, chunk)
  })
  const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
  const [code, signal] = await once(child, 'close')
  clearTimeout(timer)
  if (code !== 0) throw new CheckFailure(`${label} exited ${code ?? signal}`, output.slice(-6_000))
  return output
}

export function isCliFailure(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    value.schemaVersion === '2.0' &&
    value.status === 'error' &&
    CLI_FAILURE_REASONS.has(value.reason) &&
    typeof value.message === 'string' &&
    value.message.length > 0 &&
    typeof value.userActionRequired === 'boolean' &&
    typeof value.errorCode === 'string'
  )
}

/** Drives the built CLI from the app's own directory, so it finds the hub through the discovery file exactly as an agent would. */
export class Cli {
  constructor({ cwd, session }) {
    this.cwd = cwd
    this.session = session
  }

  async run(args, { timeoutMs = DEFAULT_CLI_TIMEOUT_MS, session = this.session } = {}) {
    const argv = [...args, '--json', ...(session ? ['--session', session] : [])]
    const started = Date.now()
    const child = spawn(process.execPath, [CLI_ENTRY, ...argv], {
      cwd: this.cwd,
      env: cleanEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout = appendBounded(stdout, chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr = appendBounded(stderr, chunk)
    })
    let hung = false
    const timer = setTimeout(() => {
      hung = true
      child.kill('SIGKILL')
    }, timeoutMs)
    const [code, signal] = await once(child, 'close')
    clearTimeout(timer)
    const command = `genie-react ${argv.map(shellQuote).join(' ')}`
    if (hung) throw new CheckFailure(`CLI hung for ${timeoutMs} ms: ${command}`, stderr)
    let json
    try {
      json = JSON.parse(stdout)
    } catch {
      throw new CheckFailure(
        `CLI wrote a malformed document (exit ${code ?? signal}): ${command}`,
        { stdout: stdout.slice(0, 2_000), stderr: stderr.slice(0, 2_000) },
      )
    }
    return { code, json, stderr, command, durationMs: Date.now() - started }
  }

  async call(tool, args = {}, options) {
    const result = await this.run(['call', tool, JSON.stringify(args)], options)
    if (result.code !== 0) throw new CheckFailure(`${result.command} failed`, result.json)
    check(
      result.json !== null && typeof result.json === 'object' && !Array.isArray(result.json),
      `${result.command} returned a non-object result`,
      result.json,
    )
    return result.json
  }

  async failure(tool, args = {}, options) {
    const result = await this.run(['call', tool, JSON.stringify(args)], options)
    check(result.code === 1, `${result.command} unexpectedly succeeded`, result.json)
    check(
      isCliFailure(result.json),
      `${result.command} failed without a typed envelope`,
      result.json,
    )
    return result.json
  }

  async status(options) {
    const result = await this.run(['status'], options)
    if (result.code !== 0) throw new CheckFailure(`${result.command} failed`, result.json)
    return result.json
  }
}

function shellQuote(value) {
  return /^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`
}

export async function sourceLine(file, needle) {
  const lines = (await readFile(join(ROOT, file), 'utf8')).split('\n')
  const matches = lines.flatMap((line, index) => (line.includes(needle) ? [index + 1] : []))
  check(matches.length === 1, `${file} must contain ${JSON.stringify(needle)} exactly once`)
  return matches[0]
}
