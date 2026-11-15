import { check, sourceLine, waitFor } from '../harness.mjs'
import { assertViteProductionExcludesGenie } from '../production.mjs'
import {
  assertSourceLine,
  assertUpdatedOnce,
  componentId,
  measure,
  measurementToolsStep,
  overrideRoundTrip,
  pluginBusStep,
  scratchQueryRoundTrip,
  simulateQueryRoundTrip,
  waitForText,
} from '../sequences.mjs'
import { startVite } from '../servers.mjs'

const APP = 'apps/vite-demo/src/App.tsx'
const PRICING = 'apps/vite-demo/src/PricingCard.tsx'
const GREETING = ['greeting']
const TASKS = ['tasks']

async function clickCount(page) {
  const button = page.getByRole('button', { name: /^Count is \d+$/ })
  const before = Number((await button.textContent()).replace(/\D/g, ''))
  await button.click()
  await page.getByRole('button', { name: `Count is ${before + 1}` }).waitFor()
  return before + 1
}

async function taskTitles(page) {
  return page.locator('[data-testid=task-list] li').allTextContents()
}

export default {
  name: 'vite-demo',
  dir: 'apps/vite-demo',
  hub: 'Vite plugin genie()',
  domains: ['session', 'react', 'query', 'timeline', 'memory', 'perf'],
  probeComponent: 'ThemeReadout',
  sweepArgs: {
    component: 'ThemeReadout',
    selector: '#pricing article',
    name: 'apps-e2e-sweep',
  },
  start: startVite,
  async ready({ page }) {
    await page.getByText('query: hello from query').waitFor({ timeout: 15_000 })
    await page.getByText('slow child loaded').waitFor({ timeout: 15_000 })
  },
  groundTruth: [
    {
      name: 'count click: App updates once for state; unstable props and context re-render their consumers',
      async run(ctx) {
        const report = await measure(ctx, () => clickCount(ctx.page))
        assertUpdatedOnce(report, 'App', { kind: 'state', evidence: 'exact' })
        assertUpdatedOnce(report, 'MemoChild', {
          kind: 'props',
          name: 'badge',
          referenceOnly: true,
        })
        assertUpdatedOnce(report, 'HotEffectProbe', { kind: 'props', name: 'count' })
        assertUpdatedOnce(report, 'ThemeReadout', { kind: 'context' })
      },
    },
    {
      name: 'effects: HotEffectProbe runs its effect on every render, and since each run follows a new count it is not flagged hot',
      async run(ctx) {
        await measure(ctx, async () => {
          for (let click = 0; click < 5; click++) await clickCount(ctx.page)
        })
        const events = await ctx.call('react_effect_events', {
          component: 'HotEffectProbe',
          appOnly: false,
        })
        const executed = events.events.filter((event) => event.execution?.status === 'observed')
        check(executed.length === 5, 'the [marker] effect must run once per render', events.events)
        const audit = await ctx.call('react_effect_audit', {
          component: 'HotEffectProbe',
          appOnly: false,
        })
        const effect = audit.components[0]?.effects[0]
        check(
          effect?.hotness.label === 'not-hot' &&
            effect.hotness.basis === 'value-change-reruns' &&
            effect.hotness.reruns.valueChanged === 5,
          'react_effect_audit must see that every run of the { count } effect followed a changed count',
          audit,
        )
      },
    },
    {
      name: 'source: ThemeReadout and MemoChild resolve to their JSX callsites in App.tsx',
      async run(ctx) {
        await assertSourceLine(ctx, 'ThemeReadout', {
          file: APP,
          line: await sourceLine(APP, '<ThemeReadout />'),
        })
        await assertSourceLine(ctx, 'MemoChild', {
          file: APP,
          line: await sourceLine(APP, "<MemoChild badge={{ text: 'lab' }} />"),
        })
      },
    },
    {
      name: 'query: ["greeting"] matches the DOM; the mutation rewrites it through setQueryData',
      async run(ctx) {
        const before = await ctx.call('query_get', { queryKey: GREETING })
        check(before.data?.message === 'hello from query', 'greeting data', before)
        await ctx.page.getByRole('button', { name: 'run mutation' }).click()
        await ctx.page.getByText('query: mutated greeting').waitFor()
        const after = await ctx.call('query_get', { queryKey: GREETING })
        check(
          after.data?.message === 'mutated greeting',
          'setQueryData must reach query_get',
          after,
        )
        const mutations = await ctx.call('query_list_mutations', {})
        const [mutation] = mutations.mutations
        check(
          mutations.mutations.length === 1 && mutation,
          'one mutation must be recorded',
          mutations,
        )
        await ctx.call('mutation_get', { mutationId: mutation.mutationId })
        const rerun = await ctx.call('mutation_rerun', {
          mutationId: mutation.mutationId,
          variables: 'rerun greeting',
        })
        check(rerun.ok === true && rerun.data === 'rerun greeting', 'mutation_rerun', rerun)
        await ctx.call('query_refetch', { queryKey: GREETING, exact: true })
        await ctx.page.getByText('query: hello from query').waitFor()
        await simulateQueryRoundTrip(ctx, {
          queryKey: GREETING,
          state: 'error',
          selector: '#lab',
          simulatedText: 'query: error',
          readyText: 'query: hello from query',
        })
        await scratchQueryRoundTrip(ctx)
        await ctx.call('query_invalidate', { queryKey: GREETING, exact: true })
        const fetched = await ctx.call('query_fetch', { queryKey: GREETING })
        check(fetched.status === 'success', 'query_fetch', fetched)
        await ctx.call('query_ensure', { queryKey: GREETING })
        await ctx.call('query_is_fetching', { queryKey: GREETING })
      },
    },
    {
      name: 'app tools: roles, flags and fixtures change the UI and restore',
      async run(ctx) {
        const { page } = ctx
        const session = await ctx.call('app_session', {})
        check(session.role === 'guest' && session.canAdd === false, 'initial session', session)
        await ctx.call('app_login_as', { role: 'admin' })
        await waitForText(page, '[data-testid=role]', 'admin')
        check(
          (await ctx.call('app_session', {})).canDelete === true,
          'admin must be able to delete',
        )
        await ctx.call('app_login_as', { role: 'guest' })
        await waitForText(page, '[data-testid=role]', 'guest')

        check((await ctx.call('app_flags', {})).beta_banner === false, 'beta flag starts off')
        await ctx.call('app_set_flag', { flag: 'beta_banner', value: true })
        await page.locator('[data-testid=beta-banner]').waitFor()
        await ctx.call('app_set_flag', { flag: 'beta_banner', value: false })
        await page.locator('[data-testid=beta-banner]').waitFor({ state: 'detached' })

        const initial = await taskTitles(page)
        const seeded = await ctx.call('app_seed_tasks', { count: 2 })
        check(seeded.created === 2 && seeded.total === initial.length + 2, 'seed result', seeded)
        await waitFor(
          'seeded tasks in the DOM',
          async () => (await taskTitles(page)).length === initial.length + 2,
        )
        const tasks = await ctx.call('query_get_data', { queryKey: TASKS })
        check(
          JSON.stringify(tasks).split('seeded task').length - 1 === 2,
          'tasks query data',
          tasks,
        )

        await ctx.call('app_chaos', { failNextRequests: 1 })
        await ctx.errors.expectErrors([/injected API failure/], async () => {
          await ctx.call('query_refetch', { queryKey: TASKS, exact: true })
          await page.getByRole('alert').waitFor()
          const failed = await ctx.call('query_get', { queryKey: TASKS })
          check(
            failed.status === 'error',
            'the injected failure must reach the tasks query',
            failed,
          )
        })
        await page.getByRole('button', { name: 'retry' }).click()
        await page.getByRole('alert').waitFor({ state: 'detached' })
        await ctx.call('app_chaos', { failNextRequests: 0 })

        const reset = await ctx.call('app_reset_tasks', {})
        check(reset.removed === initial.length + 2, 'reset removed every task', reset)
        await waitFor('empty task list', async () => (await taskTitles(page)).length === 0)
        const again = await ctx.cli.failure('app_reset_tasks', {})
        check(
          again.reason === 'tool_error' && again.details?.app?.code === 'NO_OP',
          'resetting an empty list must surface the app NO_OP code',
          again,
        )
        await ctx.open()
        await ctx.spec.ready(ctx)
        check((await taskTitles(page)).length === initial.length, 'reload restores the fixtures')
      },
    },
    {
      name: 'component-scoped tool: unmounting Unmountable tombstones app_unmountable_ping, remounting revives it',
      async run(ctx) {
        check((await ctx.call('app_unmountable_ping', {})).mounted === true, 'ping while mounted')
        const toggle = ctx.page.getByRole('button', { name: 'toggle unmountable' })
        await toggle.click()
        await ctx.page.getByText('unmountable is mounted').waitFor({ state: 'detached' })
        const gone = await waitFor('the tool to become unavailable', async () => {
          const result = await ctx.cli.run(['call', 'app_unmountable_ping', '{}'])
          return result.code === 1 ? result.json : undefined
        })
        check(gone.reason === 'tool_unavailable', 'an unmounted tool must be unavailable', gone)
        await toggle.click()
        await waitFor(
          'the tool to revive',
          async () => (await ctx.cli.run(['call', 'app_unmountable_ping', '{}'])).code === 0,
        )
      },
    },
    {
      name: 'stylex: the pricing card reports its StyleX rules and follows the featured toggle',
      async run(ctx) {
        const cardLine = await sourceLine(PRICING, '  card: {')
        const featuredLine = await sourceLine(PRICING, '  featured: {')
        const inspect = async () => {
          const value = await ctx.call('stylex_inspect', { selector: '#pricing article' })
          check(
            value.matched === 1 && value.elements[0].owner?.name === 'PricingCard',
            'owner',
            value,
          )
          return value.elements[0]
        }
        const declared = (element, property, condition = null) =>
          element.declarations.find((d) => d.property === property && d.condition === condition)
            ?.value
        const plain = await inspect()
        check(
          plain.styleObjects.some(
            (style) =>
              style.file === 'src/PricingCard.tsx' &&
              style.line === cardLine &&
              style.name === 'styles.card',
          ),
          'styles.card must resolve to its stylex.create entry',
          plain.styleObjects,
        )
        check(declared(plain, 'background-color') === 'rgb(26, 26, 46)', 'card background', plain)
        check(
          declared(plain, 'border-color', ':hover') === 'rgb(154, 160, 255)',
          'hover border',
          plain,
        )
        await ctx.page.getByRole('button', { name: 'toggle featured' }).click()
        const featured = await waitFor('featured styles', async () => {
          const element = await inspect()
          return element.styleObjects.some((style) => style.name === 'emphasis.featured')
            ? element
            : undefined
        })
        check(
          featured.styleObjects.find((style) => style.name === 'emphasis.featured')?.line ===
            featuredLine,
          'emphasis.featured must resolve to its stylex.create entry',
          featured.styleObjects,
        )
        check(
          declared(featured, 'padding') === '28px',
          'featured padding overrides the card',
          featured,
        )
        await ctx.page.getByRole('button', { name: 'toggle featured' }).click()
      },
    },
    {
      name: 'errors and overrides: Bomb is caught by LabErrorBoundary; a props override applies and resets',
      async run(ctx) {
        await overrideRoundTrip(ctx, {
          tool: 'react_override_props',
          args: { id: await componentId(ctx, 'MemoChild'), props: { badge: { text: 'e2e' } } },
          selector: '#lab',
          before: 'memo child badge: lab',
          after: 'memo child badge: e2e',
        })
        await overrideRoundTrip(ctx, {
          tool: 'react_override_hook_state',
          args: { id: await componentId(ctx, 'TaskPanel'), stateIndex: 0, value: 'admin' },
          selector: '[data-testid=role]',
          before: 'guest',
          after: 'admin',
        })
        await overrideRoundTrip(ctx, {
          tool: 'react_override_context',
          args: {
            id: await componentId(ctx, 'ThemeReadout'),
            value: { label: 'e2e', accent: '#000' },
          },
          selector: '#lab',
          before: 'theme label: lab',
          after: 'theme label: e2e',
        })
        await overrideRoundTrip(ctx, {
          tool: 'react_toggle_suspense_fallback',
          args: { id: await componentId(ctx, 'LoadedSlowChild'), showFallback: true },
          selector: '#lab',
          before: 'slow child loaded',
          after: 'loading slow child…',
        })
        await ctx.errors.expectErrors([/Simulated error coming from DevTools/], async () =>
          overrideRoundTrip(ctx, {
            tool: 'react_force_error_boundary',
            args: { id: await componentId(ctx, 'Bomb') },
            selector: '#lab',
            before: 'bomb is stable',
            after: 'boundary caught: Simulated error coming from DevTools',
          }),
        )
        await ctx.open()
        await ctx.spec.ready(ctx)
        await ctx.errors.expectErrors([/Bomb detonated/], async () => {
          await ctx.page.getByRole('button', { name: 'throw in bomb' }).click()
          await ctx.page.getByText('boundary caught: Bomb detonated').waitFor()
        })
        const state = await ctx.call('react_error_state', { appOnly: false })
        const [caught] = state.caughtErrors
        check(
          state.caughtErrors.length === 1 &&
            caught.message === 'Bomb detonated' &&
            caught.boundaryName === 'LabErrorBoundary' &&
            caught.forced === false,
          'react_error_state must report the real error and its boundary',
          state.caughtErrors,
        )
        await ctx.page.getByRole('button', { name: 'reset boundary' }).click()
        await ctx.page.getByText('bomb is stable').waitFor()
      },
    },
    pluginBusStep(),
    measurementToolsStep({
      component: 'App',
      action: (ctx) => clickCount(ctx.page),
      timeline: {
        domains: ['query', 'react'],
        action: async (ctx) => {
          await ctx.call('query_refetch', { queryKey: GREETING, exact: true })
          await ctx.page.getByText('query: hello from query').waitFor()
        },
      },
    }),
  ],
  production: (context) => assertViteProductionExcludesGenie(context, { readySelector: '#lab' }),
}
