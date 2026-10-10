import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'

const MAX_CAPTURE = 4_000_000

/**
 * @typedef {{ code: number | null, signal: NodeJS.Signals | null, stdout: string, stderr: string, timedOut: boolean, durationMs: number }} RunResult
 * @typedef {{ cwd?: string, env?: NodeJS.ProcessEnv, input?: string, timeoutMs?: number, onStdout?: (chunk: string) => void }} RunOptions
 */

/** @type {Set<import('node:child_process').ChildProcess>} */
const liveChildren = new Set()

/**
 * @param {string} current
 * @param {string} chunk
 */
function appendBounded(current, chunk) {
  const combined = current + chunk
  return combined.length <= MAX_CAPTURE ? combined : combined.slice(-MAX_CAPTURE)
}

/**
 * Runs a command to completion in its own process group so a timeout also kills its descendants.
 * @param {string} command
 * @param {string[]} args
 * @param {RunOptions} [options]
 * @returns {Promise<RunResult>}
 */
export async function run(command, args, options = {}) {
  const startedAt = Date.now()
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  liveChildren.add(child)
  let stdout = ''
  let stderr = ''
  let timedOut = false
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    stdout = appendBounded(stdout, chunk)
    options.onStdout?.(chunk)
  })
  child.stderr.on('data', (chunk) => {
    stderr = appendBounded(stderr, chunk)
  })
  child.stdin.on('error', () => {})
  child.stdin.end(options.input ?? '')

  const timer =
    options.timeoutMs === undefined
      ? undefined
      : setTimeout(() => {
          timedOut = true
          killTree(child)
        }, options.timeoutMs)

  /** @type {[number | null, NodeJS.Signals | null]} */
  let exit
  try {
    exit = /** @type {[number | null, NodeJS.Signals | null]} */ (await once(child, 'close'))
  } catch (error) {
    exit = [null, null]
    stderr = appendBounded(stderr, error instanceof Error ? error.message : String(error))
  } finally {
    clearTimeout(timer)
    liveChildren.delete(child)
  }
  return {
    code: exit[0],
    signal: exit[1],
    stdout,
    stderr,
    timedOut,
    durationMs: Date.now() - startedAt,
  }
}

/**
 * Starts a long-lived process (a dev server) that the caller stops with `stop`.
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd: string, env?: NodeJS.ProcessEnv }} options
 */
export function start(command, args, options) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  liveChildren.add(child)
  child.once('close', () => liveChildren.delete(child))
  let log = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    log = appendBounded(log, chunk)
  })
  child.stderr.on('data', (chunk) => {
    log = appendBounded(log, chunk)
  })
  return {
    child,
    log: () => log,
    exited: () => child.exitCode !== null || child.signalCode !== null,
    stop: () => stop(child),
  }
}

/**
 * @param {import('node:child_process').ChildProcess} child
 * @param {NodeJS.Signals} [signal]
 */
function killTree(child, signal = 'SIGTERM') {
  if (child.pid === undefined) return
  try {
    if (process.platform === 'win32') child.kill(signal)
    else process.kill(-child.pid, signal)
  } catch {}
}

/**
 * @param {import('node:child_process').ChildProcess} child
 */
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  const closed = once(child, 'close')
  killTree(child)
  const forced = setTimeout(() => killTree(child, 'SIGKILL'), 5_000)
  await closed
  clearTimeout(forced)
}

export function killAllChildren() {
  for (const child of liveChildren) killTree(child, 'SIGKILL')
}

/** @returns {Promise<number>} */
export async function freePort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  server.close()
  await once(server, 'close')
  if (!address || typeof address === 'string') throw new Error('Could not allocate a local port')
  return address.port
}

/**
 * @param {number} ms
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * @param {string} url
 * @param {{ timeoutMs: number, isAlive: () => boolean, describe: () => string }} options
 */
export async function waitForHttp(url, { timeoutMs, isAlive, describe }) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!isAlive()) throw new Error(`Server exited before ${url} responded\n${describe()}`)
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) })
      if (response.ok) return
    } catch {}
    await delay(150)
  }
  throw new Error(`Timed out waiting for ${url}\n${describe()}`)
}
