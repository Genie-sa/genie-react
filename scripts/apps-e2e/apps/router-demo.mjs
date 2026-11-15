import { check, sourceLine } from '../harness.mjs'
import { assertViteProductionExcludesGenie } from '../production.mjs'
import {
  assertNotRendered,
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

const HOME = 'apps/router-demo/src/routes/index.tsx'
const FORCED_ERROR = /Simulated error coming from DevTools/
const GREETING = ['greeting']

async function clickCounter(page) {
  const before = Number((await textOf(page, '[data-testid=counter]')).replace(/\D/g, ''))
  await page.locator('[data-testid=counter]').click()
  await waitForText(page, '[data-testid=counter]', `Count: ${before + 1}`)
  return before + 1
}

async function throwForReal(ctx) {
  await ctx.page.locator('[data-testid=throw]').waitFor()
  await ctx.errors.expectErrors([/boom from \/error/], async () => {
    await ctx.page.locator('[data-testid=throw]').click()
    await waitForText(ctx.page, '[data-testid=error-ui]', 'Caught: boom from /error')
  })
}

export default {
  name: 'router-demo',
  dir: 'apps/router-demo',
  hub: 'Vite plugin genie()',
  domains: ['session', 'react', 'query', 'router', 'timeline', 'plugin', 'memory', 'perf'],
  probeComponent: 'Counter',
  sweepArgs: {
    component: 'Counter',
    selector: '[data-testid=counter]',
    to: '/checkout',
    name: 'apps-e2e-sweep',
  },
  start: (context) => startVite(context, ['dev']),
  async ready({ page }) {
    await waitForText(page, '[data-testid=query-data]', 'hello from queryFn (fetch #1)')
  },
  groundTruth: [
    {
      name: 'counter click: Home updates once for its state, Counter once for its count prop',
      async run(ctx) {
        let count
        const report = await measure(ctx, async () => {
          count = await clickCounter(ctx.page)
        })
        assertUpdatedOnce(report, 'Home', { kind: 'state', evidence: 'exact' })
        assertUpdatedOnce(report, 'Counter', { kind: 'props', name: 'count', evidence: 'exact' })
        assertUpdatedOnce(report, 'MemoBadge', {
          kind: 'props',
          name: 'style',
          referenceOnly: true,
        })
        assertNotRendered(report, 'LazyPanel')
        check((await ctx.page.title()) === `lab ${count}:0`, 'document.title oracle disagrees')
      },
    },
    {
      name: 'effects: the title effect runs once for its count dependency; HookZoo layout effect stays idle',
      async run(ctx) {
        await measure(ctx, () => clickCounter(ctx.page))
        const home = await ctx.call('react_effect_events', { component: 'Home', appOnly: false })
        const executed = home.events.filter((event) => event.execution?.status === 'observed')
        check(executed.length === 1, 'Home effect must execute exactly once', home.events)
        check(
          JSON.stringify(executed[0].changedDependencySlots) === '[0]',
          'the title effect must blame dependency slot 0 (count)',
          executed[0],
        )
        const zoo = await ctx.call('react_effect_events', { component: 'HookZoo', appOnly: false })
        const kinds = zoo.events
          .filter((event) => event.execution?.status === 'observed')
          .map((event) => event.kind)
        check(
          JSON.stringify(kinds) === '["effect"]',
          'HookZoo must run its dependency-free effect once and skip its [flag] layout effect',
          zoo.events,
        )
      },
    },
    {
      name: 'source: Counter and HookZoo resolve to their JSX callsites in routes/index.tsx',
      async run(ctx) {
        await assertSourceLine(ctx, 'Counter', {
          file: HOME,
          line: await sourceLine(HOME, '<Counter count={count}'),
        })
        await assertSourceLine(ctx, 'HookZoo', {
          file: HOME,
          line: await sourceLine(HOME, '<HookZoo />'),
        })
      },
    },
    {
      name: 'query: ["greeting"] matches the DOM, refetch increments the fetch counter once',
      async run(ctx) {
        const query = await ctx.call('query_get', { queryKey: GREETING })
        const shown = await textOf(ctx.page, '[data-testid=query-data]')
        check(
          shown === `${query.data.greeting} (fetch #${query.data.fetchCount})`,
          'query_get data disagrees with the rendered greeting',
          { shown, data: query.data },
        )
        const next = query.data.fetchCount + 1
        await ctx.call('query_refetch', { queryKey: GREETING, exact: true })
        await waitForText(ctx.page, '[data-testid=query-data]', `(fetch #${next})`)
        await ctx.call('query_invalidate', { queryKey: GREETING, exact: true })
        await waitForText(ctx.page, '[data-testid=query-data]', `(fetch #${next + 1})`)
        const fetched = await ctx.call('query_fetch', { queryKey: GREETING })
        check(fetched.status === 'success', 'query_fetch did not settle', fetched)
        await waitForText(ctx.page, '[data-testid=query-data]', `(fetch #${next + 2})`)
        const ensured = await ctx.call('query_ensure', { queryKey: GREETING })
        check(
          ensured.data?.fetchCount === next + 2,
          'query_ensure must not refetch fresh data',
          ensured,
        )
        const settled = await ctx.call('query_is_fetching', { queryKey: GREETING })
        check(JSON.stringify(settled).match(/\b0\b|false/), 'query must be idle', settled)
      },
    },
    {
      name: 'query: simulated pending and error states reach the UI and restore to the real data',
      async run(ctx) {
        await simulateQueryRoundTrip(ctx, {
          queryKey: GREETING,
          state: 'pending',
          selector: '[data-testid=query-data]',
          simulatedText: 'query pending…',
          readyText: 'hello from queryFn',
        })
        await simulateQueryRoundTrip(ctx, { queryKey: GREETING, state: 'error' })
        await scratchQueryRoundTrip(ctx)
      },
    },
    {
      name: 'mutation: Shout runs once, mutation_rerun runs it again with the same variables',
      async run(ctx) {
        await ctx.page.locator('[data-testid=mutate]').click()
        await waitForText(ctx.page, '[data-testid=mutation-result]', 'GENIE!')
        const listed = await ctx.call('query_list_mutations', {})
        check(listed.mutations.length === 1, 'exactly one mutation must be recorded', listed)
        const [mutation] = listed.mutations
        const detail = await ctx.call('mutation_get', { mutationId: mutation.mutationId })
        check(JSON.stringify(detail).includes('GENIE!'), 'mutation_get lost the result', detail)
        const rerun = await ctx.call('mutation_rerun', { mutationId: mutation.mutationId })
        check(rerun.ok === true && rerun.data === 'GENIE!', 'mutation_rerun result', rerun)
      },
    },
    {
      name: 'router: navigate to /checkout, read route-scoped app tools, go back to /',
      async run(ctx) {
        const before = await ctx.call('router_get_state', {})
        check(before.pathname === '/', 'run must start at /', before)
        const built = await ctx.call('router_build_location', { to: '/checkout' })
        check(JSON.stringify(built).includes('/checkout'), 'router_build_location', built)
        const matched = await ctx.call('router_match_route', { to: '/' })
        check(matched && typeof matched === 'object', 'router_match_route', matched)
        await ctx.call('router_preload', { to: '/suspense' })
        await navigateRoundTrip(ctx, {
          to: '/checkout',
          selector: '[data-testid=wizard-step]',
          text: 'step 1/4',
        })
        await ctx.call('router_history', { action: 'forward' })
        await waitForText(ctx.page, '[data-testid=wizard-step]', 'step 1/4')
        const state = await ctx.call('app_checkout_state', {})
        check(state.step === 'cart' && state.total === 120, 'checkout state', state)
        const moved = await ctx.call('app_checkout_goto', { step: 'payment' })
        check(moved.step === 'payment', 'checkout goto', moved)
        await waitForText(ctx.page, '[data-testid=wizard-step]', 'step 3/4: payment')
        const applied = await ctx.call('app_apply_coupon', { code: 'save10' })
        check(applied.total === 110, 'coupon total', applied)
        await waitForText(ctx.page, '[data-testid=order-total]', '$110')
        const invalid = await ctx.cli.failure('app_apply_coupon', { code: 'NOPE' })
        check(
          invalid.reason === 'tool_error' && invalid.details?.app?.code === 'INVALID_COUPON',
          'an unknown coupon must surface the app error code',
          invalid,
        )
        await ctx.call('router_invalidate', {})
        await ctx.call('router_load', {})
        await ctx.call('router_navigate', { to: '/' })
        await waitForText(ctx.page, '[data-testid=query-data]', 'hello from queryFn')
        const unavailable = await ctx.cli.failure('app_checkout_state', {})
        check(
          unavailable.reason === 'tool_unavailable',
          'a route-scoped tool must be unavailable after its route unmounts',
          unavailable,
        )
      },
    },
    {
      name: 'overrides: props, hook state, Suspense fallback and error boundary each apply and fully reset',
      async run(ctx) {
        await overrideRoundTrip(ctx, {
          tool: 'react_override_props',
          args: { id: await componentId(ctx, 'Unmountable'), props: { caption: 'e2e caption' } },
          selector: '[data-testid=unmountable]',
          before: 'original caption',
          after: 'e2e caption',
        })
        await overrideRoundTrip(ctx, {
          tool: 'react_override_hook_state',
          args: { id: await componentId(ctx, 'HookZoo'), stateIndex: 2, value: 'e2e-zoo' },
          selector: '[data-testid=zoo-name]',
          before: 'name: zoo',
          after: 'name: e2e-zoo',
        })
        const context = await ctx.call('react_inspect_context', {
          id: await componentId(ctx, 'ThemeLabel'),
        })
        check(JSON.stringify(context).includes('light'), 'ThemeLabel must consume "light"', context)
        await overrideRoundTrip(ctx, {
          tool: 'react_override_context',
          args: { id: await componentId(ctx, 'ThemeLabel'), value: 'e2e-dark' },
          selector: '[data-testid=theme]',
          before: 'theme: light',
          after: 'theme: e2e-dark',
        })
        await ctx.call('router_navigate', { to: '/suspense' })
        await waitForText(ctx.page, '[data-testid=lazy-content]', 'Lazy content loaded')
        await overrideRoundTrip(ctx, {
          tool: 'react_toggle_suspense_fallback',
          args: { id: await componentId(ctx, 'LazyPanel'), showFallback: true },
          selector: '#app',
          before: 'Lazy content loaded',
          after: 'Loading lazy panel…',
        })
        await ctx.call('router_navigate', { to: '/' })
        await waitForText(ctx.page, '[data-testid=query-data]', 'hello from queryFn')
      },
    },
    {
      name: 'error boundary: a real throw reports its own message; a forced error is marked forced and releases',
      async run(ctx) {
        await ctx.open('/error')
        await throwForReal(ctx)
        const state = await ctx.call('react_error_state', { appOnly: false })
        check(
          state.caughtErrors.length === 1 &&
            state.caughtErrors[0].message === 'boom from /error' &&
            state.caughtErrors[0].boundaryName === 'Boundary' &&
            state.caughtErrors[0].forced === false,
          'react_error_state must report the real error caught by Boundary',
          state.caughtErrors,
        )
        await ctx.open('/error')
        const bomb = await componentId(ctx, 'Bomb')
        await ctx.errors.expectErrors([FORCED_ERROR], () =>
          overrideRoundTrip(ctx, {
            tool: 'react_force_error_boundary',
            args: { id: bomb },
            selector: '#app',
            before: 'Throw',
            after: 'Caught',
            async during() {
              const forced = await ctx.call('react_error_state', { appOnly: false })
              check(
                forced.caughtErrors.some(
                  (error) => error.forced === true && error.boundaryName === 'Boundary',
                ),
                'a forced boundary must be reported as forced',
                forced.caughtErrors,
              )
            },
          }),
        )
        await ctx.knownDefect('KD-3', async () => {
          await throwForReal(ctx)
          const after = await ctx.call('react_error_state', { appOnly: false })
          check(
            after.caughtErrors.length === 1 && after.caughtErrors[0].message === 'boom from /error',
            'a real error caught after a released forced error must report its own message',
            after.caughtErrors.map(({ message, forced }) => ({ message, forced })),
          )
        })
        await ctx.open('/')
        await waitForText(ctx.page, '[data-testid=query-data]', 'hello from queryFn')
      },
    },
    measurementToolsStep({
      component: 'Counter',
      action: (ctx) => clickCounter(ctx.page),
      timeline: {
        domains: ['query', 'react'],
        action: async (ctx) => {
          await ctx.call('query_refetch', { queryKey: GREETING, exact: true })
          await waitForText(ctx.page, '[data-testid=query-fetching]', 'idle')
        },
      },
    }),
    {
      name: 'plugin bus: a lab-bus click event carries the clicked count',
      async run(ctx) {
        const count = await clickCounter(ctx.page)
        const events = await ctx.call('plugin_get_events', { pluginId: 'lab-bus' })
        const last = events.events.at(-1)
        check(
          JSON.stringify(last).includes(`"count":${count}`),
          'lab-bus event must carry the clicked count',
          events,
        )
        await ctx.call('plugin_emit', { pluginId: 'lab-bus', type: 'apps-e2e', payload: { ok: 1 } })
      },
    },
  ],
  production: (context) =>
    assertViteProductionExcludesGenie(context, {
      name: 'router-demo',
      readySelector: '[data-testid=counter]',
    }),
}
