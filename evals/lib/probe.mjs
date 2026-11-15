import { rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { release, track } from './cleanup.mjs'
import { delay, run } from './process.mjs'

/**
 * @typedef {import('./tasks.mjs').Probe} Probe
 * @typedef {import('./grade.mjs').Check} Check
 */

const READY_TIMEOUT_MS = 20_000
const CLI_PATH = 'node_modules/@genie-react/cli/dist/cli.js'

/** Where agent-browser keeps each session's socket and state files, resolved the way agent-browser resolves it. */
export const BROWSER_SOCKET_DIR =
  process.env.AGENT_BROWSER_SOCKET_DIR ||
  (process.env.XDG_RUNTIME_DIR
    ? join(process.env.XDG_RUNTIME_DIR, 'agent-browser')
    : join(homedir(), '.agent-browser'))
export const BROWSER_SESSION_FILES = [
  'sock',
  'pid',
  'config',
  'engine',
  'version',
  'stream',
  'target',
]

/**
 * @param {string} session
 */
function browserEnv(session) {
  return { ...process.env, AGENT_BROWSER_SESSION: session, GENIE_SESSION: session }
}

/**
 * @param {string} session
 * @param {string[]} args
 */
async function agentBrowser(session, args) {
  const result = await run('agent-browser', args, { env: browserEnv(session), timeoutMs: 60_000 })
  if (result.code !== 0) {
    throw new Error(`agent-browser ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
  }
  return result.stdout
}

/**
 * Opens `url` in a fresh agent-browser session that interrupts and `closeBrowserSession` close, removing the state
 * files `close` leaves behind.
 * @param {string} session
 * @param {string} url
 */
export async function openBrowserSession(session, url) {
  track(`browser:${session}`, async () => {
    await run('agent-browser', ['close'], {
      env: browserEnv(session),
      timeoutMs: 30_000,
      cleanup: true,
    })
    await Promise.all(
      BROWSER_SESSION_FILES.map((suffix) =>
        rm(join(BROWSER_SOCKET_DIR, `${session}.${suffix}`), { force: true }),
      ),
    )
  })
  await agentBrowser(session, ['open', url])
}

/**
 * @param {string} session
 */
export async function closeBrowserSession(session) {
  await release(`browser:${session}`)
}

/**
 * @typedef {{ dir: string, runtimeDir: string }} App the trial root and the runtime dir its hub keeps its token in
 */

/**
 * Runs the CLI with `--json` and returns its exit code with the parsed document, since `verify` reports its verdict as the exit code.
 * @param {App} app
 * @param {string} session
 * @param {string[]} args
 * @returns {Promise<{ code: number | null, json: Record<string, any> }>}
 */
async function genieRun(app, session, args) {
  const result = await run(process.execPath, [join(app.dir, CLI_PATH), ...args, '--json'], {
    cwd: app.dir,
    env: { ...browserEnv(session), XDG_RUNTIME_DIR: app.runtimeDir },
    timeoutMs: 120_000,
  })
  try {
    return { code: result.code, json: JSON.parse(result.stdout) }
  } catch {
    throw new Error(
      `genie-react ${args.join(' ')} returned non-JSON: ${result.stdout}${result.stderr}`,
    )
  }
}

/**
 * @param {App} app
 * @param {string} session
 * @param {string[]} args
 * @returns {Promise<Record<string, any>>}
 */
async function genie(app, session, args) {
  return (await genieRun(app, session, args)).json
}

/**
 * The task's expectations as verify claims; a probe with no interaction has nothing for a window to observe, so it gets none.
 * @param {Probe} probe
 * @returns {string[]}
 */
export function probeClaims(probe) {
  if (probe.steps.length === 0) return []
  return [
    ...(probe.renders
      ? [`render ${probe.renders.component} max ${probe.renders.maxUpdates} counting updates`]
      : []),
    ...(probe.noCaughtErrors ? ['boundaries clean'] : []),
  ]
}

/**
 * Drives the steps inside a verify window and grades on its exit code, so a skipped target, a remount or a late render cannot pass.
 * @param {App} app
 * @param {string} session
 * @param {Probe} probe
 * @returns {Promise<Check | null>}
 */
async function verifyProbe(app, session, probe) {
  const claims = probeClaims(probe)
  if (claims.length === 0) return null
  const began = await genieRun(app, session, [
    'verify',
    'begin',
    '--name',
    'eval probe',
    ...claims.flatMap((claim) => ['--claim', claim]),
  ])
  if (began.json.state !== 'recording') {
    return { name: 'probe.verify', pass: false, detail: verdictDetail(began.json) }
  }
  for (const step of probe.steps) await agentBrowser(session, step)
  const ended = await genieRun(app, session, ['verify', 'end', began.json.verificationId])
  return {
    name: 'probe.verify',
    pass: ended.code === 0 && ended.json.verdict === 'pass',
    detail: `exit ${ended.code}; ${verdictDetail(ended.json)}`,
  }
}

/**
 * @param {Record<string, any>} document
 */
function verdictDetail(document) {
  const claims = Array.isArray(document.claims) ? document.claims : []
  return `${document.verdict ?? document.reason}: ${claims
    .map(
      (/** @type {Record<string, any>} */ claim) =>
        `${claim.text} ${claim.verdict}${claim.refusal ? ` (${claim.refusal.reason})` : ''}`,
    )
    .join(', ')}`
}

/**
 * @param {unknown} value
 */
function count(value) {
  return typeof value === 'number' ? value : 0
}

/**
 * @param {App} app
 * @param {string} session
 */
async function waitForGenieSession(app, session) {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    const status = await genie(app, session, ['status', '--sessions-only'])
    if (status.ready === true) return
    await delay(250)
  }
  throw new Error(`Genie session ${session} did not become ready`)
}

/**
 * Re-runs the user's interaction against the app and asserts the fixed behaviour with Genie evidence.
 * @param {App & { url: string, screen: string, probe: Probe, session: string }} options
 * @returns {Promise<{ pass: boolean, checks: Check[] }>}
 */
export async function runProbe({ dir, runtimeDir, url, screen, probe, session }) {
  const app = { dir, runtimeDir }
  /** @type {Check[]} */
  const checks = []
  const target = new URL(url)
  target.searchParams.set('screen', screen)
  target.searchParams.set('_genie', session)
  try {
    await openBrowserSession(session, target.toString())
    await waitForGenieSession(app, session)
    const verified = await verifyProbe(app, session, probe)
    if (verified) checks.push(verified)
    if (probe.renders) {
      await genie(app, session, [
        'call',
        'react_clear_renders',
        JSON.stringify({ components: [probe.renders.component] }),
      ])
    }
    for (const step of probe.steps) await agentBrowser(session, step)
    await delay(probe.settleMs ?? 500)

    if (probe.renders) {
      const { component, maxUpdates } = probe.renders
      await genie(app, session, ['call', 'react_quiesce', '{"idleMs":500,"timeoutMs":10000}'])
      const renders = await genie(app, session, [
        'call',
        'react_get_renders',
        JSON.stringify({ component, limit: 50, appOnly: false }),
      ])
      const components = Array.isArray(renders.components) ? renders.components : []
      const updates = components
        .filter((entry) => entry?.name === component)
        .reduce((sum, entry) => sum + (typeof entry.updates === 'number' ? entry.updates : 0), 0)
      const exact = renders.coverage?.complete === true && renders.summary?.semantics === 'exact'
      checks.push({
        name: 'probe.renders',
        pass: renders.tracking === true && exact && updates <= maxUpdates,
        detail: `${component} updates=${updates}, max=${maxUpdates}, coverage ${exact ? 'exact' : 'incomplete'}`,
      })
      const cohort = await genie(app, session, [
        'call',
        'react_component_cohort',
        JSON.stringify({ component }),
      ])
      const mounted = count(cohort.mountedIdle) + count(cohort.mountedUpdated)
      checks.push({
        name: 'probe.mounted',
        pass: mounted > 0 && count(cohort.unmounted) === 0,
        detail: `${component} status=${cohort.status}, mounted=${mounted}, unmounted=${count(cohort.unmounted)}`,
      })
    }
    if (probe.noCaughtErrors) {
      const state = await genie(app, session, ['call', 'react_error_state', '{}'])
      const caught = Array.isArray(state.caughtErrors) ? state.caughtErrors.length : -1
      checks.push({
        name: 'probe.noCaughtErrors',
        pass: caught === 0,
        detail: caught === -1 ? `unexpected result: ${JSON.stringify(state)}` : `caught=${caught}`,
      })
    }
    if (probe.text) {
      const { selector, includes } = probe.text
      const text = await agentBrowser(session, ['get', 'text', selector])
      checks.push({
        name: 'probe.text',
        pass: text.includes(includes),
        detail: `"${selector}" ${text.includes(includes) ? 'contains' : 'lacks'} "${includes}"`,
      })
    }
  } catch (error) {
    checks.push({
      name: 'probe.error',
      pass: false,
      detail: error instanceof Error ? error.message : String(error),
    })
  } finally {
    await closeBrowserSession(session)
  }
  return { pass: checks.length > 0 && checks.every((check) => check.pass), checks }
}
