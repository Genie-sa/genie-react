import { join } from 'node:path'
import { delay, run } from './process.mjs'

/**
 * @typedef {import('./tasks.mjs').Probe} Probe
 * @typedef {import('./grade.mjs').Check} Check
 */

const READY_TIMEOUT_MS = 20_000
const CLI_PATH = 'node_modules/@genie-react/cli/dist/cli.js'

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
export async function agentBrowser(session, args) {
  const result = await run('agent-browser', args, { env: browserEnv(session), timeoutMs: 60_000 })
  if (result.code !== 0) {
    throw new Error(`agent-browser ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
  }
  return result.stdout
}

/**
 * @param {string} session
 */
export async function closeBrowserSession(session) {
  await run('agent-browser', ['close'], { env: browserEnv(session), timeoutMs: 30_000 })
}

/**
 * @param {string} dir
 * @param {string} session
 * @param {string[]} args
 * @returns {Promise<Record<string, any>>}
 */
async function genie(dir, session, args) {
  const result = await run(process.execPath, [join(dir, CLI_PATH), ...args], {
    cwd: dir,
    env: browserEnv(session),
    timeoutMs: 60_000,
  })
  try {
    return JSON.parse(result.stdout)
  } catch {
    throw new Error(
      `genie-react ${args.join(' ')} returned non-JSON: ${result.stdout}${result.stderr}`,
    )
  }
}

/**
 * @param {string} dir
 * @param {string} session
 */
async function waitForGenieSession(dir, session) {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    const status = await genie(dir, session, ['status', '--sessions-only'])
    if (status.ready === true) return
    await delay(250)
  }
  throw new Error(`Genie session ${session} did not become ready`)
}

/**
 * Re-runs the user's interaction against the app and asserts the fixed behaviour with Genie evidence.
 * @param {{ dir: string, url: string, screen: string, probe: Probe, session: string }} options
 * @returns {Promise<{ pass: boolean, checks: Check[] }>}
 */
export async function runProbe({ dir, url, screen, probe, session }) {
  /** @type {Check[]} */
  const checks = []
  const target = new URL(url)
  target.searchParams.set('screen', screen)
  target.searchParams.set('_genie', session)
  try {
    await agentBrowser(session, ['open', target.toString()])
    await waitForGenieSession(dir, session)
    if (probe.renders) {
      await genie(dir, session, [
        'call',
        'react_clear_renders',
        JSON.stringify({ components: [probe.renders.component] }),
      ])
    }
    for (const step of probe.steps) await agentBrowser(session, step)
    await delay(probe.settleMs ?? 500)

    if (probe.renders) {
      const { component, maxUpdates } = probe.renders
      await genie(dir, session, ['call', 'react_quiesce', '{"idleMs":500,"timeoutMs":10000}'])
      const renders = await genie(dir, session, [
        'call',
        'react_get_renders',
        JSON.stringify({ component, limit: 50 }),
      ])
      const components = Array.isArray(renders.components) ? renders.components : []
      const updates = components
        .filter((entry) => entry?.name === component)
        .reduce((sum, entry) => sum + (typeof entry.updates === 'number' ? entry.updates : 0), 0)
      checks.push({
        name: 'probe.renders',
        pass: renders.tracking === true && updates <= maxUpdates,
        detail: `${component} updates=${updates}, max=${maxUpdates}`,
      })
    }
    if (probe.noCaughtErrors) {
      const state = await genie(dir, session, ['call', 'react_error_state', '{}'])
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
