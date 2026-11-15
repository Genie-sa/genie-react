import { check, sourceLine, waitFor } from '../harness.mjs'
import {
  assertSourceLine,
  assertUpdatedOnce,
  componentId,
  measure,
  measurementToolsStep,
  navigateRoundTrip,
  overrideRoundTrip,
  scratchQueryRoundTrip,
  simulateQueryRoundTrip,
  textOf,
  waitForText,
} from '../sequences.mjs'
import { startVite } from '../servers.mjs'

const LAB = 'apps/demo/src/routes/lab.tsx'
const GREETING = ['demo', 'greeting']

async function openLab(ctx) {
  await ctx.open('/lab')
  await ctx.page.locator('[data-testid=lab-counter]').waitFor()
}

async function increment(page) {
  const before = Number((await textOf(page, '[data-testid=lab-counter]')).match(/count:(\d+)/)[1])
  await page.locator('[data-testid=lab-counter] button', { hasText: 'increment' }).click()
  await waitForText(page, '[data-testid=lab-counter]', `count:${before + 1}`)
  return before + 1
}

export default {
  name: 'demo',
  dir: 'apps/demo',
  hub: 'Vite plugin genie() under TanStack Start SSR',
  domains: ['session', 'react', 'query', 'plugin', 'timeline', 'memory', 'perf'],
  probeComponent: 'App',
  sweepArgs: {
    component: 'App',
    selector: 'h1',
    to: '/about',
    name: 'apps-e2e-sweep',
  },
  start: (context) => startVite(context, ['dev']),
  async ready({ page }) {
    await page.getByText('Hello from TanStack Query').waitFor({ timeout: 20_000 })
  },
  groundTruth: [
    {
      name: 'session: the app name comes from genie({ appName }) and the SSR page hydrates once',
      async run(ctx) {
        const status = await ctx.cli.status()
        check(
          status.app?.name === 'Genie Demo',
          'status must report the configured app name',
          status.app,
        )
        const tree = await ctx.call('react_find_components', {
          component: 'App',
          exact: true,
          appOnly: false,
        })
        check(tree.matches.length === 1, 'hydration must leave exactly one App', tree)
      },
    },
    {
      name: 'query: ["demo","greeting"] matches the DOM; Refetch updates it exactly once',
      async run(ctx) {
        const before = await ctx.call('query_get', { queryKey: GREETING })
        check(
          before.status === 'success' && before.data?.message === 'Hello from TanStack Query',
          'greeting',
          before,
        )
        await ctx.page.getByRole('button', { name: 'Refetch' }).click()
        const after = await waitFor('one more fetch', async () => {
          const value = await ctx.call('query_get', { queryKey: GREETING })
          return value.fetchStatus === 'idle' &&
            value.dataUpdateCount === before.dataUpdateCount + 1
            ? value
            : undefined
        })
        check(after.data.at > before.data.at, 'refetched data must be newer', { before, after })
        await simulateQueryRoundTrip(ctx, {
          queryKey: GREETING,
          state: 'error',
          selector: 'body',
          simulatedText: 'Error: Simulated query error',
          readyText: 'Hello from TanStack Query',
        })
        await scratchQueryRoundTrip(ctx)
        await ctx.call('query_invalidate', { queryKey: GREETING, exact: true })
        await ctx.call('query_refetch', { queryKey: GREETING, exact: true })
        const fetched = await ctx.call('query_fetch', { queryKey: GREETING, staleTime: 60_000 })
        check(fetched.status === 'success', 'query_fetch', fetched)
        await ctx.call('query_ensure', { queryKey: GREETING })
        await ctx.call('query_is_fetching', { queryKey: GREETING })
      },
    },
    {
      name: 'mutation: Mutate records ["demo","echo"] with its result; mutation_rerun repeats it',
      async run(ctx) {
        await ctx.page.getByRole('button', { name: 'Mutate' }).click()
        await ctx.page.getByText('Mutation result: HI').waitFor()
        const listed = await ctx.call('query_list_mutations', {})
        const [echo] = listed.mutations
        check(
          listed.mutations.length === 1 && echo.variables === 'hi',
          'one mutation with its variables',
          listed,
        )
        const detail = await ctx.call('mutation_get', { mutationId: echo.mutationId })
        check(
          JSON.stringify(detail.mutationKey) === '["demo","echo"]' &&
            JSON.stringify(detail).includes('"HI"'),
          'mutation_get must report the source mutationKey and the result',
          detail,
        )
        const rerun = await ctx.call('mutation_rerun', {
          mutationId: echo.mutationId,
          variables: 'again',
        })
        check(rerun.ok === true && rerun.data === 'AGAIN', 'mutation_rerun result', rerun)
      },
    },
    {
      name: 'router: the router collector registers, preloads and visits /about, then reloads / in place',
      async run(ctx) {
        await waitFor(
          'the router domain',
          async () => (await ctx.cli.status()).domains.includes('router'),
          { timeoutMs: 5_000 },
        )
        const routes = await ctx.call('router_list_routes', {})
        for (const path of ['/', '/about', '/dashboard', '/lab']) {
          check(JSON.stringify(routes).includes(`"${path}"`), `route tree misses ${path}`, routes)
        }
        const preloaded = await ctx.call('router_preload', { to: '/about' })
        check(preloaded.ok === true, 'router_preload of /about', preloaded)
        await navigateRoundTrip(ctx, { to: '/about', selector: 'h1', text: 'About' })
        const invalidated = await ctx.call('router_invalidate', {})
        const loaded = await ctx.call('router_load', {})
        check(invalidated.ok && loaded.ok, 'router_invalidate then router_load', {
          invalidated,
          loaded,
        })
        const after = await ctx.call('router_get_state', {})
        check(
          after.pathname === '/' && after.settled === true && after.isTransitioning === false,
          'reloading / in place must leave the router settled at /',
          after,
        )
      },
    },
    {
      name: 'lab counter: Counter updates once for state; StatBadge for stats by value and onPing by reference',
      async run(ctx) {
        await openLab(ctx)
        let count
        const report = await measure(ctx, async () => {
          count = await increment(ctx.page)
        })
        assertUpdatedOnce(report, 'Counter', { kind: 'state', evidence: 'exact' })
        const badge = assertUpdatedOnce(report, 'StatBadge', { kind: 'props', name: 'stats' })
        check(
          badge.causes.some((cause) => cause.name === 'onPing') &&
            !badge.causes.some((cause) => cause.name === 'stats' && cause.referenceOnly === true),
          'stats changed by value (count), and the inline onPing changed too',
          badge.causes,
        )
        check(
          (await ctx.page.title()) === `Lab · count ${count}`,
          'document.title oracle disagrees',
        )
        const effects = await ctx.call('react_effect_events', {
          component: 'Counter',
          appOnly: false,
        })
        const executed = effects.events.filter((event) => event.execution?.status === 'observed')
        check(executed.length === 1, 'the [count] title effect must run once', effects.events)
        await assertSourceLine(ctx, 'Counter', {
          file: LAB,
          line: await sourceLine(LAB, '<Counter />'),
        })
      },
    },
    {
      name: 'plugins: cart-devtools carries the cart the UI shows; metrics-devtools answers request-reset',
      async run(ctx) {
        await openLab(ctx)
        const listed = await ctx.call('plugin_list', {})
        for (const id of ['cart-devtools', 'metrics-devtools']) {
          check(JSON.stringify(listed).includes(`"${id}"`), `plugin_list misses ${id}`, listed)
        }
        await ctx.page.getByRole('button', { name: 'add tea' }).click()
        await ctx.page.getByRole('button', { name: 'add coffee' }).click()
        await waitForText(ctx.page, '[data-testid=lab-cart]', 'cart:2')
        await waitFor('a cart-updated event carrying both items and total 10', async () => {
          const cart = await ctx.call('plugin_get_events', {
            pluginId: 'cart-devtools',
            limit: 200,
          })
          const latest = cart.events.filter((event) => event.type.endsWith(':cart-updated')).at(-1)
          check(
            latest !== undefined,
            'cart-devtools buffered no cart-updated event; the plugin never reached the TanStack Devtools bus',
            cart.events,
          )
          const serialized = JSON.stringify(latest)
          check(
            serialized.includes('"total":10') && serialized.includes('Coffee'),
            'the latest cart event must carry both items and total 10',
            latest,
          )
          return latest
        })
        const emitted = await ctx.call('plugin_emit', {
          pluginId: 'metrics-devtools',
          type: 'request-reset',
        })
        check(emitted.ok === true, 'plugin_emit must reach the bus', emitted)
        await waitFor('reset-done', async () => {
          const metrics = await ctx.call('plugin_get_events', {
            pluginId: 'metrics-devtools',
            limit: 200,
          })
          return JSON.stringify(metrics).includes('reset-done')
        })
      },
    },
    {
      name: 'suspense and errors: a held Suspense boundary is reported suspended; lab-bomb is caught by LabErrorBoundary',
      async run(ctx) {
        await openLab(ctx)
        await ctx.page.getByRole('button', { name: 'load slow' }).click()
        await ctx.page.locator('[data-testid=lab-slow-fallback]').waitFor()
        const suspended = await waitFor('the slow boundary to be reported', async () => {
          const state = await ctx.call('react_error_state', { appOnly: false })
          return state.suspended.some((entry) => entry.isFallbackShowing && entry.forced === false)
            ? state
            : undefined
        })
        check(suspended.caughtErrors.length === 0, 'nothing has thrown yet', suspended)
        await ctx.errors.expectErrors([/lab-bomb/], async () => {
          await ctx.page.getByRole('button', { name: 'explode' }).click()
          await ctx.page.locator('[data-testid=lab-error-zone] [data-testid=lab-error]').waitFor()
        })
        const state = await ctx.call('react_error_state', { appOnly: false })
        check(
          state.caughtErrors.length === 1 &&
            state.caughtErrors[0].message === 'lab-bomb' &&
            state.caughtErrors[0].boundaryName === 'LabErrorBoundary',
          'react_error_state must report lab-bomb caught by LabErrorBoundary',
          state.caughtErrors,
        )
        await ctx.open('/lab')
        await ctx.page.locator('[data-testid=lab-counter]').waitFor()
      },
    },
    {
      name: 'overrides: context, props, Suspense fallback and error boundary apply on the lab page and reset',
      async run(ctx) {
        await openLab(ctx)
        await overrideRoundTrip(ctx, {
          tool: 'react_override_context',
          args: { id: await componentId(ctx, 'ThemeLabel'), value: 'e2e-dark' },
          selector: '[data-testid=lab-theme]',
          before: 'theme:light',
          after: 'theme:e2e-dark',
        })
        await overrideRoundTrip(ctx, {
          tool: 'react_override_hook_state',
          args: { id: await componentId(ctx, 'Counter'), stateIndex: 0, value: 41 },
          selector: '[data-testid=lab-counter]',
          before: 'count:',
          after: 'count:41',
        })
        await overrideRoundTrip(ctx, {
          tool: 'react_override_props',
          args: { id: await componentId(ctx, 'StatBadge'), props: { stats: { count: 99 } } },
          selector: '[data-testid=lab-stat]',
          before: 'stat:',
          after: 'stat:99',
        })
        await overrideRoundTrip(ctx, {
          tool: 'react_toggle_suspense_fallback',
          args: { id: await componentId(ctx, 'SuspenseContent'), showFallback: true },
          selector: 'body',
          before: 'lab-content',
          after: 'lab-loading',
        })
        await ctx.errors.expectErrors([/Simulated error coming from DevTools/], async () =>
          overrideRoundTrip(ctx, {
            tool: 'react_force_error_boundary',
            args: { id: await componentId(ctx, 'ThemeLabel') },
            selector: 'body',
            before: 'theme:light',
            after: 'lab-error',
          }),
        )
        await ctx.open('/')
        await ctx.spec.ready(ctx)
      },
    },
    {
      name: 'dashboard cohort: filtering to Acme keeps 5 MetricRow mounted and unmounts the other 45',
      async run(ctx) {
        await ctx.open('/dashboard')
        await ctx.page.getByText('Acme NA #1').waitFor()
        await ctx.call('react_clear_renders', {})
        const all = await ctx.call('react_component_cohort', {
          component: 'MetricRow',
          exact: true,
          limit: 100,
        })
        check(all.matched === 50, 'all 50 rows must be mounted', { matched: all.matched })
        await ctx.call('react_clear_renders', {})
        await ctx.page.getByPlaceholder('Filter teams…').fill('Acme')
        await waitFor(
          '5 rows in the DOM',
          async () => (await ctx.page.getByText(/^Acme /).count()) === 5,
        )
        const cohort = await waitFor('the cohort to settle', async () => {
          const value = await ctx.call('react_component_cohort', {
            component: 'MetricRow',
            exact: true,
            limit: 100,
            view: 'full',
          })
          const states = value.instances.map((row) => row.renderingState)
          const mounted = states.filter((state) => state === 'mounted-rendering').length
          check(
            mounted === 5 && value.unmounted === 45,
            'cohort must show 5 mounted and 45 unmounted',
            {
              matched: value.matched,
              unmounted: value.unmounted,
              mounted,
              states: [...new Set(states)],
            },
          )
          return value
        })
        const mountedKeys = cohort.instances
          .filter((row) => row.renderingState === 'mounted-rendering')
          .map((row) => row.instance.key)
          .sort((left, right) => Number(left) - Number(right))
        check(
          JSON.stringify(mountedKeys) === JSON.stringify(['0', '10', '20', '30', '40']),
          'the mounted rows must be the Acme rows (metric ids where id % 10 === 0)',
          mountedKeys,
        )
      },
    },
    measurementToolsStep({
      component: 'Counter',
      setup: openLab,
      action: (ctx) => increment(ctx.page),
      timeline: {
        domains: ['query', 'react'],
        setup: async (ctx) => {
          await ctx.open('/')
          await ctx.page.getByText('Hello from TanStack Query').waitFor()
        },
        action: async (ctx) => {
          await ctx.page.getByRole('button', { name: 'Refetch' }).click()
          await ctx.page.getByText('(idle)').waitFor()
        },
      },
    }),
  ],
}
