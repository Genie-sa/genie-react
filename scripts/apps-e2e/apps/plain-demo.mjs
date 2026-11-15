import { openSession } from '../browser.mjs'
import {
  CLI_ENTRY,
  Cli,
  check,
  freePort,
  sourceLine,
  waitFor,
  waitForHttp,
  waitForOutput,
} from '../harness.mjs'
import {
  assertSourceLine,
  assertUpdatedOnce,
  componentId,
  measure,
  measurementToolsStep,
  overrideRoundTrip,
  textOf,
  waitForText,
} from '../sequences.mjs'
import { binary, discoveredHub, startRewritingProxy } from '../servers.mjs'

const LAB = 'apps/plain-demo/src/lab.tsx'
const MEMO_SOURCE_NAME = 'MemoChildWithUnstableProp'
/** esbuild renames the memo's inner function to dodge the outer binding of the same name. */
const MEMO_RUNTIME_NAME = 'MemoChildWithUnstableProp2'
/** The demo pins the default hub port in its HTML and manual entry; the proxy rewrites it so the matrix runs on a free port without editing the app. */
const HARDCODED_HUB = '127.0.0.1:4390'

async function increment(page) {
  const before = Number((await textOf(page, '[data-testid=increment]')).replace(/\D/g, ''))
  await page.locator('[data-testid=increment]').click()
  await waitForText(page, '[data-testid=increment]', `increment ${before + 1}`)
  return before + 1
}

export default {
  name: 'plain-demo',
  dir: 'apps/plain-demo',
  hub: 'standalone genie-react hub with a <script> tag (index) and createGenieClient (manual)',
  domains: ['session', 'react'],
  probeComponent: 'EffectCounter',
  sweepArgs: {
    component: 'EffectCounter',
    selector: '[data-testid=increment]',
    name: 'apps-e2e-sweep',
  },
  async start({ processes, appDir }) {
    const hubPort = await freePort()
    const hub = processes.start(
      'genie-react hub',
      process.execPath,
      [CLI_ENTRY, 'hub', '--port', String(hubPort), '--json'],
      {
        cwd: appDir,
      },
    )
    await waitForOutput(hub, /"event":"ready"/)
    await discoveredHub(appDir, { port: hubPort, owner: hub })
    const port = await freePort()
    const esbuild = processes.start(
      'esbuild serve',
      binary(appDir, 'esbuild', 'bin/esbuild'),
      [
        'src/main.tsx',
        'src/main-manual.tsx',
        '--bundle',
        '--outdir=public/assets',
        '--servedir=public',
        `--serve=127.0.0.1:${port}`,
        '--sourcemap',
        '--jsx=automatic',
        '--define:process.env.NODE_ENV="development"',
      ],
      { cwd: appDir },
    )
    await waitForHttp(esbuild, `http://127.0.0.1:${port}/`)
    const proxy = await startRewritingProxy(`http://127.0.0.1:${port}/`, [
      [HARDCODED_HUB, `127.0.0.1:${hubPort}`],
    ])
    return { url: proxy.url, hubPort, cleanup: proxy.close }
  },
  async ready({ page }) {
    await page.locator('[data-testid=increment]').waitFor()
  },
  groundTruth: [
    {
      name: 'increment: EffectCounter updates once for state; the memo child re-renders for its inline config object',
      async run(ctx) {
        let count
        const report = await measure(ctx, async () => {
          count = await increment(ctx.page)
        })
        assertUpdatedOnce(report, 'EffectCounter', { kind: 'state', evidence: 'exact' })
        assertUpdatedOnce(report, MEMO_RUNTIME_NAME, {
          kind: 'props',
          name: 'config',
          referenceOnly: true,
        })
        check(
          (await ctx.page.title()) === `Genie Lab · count ${count}`,
          'document.title oracle disagrees',
        )
        const effects = await ctx.call('react_effect_events', {
          component: 'EffectCounter',
          appOnly: false,
        })
        const executed = effects.events.filter((event) => event.execution?.status === 'observed')
        check(
          JSON.stringify(executed.map((event) => event.effectIndex).sort()) === '[0,1]',
          'both EffectCounter effects (no deps, and [count]) must run exactly once',
          effects.events,
        )
      },
    },
    {
      name: 'context: toggling the theme re-renders ThemedLabel for its context and leaves EffectCounter alone',
      async run(ctx) {
        const report = await measure(ctx, async () => {
          await ctx.page.locator('[data-testid=toggle-theme]').click()
          await waitForText(ctx.page, '[data-testid=themed-label]', 'theme: dark')
        })
        assertUpdatedOnce(report, 'App', { kind: 'state' })
        assertUpdatedOnce(report, 'ThemedLabel', { kind: 'context' })
        const memo = report.components.find((row) => row.name === MEMO_RUNTIME_NAME)
        check(
          memo?.updates === 1,
          'the memo child re-renders because EffectCounter re-renders under App',
          memo,
        )
        await ctx.page.locator('[data-testid=toggle-theme]').click()
        await waitForText(ctx.page, '[data-testid=themed-label]', 'theme: light')
      },
    },
    {
      name: 'source: esbuild source maps resolve EffectCounter and ThemedLabel to their JSX callsites, and the memo child esbuild renamed to its source name',
      async run(ctx) {
        await componentId(ctx, MEMO_SOURCE_NAME, { count: 1 })
        const found = await ctx.call('react_find_components', {
          component: MEMO_SOURCE_NAME,
          exact: true,
          appOnly: false,
        })
        check(
          found.matches[0]?.name === MEMO_RUNTIME_NAME &&
            found.matches[0]?.sourceName === MEMO_SOURCE_NAME,
          'the exact source name must find the renamed memo child and report both names',
          found,
        )
        const causes = await ctx.call('react_render_causes', {
          component: MEMO_SOURCE_NAME,
          appOnly: false,
          limit: 5,
        })
        check(
          JSON.stringify(causes.componentMatch?.bundlerRenames) ===
            JSON.stringify([{ name: MEMO_RUNTIME_NAME, sourceName: MEMO_SOURCE_NAME }]),
          'name-filtered evidence must say it matched through the bundler rename',
          causes.componentMatch,
        )
        await assertSourceLine(ctx, 'EffectCounter', {
          file: LAB,
          line: await sourceLine(LAB, '<EffectCounter />'),
        })
        await assertSourceLine(ctx, 'ThemedLabel', {
          file: LAB,
          line: await sourceLine(LAB, '<ThemedLabel />'),
        })
      },
    },
    {
      name: 'unmount: toggling Disposable off leaves an unmounted tombstone with the same mount identity',
      async run(ctx) {
        await ctx.call('react_clear_renders', {})
        const before = await ctx.call('react_component_cohort', {
          component: 'Disposable',
          exact: true,
          view: 'full',
        })
        check(
          before.instances[0]?.renderingState === 'mounted-rendering',
          'Disposable starts mounted',
          before,
        )
        await ctx.page.locator('[data-testid=toggle-mount]').click()
        await ctx.page.locator('[data-testid=disposable]').waitFor({ state: 'detached' })
        const after = await waitFor('the unmount tombstone', async () => {
          const value = await ctx.call('react_component_cohort', {
            component: 'Disposable',
            exact: true,
            view: 'full',
          })
          return value.unmounted === 1 ? value : undefined
        })
        check(
          after.instances[0].instance.mountId === before.instances[0].instance.mountId,
          'the tombstone must keep the mount identity',
          after,
        )
        await ctx.page.locator('[data-testid=toggle-mount]').click()
        await ctx.page.locator('[data-testid=disposable]').waitFor()
      },
    },
    {
      name: 'errors and suspense: Bomb is caught by LabErrorBoundary; the 6 s lazy child is suspended, then resolves, then its fallback can be held',
      async run(ctx) {
        await ctx.errors.expectErrors([/boom from Bomb/], async () => {
          await ctx.page.locator('[data-testid=throw]').click()
          await waitForText(ctx.page, '[data-testid=boundary]', 'caught: boom from Bomb')
        })
        await ctx.page.locator('[data-testid=load-slow]').click()
        await ctx.page.locator('[data-testid=suspense-fallback]').waitFor()
        const state = await waitFor('the suspended boundary', async () => {
          const value = await ctx.call('react_error_state', { appOnly: false })
          return value.suspended.length === 1 ? value : undefined
        })
        check(
          state.caughtErrors.length === 1 &&
            state.caughtErrors[0].message === 'boom from Bomb' &&
            state.caughtErrors[0].boundaryName === 'LabErrorBoundary' &&
            state.suspended[0].isFallbackShowing === true &&
            state.suspended[0].forced === false,
          'react_error_state must report the caught Bomb and the real suspension',
          state,
        )
        await ctx.page.locator('[data-testid=slow-child]').waitFor({ timeout: 15_000 })
        const resolved = await ctx.call('react_error_state', { appOnly: false })
        check(
          resolved.suspended.length === 0,
          'a resolved boundary must not stay suspended',
          resolved,
        )
        await overrideRoundTrip(ctx, {
          tool: 'react_toggle_suspense_fallback',
          args: { id: await componentId(ctx, 'LoadedSlowChild'), showFallback: true },
          selector: 'main',
          before: 'slow child loaded',
          after: 'loading slow child…',
        })
        await ctx.open()
        await ctx.spec.ready(ctx)
      },
    },
    {
      name: 'overrides: props, hook state, context and error boundary apply over the script-tag client and reset',
      async run(ctx) {
        await overrideRoundTrip(ctx, {
          tool: 'react_override_props',
          args: { id: await componentId(ctx, MEMO_RUNTIME_NAME), props: { label: 'e2e-label' } },
          selector: '[data-testid=memo-child]',
          before: 'stable-label',
          after: 'e2e-label',
        })
        await overrideRoundTrip(ctx, {
          tool: 'react_override_hook_state',
          args: { id: await componentId(ctx, 'EffectCounter'), stateIndex: 0, value: 41 },
          selector: '[data-testid=increment]',
          before: 'increment',
          after: 'increment 41',
        })
        await overrideRoundTrip(ctx, {
          tool: 'react_override_context',
          args: { id: await componentId(ctx, 'ThemedLabel'), value: 'e2e-theme' },
          selector: '[data-testid=themed-label]',
          before: 'theme: light',
          after: 'theme: e2e-theme',
        })
        await ctx.errors.expectErrors([/Simulated error coming from DevTools/], async () =>
          overrideRoundTrip(ctx, {
            tool: 'react_force_error_boundary',
            args: { id: await componentId(ctx, 'Bomb') },
            selector: 'main',
            before: 'bomb is safe',
            after: 'caught: Simulated error coming from DevTools',
          }),
        )
        await ctx.open()
        await ctx.spec.ready(ctx)
      },
    },
    {
      name: 'manual composition: a second tab on manual.html adds Query and memory; sessions stay separate',
      async run(ctx) {
        const session = `${ctx.cli.session}-manual`
        const manual = await openSession(
          ctx.browser,
          new URL('manual.html', ctx.started.url).href,
          session,
        )
        try {
          const cli = new Cli({ cwd: ctx.cli.cwd, session })
          const ready = await cli.run(['status', '--wait', '30000'], { timeoutMs: 45_000 })
          check(
            ready.code === 0 && ready.json.ready === true,
            'manual tab never became ready',
            ready.json,
          )
          await waitFor('manual domains', async () => {
            const status = await cli.status()
            return ['query', 'memory'].every((domain) => status.domains.includes(domain))
          })
          await waitForText(manual.page, '[data-testid=greeting]', 'greeting #1')
          const query = await cli.call('query_get', { queryKey: ['greeting'] })
          check(
            query.status === 'success' &&
              query.data === (await textOf(manual.page, '[data-testid=greeting]')),
            'query_get must match the greeting the manual tab renders',
            query,
          )
          const memory = await cli.call('browser_get_memory', {})
          check(typeof memory === 'object', 'memory tool must answer on the manual tab', memory)
          const index = await ctx.cli.status()
          check(
            !index.domains.includes('query'),
            'the script-tag tab must not borrow the manual tab Query',
            index,
          )
          const ambiguous = await ctx.cli.run(['call', 'react_get_tree', '{}'], { session: null })
          check(
            ambiguous.code === 1 && ambiguous.json.reason === 'unknown_session',
            'an untargeted call with two tabs must refuse to guess',
            ambiguous.json,
          )
          manual.errors.assertClean('manual.html')
        } finally {
          await manual.context.close()
        }
      },
    },
    measurementToolsStep({
      component: 'EffectCounter',
      action: (ctx) => increment(ctx.page),
      timeline: { domains: ['react'], action: (ctx) => increment(ctx.page) },
    }),
  ],
}
