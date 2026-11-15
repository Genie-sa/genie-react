import { createGenieCli } from './genie-cli.mjs'

const READY_TIMEOUT_MS = 20_000
const SETTLE_TIMEOUT_MS = 15_000

/**
 * @typedef {{ name: string, pass: boolean, detail: string }} Check
 * @typedef {import('playwright').Page} Page
 */

/**
 * Builds the API a probe script uses: a fresh browser page, the Genie CLI for its session, and check recording.
 * @param {{ browser: import('playwright').Browser, variant: import('./workspace.mjs').RunningVariant, cliPath: string, runtimeDir: string, session: string }} options
 */
export async function createProbeContext({ browser, variant, cliPath, runtimeDir, session }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const genie = createGenieCli({ cliPath, cwd: variant.dir, runtimeDir, session })
  /** @type {Check[]} */
  const checks = []
  /** @type {string[]} */
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  /**
   * @param {string} path
   */
  const withSession = (path) => {
    const target = new URL(path, variant.url)
    target.searchParams.set('_genie', session)
    return target.toString()
  }

  const ctx = {
    page,
    genie,
    pageErrors,
    /**
     * Loads a route with a full navigation and waits for this tab's Genie session.
     * @param {string} path
     */
    async open(path) {
      await page.goto(withSession(path))
      await genie.waitReady(READY_TIMEOUT_MS)
    },
    /**
     * Resets the mock backend and signs in through the app's own Genie tools, as an agent would.
     * @param {'admin' | 'manager' | 'agent' | 'viewer'} [role]
     */
    async signIn(role = 'admin') {
      await ctx.open('/login')
      await genie.call('app_reset_backend', {})
      await genie.call('app_login_as', { role })
    },
    /**
     * Waits until React has committed nothing for `quietMs` and no tracked query is fetching.
     * @param {{ quietMs?: number, domains?: string[] }} [options]
     */
    async settle({ quietMs = 400, domains = ['react', 'query'] } = {}) {
      const result = await genie.call('devtools_wait', {
        condition: 'settled',
        domains,
        quietMs,
        timeoutMs: SETTLE_TIMEOUT_MS,
      })
      if (result.ok === false)
        throw new Error(`App did not settle: ${JSON.stringify(result).slice(0, 400)}`)
      return result
    },
    /**
     * Starts a render observation, sized to the mounted tree.
     * @param {string[]} [components]
     */
    async clearRenders(components) {
      return genie.call('react_clear_renders', {
        ...(components ? { components } : {}),
        budget: { adaptive: true },
      })
    },
    async quiesce() {
      const result = await genie.call('react_quiesce', { idleMs: 400, timeoutMs: 10_000 })
      if (result.outcome !== 'idle') throw new Error(`React did not go idle: ${result.outcome}`)
      return result
    },
    /**
     * Finds one mounted component by exact name and returns its inspection.
     * @param {string} component
     * @param {number} [depth]
     */
    async inspect(component, depth = 3) {
      const found = await genie.call('react_find_components', { component, exact: true })
      const match = found.matches?.[0]
      if (!match) throw new Error(`${component} is not mounted`)
      return genie.call('react_inspect_component', { id: match.id, depth })
    },
    /**
     * @param {string} name
     * @param {boolean} pass
     * @param {string} detail
     */
    check(name, pass, detail) {
      checks.push({ name, pass, detail })
    },
    checks,
    close: () => context.close(),
  }
  return ctx
}

/**
 * @typedef {Awaited<ReturnType<typeof createProbeContext>>} ProbeContext
 */
