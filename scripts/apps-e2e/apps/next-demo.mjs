import { readFile } from 'node:fs/promises'
import { check, freePort, sourceLine, waitFor, waitForHttp, waitForOutput } from '../harness.mjs'
import { assertNextProductionExcludesGenie } from '../production.mjs'
import {
  assertNotRendered,
  assertUpdatedOnce,
  componentId,
  measure,
  measurementToolsStep,
  overrideRoundTrip,
  scratchQueryRoundTrip,
  simulateQueryRoundTrip,
  textOf,
  waitForText,
} from '../sequences.mjs'
import { binary, discoveredHub } from '../servers.mjs'

const PAGE = 'apps/next-demo/app/page.tsx'
const GREETING = ['greeting']

async function increment(page) {
  const before = Number((await textOf(page, '[data-testid=count]')).replace(/\D/g, ''))
  await page.getByRole('button', { name: 'Increment' }).click()
  await waitForText(page, '[data-testid=count]', `Count: ${before + 1}`)
  return before + 1
}

async function openQueryDemo(ctx) {
  await ctx.open('/query-demo')
  await ctx.page.getByText(/^hello #\d+$/).waitFor({ timeout: 20_000 })
}

export default {
  name: 'next-demo',
  dir: 'apps/next-demo',
  hub: 'Next.js registerGenie() in instrumentation.ts with <GenieScript />',
  domains: ['session', 'react', 'query', 'timeline', 'memory', 'perf'],
  probeComponent: 'Counter',
  sweepArgs: {
    component: 'Counter',
    selector: '[data-testid=count]',
    name: 'apps-e2e-sweep',
  },
  async start({ processes, appDir }) {
    const port = await freePort()
    const preferredHubPort = await freePort()
    const next = processes.start(
      'next dev',
      process.execPath,
      [
        binary(appDir, 'next', 'dist/bin/next'),
        'dev',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(port),
      ],
      {
        cwd: appDir,
        env: { GENIE_HUB_PORT: String(preferredHubPort), NEXT_TELEMETRY_DISABLED: '1' },
      },
    )
    const ready = await waitForOutput(
      next,
      /\[genie\] hub ready at ws:\/\/127\.0\.0\.1:(\d+)/,
      90_000,
    )
    const hubPort = Number(ready[1])
    await discoveredHub(appDir, { port: hubPort })
    const url = `http://127.0.0.1:${port}/`
    await waitForHttp(next, url, 120_000)
    return { url, hubPort }
  },
  async ready({ page }) {
    await page.locator('[data-testid=count]').waitFor({ timeout: 30_000 })
  },
  groundTruth: [
    {
      name: 'counter: Counter updates once for its state; sibling client components stay idle',
      async run(ctx) {
        const report = await measure(ctx, () => increment(ctx.page))
        assertUpdatedOnce(report, 'Counter', { kind: 'state', evidence: 'exact' })
        for (const sibling of ['EffectDemo', 'ItemList', 'ProfilePanel', 'ProfileCard']) {
          assertNotRendered(report, sibling)
        }
      },
    },
    {
      name: 'memo: Refresh profile re-renders ProfileCard only for its inline profile object',
      async run(ctx) {
        const report = await measure(ctx, async () => {
          await ctx.page.getByRole('button', { name: 'Refresh profile' }).click()
          await ctx.page.getByText(/^Refreshed 1 times$/).waitFor()
        })
        assertUpdatedOnce(report, 'ProfilePanel', { kind: 'state', evidence: 'exact' })
        assertUpdatedOnce(report, 'ProfileCard', {
          kind: 'props',
          name: 'profile',
          referenceOnly: true,
        })
      },
    },
    {
      name: 'effect: each fruit filter runs the [query] effect once, and the next run cleans up the previous one',
      async run(ctx) {
        const filter = ctx.page.getByLabel('Filter fruit')
        await measure(ctx, async () => {
          await filter.fill('a')
          await waitForText(
            ctx.page,
            '[data-testid=matches]',
            'apple, apricot, banana, grape, mango, peach, pear',
          )
          await filter.fill('ap')
          await waitForText(ctx.page, '[data-testid=matches]', 'apple, apricot, grape')
        })
        const events = await ctx.call('react_effect_events', {
          component: 'EffectDemo',
          appOnly: false,
        })
        const executed = events.events
          .filter((event) => event.execution?.status === 'observed')
          .sort((left, right) => left.execution.startedAt - right.execution.startedAt)
        check(
          executed.length === 2,
          'two fills must run the [query] effect exactly twice',
          events.events,
        )
        check(
          executed.every((event) => JSON.stringify(event.changedDependencySlots) === '[0]'),
          'each run must blame the only dependency',
          executed,
        )
        const [first, second] = executed
        check(
          first.cleanupExecution?.status === 'observed' &&
            second.cleanupExecution?.status === 'unobserved',
          'the first run returned clearTimeout, so the second run must have cleaned it up; the second cleanup has not run yet',
          executed.map((event) => event.cleanupExecution),
        )
        await filter.fill('')
      },
    },
    {
      name: 'source: Counter resolves to its JSX callsite, mapped to page.tsx or honestly marked as a served chunk position',
      async run(ctx) {
        const found = await ctx.call('react_find_components', {
          component: 'Counter',
          exact: true,
          appOnly: false,
        })
        const source = found.matches[0]?.source
        check(source && typeof source.line === 'number', 'Counter must report a source', found)
        if (source.sourceMapConfidence === 'mapped') {
          check(
            source.file.endsWith('page.tsx') &&
              source.line === (await sourceLine(PAGE, '<Counter />')),
            'a mapped Counter source must be its <Counter /> callsite in app/page.tsx',
            source,
          )
          return
        }
        check(source.sourceMapConfidence === 'served', 'an unmapped source must say so', source)
        const servedLine = (await readFile(source.file, 'utf8')).split('\n')[source.line - 1] ?? ''
        check(
          /Counter/.test(servedLine),
          'a served source position must point at a line that renders Counter',
          { source, servedLine: servedLine.slice(0, 300) },
        )
      },
    },
    {
      name: 'query: ["greeting"] matches the DOM across a refetch; a simulated pending state restores',
      async run(ctx) {
        await openQueryDemo(ctx)
        const read = async () => {
          const query = await ctx.call('query_get', { queryKey: GREETING })
          const shown = await textOf(ctx.page, '[data-testid=greeting]')
          check(
            query.status === 'success' && query.data === shown,
            'query_get disagrees with the DOM',
            {
              data: query.data,
              shown,
            },
          )
          return query
        }
        const first = await read()
        await ctx.page.getByRole('button', { name: 'Refetch greeting' }).click()
        const second = await waitFor('the refetch to land', async () => {
          const value = await ctx.call('query_get', { queryKey: GREETING })
          return value.dataUpdateCount === first.dataUpdateCount + 1 && value.fetchStatus === 'idle'
            ? value
            : undefined
        })
        await waitForText(ctx.page, '[data-testid=greeting]', second.data)
        await read()
        await simulateQueryRoundTrip(ctx, {
          queryKey: GREETING,
          state: 'pending',
          selector: '[data-testid=greeting]',
          simulatedText: 'loading…',
          readyText: 'hello #',
        })
        await scratchQueryRoundTrip(ctx)
        await ctx.call('query_invalidate', { queryKey: GREETING, exact: true })
        await ctx.call('query_refetch', { queryKey: GREETING, exact: true })
        await ctx.call('query_fetch', { queryKey: GREETING, staleTime: 60_000 })
        await ctx.call('query_ensure', { queryKey: GREETING })
        await ctx.call('query_is_fetching', { queryKey: GREETING })
        await ctx.page.getByRole('button', { name: 'Run mutation' }).click()
        await waitForText(ctx.page, '[data-testid=mutation-log]', 'GENIE')
        const mutations = await ctx.call('query_list_mutations', {})
        const [mutation] = mutations.mutations
        check(
          mutations.mutations.length === 1 && mutation.variables === 'genie',
          'mutation list',
          mutations,
        )
        await ctx.call('mutation_get', { mutationId: mutation.mutationId })
        const rerun = await ctx.call('mutation_rerun', { mutationId: mutation.mutationId })
        check(rerun.ok === true && rerun.data === 'GENIE', 'mutation_rerun', rerun)
      },
    },
    {
      name: 'lab: a real suspension and a caught Bomb are reported with their boundaries; the theme context reads midnight',
      async run(ctx) {
        await ctx.open('/lab')
        await ctx.page.locator('[data-testid=themed-badge]').waitFor({ timeout: 20_000 })
        const context = await ctx.call('react_inspect_context', {
          id: await componentId(ctx, 'ThemedBadge'),
        })
        check(
          JSON.stringify(context).includes('midnight'),
          'ThemedBadge must consume "midnight"',
          context,
        )
        await ctx.page.getByRole('button', { name: 'Suspend for real' }).click()
        await ctx.page.locator('[data-testid=hold-fallback]').waitFor()
        await ctx.errors.expectErrors([/Bomb detonated/], async () => {
          await ctx.page.getByRole('button', { name: 'Detonate bomb' }).click()
          await waitForText(
            ctx.page,
            '[data-testid=boundary-caught]',
            'Boundary caught: Bomb detonated',
          )
        })
        const state = await waitFor('the held boundary', async () => {
          const value = await ctx.call('react_error_state', { appOnly: false })
          return value.suspended.length === 1 ? value : undefined
        })
        check(
          state.caughtErrors.length === 1 &&
            state.caughtErrors[0].message === 'Bomb detonated' &&
            state.caughtErrors[0].boundaryName === 'DemoErrorBoundary' &&
            state.suspended[0].forced === false,
          'react_error_state must report the caught Bomb and the real suspension',
          state,
        )
      },
    },
    {
      name: 'overrides: props, hook state, context, Suspense and error boundary apply across the App Router and reset',
      async run(ctx) {
        await ctx.open('/')
        await ctx.spec.ready(ctx)
        await overrideRoundTrip(ctx, {
          tool: 'react_override_props',
          args: {
            id: await componentId(ctx, 'ProfileCard'),
            props: { profile: { name: 'Grace Hopper', theme: 'light' } },
          },
          selector: '[data-testid=profile]',
          before: 'Ada Lovelace',
          after: 'Grace Hopper',
        })
        await overrideRoundTrip(ctx, {
          tool: 'react_override_hook_state',
          args: { id: await componentId(ctx, 'Counter'), stateIndex: 0, value: 41 },
          selector: '[data-testid=count]',
          before: 'Count:',
          after: 'Count: 41',
        })
        await ctx.open('/lab')
        await ctx.page.locator('[data-testid=themed-badge]').waitFor({ timeout: 20_000 })
        await overrideRoundTrip(ctx, {
          tool: 'react_override_context',
          args: { id: await componentId(ctx, 'ThemedBadge'), value: 'e2e-dawn' },
          selector: '[data-testid=themed-badge]',
          before: 'Active theme: midnight',
          after: 'Active theme: e2e-dawn',
        })
        await overrideRoundTrip(ctx, {
          tool: 'react_toggle_suspense_fallback',
          args: { id: await componentId(ctx, 'ReadyContent'), showFallback: true },
          selector: 'main',
          before: 'Suspense child ready',
          after: 'Loading suspense child…',
        })
        await ctx.errors.expectErrors([/Simulated error coming from DevTools/], async () =>
          overrideRoundTrip(ctx, {
            tool: 'react_force_error_boundary',
            args: { id: await componentId(ctx, 'Bomb') },
            selector: 'main',
            before: 'Bomb is safe',
            after: 'Boundary caught: Simulated error coming from DevTools',
          }),
        )
        await ctx.open('/')
        await ctx.spec.ready(ctx)
      },
    },
    measurementToolsStep({
      component: 'Counter',
      action: (ctx) => increment(ctx.page),
      timeline: { domains: ['react'], action: (ctx) => increment(ctx.page) },
    }),
  ],
  production: (context) =>
    assertNextProductionExcludesGenie(context, { readySelector: '[data-testid=count]' }),
}
