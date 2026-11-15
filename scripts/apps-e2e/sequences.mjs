import { check, waitFor } from './harness.mjs'

export async function componentId(ctx, name, { index = 0, count } = {}) {
  const found = await ctx.call('react_find_components', {
    component: name,
    exact: true,
    appOnly: false,
    limit: 50,
  })
  if (count !== undefined) {
    check(found.matches.length === count, `${name}: expected ${count} mounted instance(s)`, found)
  }
  const match = found.matches[index]
  check(match?.name === name, `${name} is not mounted`, found)
  return match.id
}

export async function textOf(page, selector) {
  return (await page.locator(selector).first().textContent())?.trim() ?? ''
}

export async function waitForText(page, selector, expected, timeout = 10_000) {
  await page.waitForFunction(
    ([target, text]) => document.querySelector(target)?.textContent?.includes(text),
    [selector, expected],
    { timeout },
  )
}

/** Clears render evidence, runs one interaction, requires React to go idle, then returns the full render report. */
export async function measure(ctx, action, { appOnly = false } = {}) {
  const cleared = await ctx.call('react_clear_renders', {})
  check(
    cleared.ok === true && cleared.tracking === true,
    'react_clear_renders did not start',
    cleared,
  )
  await action()
  const quiet = await ctx.call('react_quiesce', { idleMs: 300, timeoutMs: 10_000 })
  check(quiet.outcome === 'idle', 'React did not go idle after the interaction', quiet)
  const report = await ctx.call('react_get_renders', { appOnly, limit: 200 })
  check(report.coverage?.complete === true, 'render coverage is incomplete', report.coverage)
  check(
    report.observation?.id === cleared.observation?.id,
    'render report belongs to another observation',
    { cleared: cleared.observation, report: report.observation },
  )
  return report
}

function rendersOf(report, name) {
  return report.components.filter((component) => component.name === name)
}

export function assertUpdatedOnce(report, name, cause) {
  const rows = rendersOf(report, name)
  check(rows.length === 1, `${name}: expected one tracked instance`, report.components)
  const [row] = rows
  check(row.updates === 1, `${name}: expected exactly one update, got ${row.updates}`, row)
  if (!cause) return row
  const matched = row.causes.some(
    (candidate) =>
      candidate.kind === cause.kind &&
      (cause.name === undefined || candidate.name === cause.name) &&
      (cause.evidence === undefined || candidate.evidence === cause.evidence) &&
      (cause.referenceOnly === undefined || candidate.referenceOnly === cause.referenceOnly),
  )
  check(matched, `${name}: missing cause ${JSON.stringify(cause)}`, row.causes)
  return row
}

export function assertNotRendered(report, name) {
  check(rendersOf(report, name).length === 0, `${name} must not render`, rendersOf(report, name))
}

export async function assertSourceLine(ctx, component, { file, line }) {
  const found = await ctx.call('react_find_components', { component, exact: true, appOnly: false })
  const source = found.matches[0]?.source
  check(source, `${component}: no source reported`, found)
  const basename = file.split('/').pop()
  const reportedBase = String(source.file).split(/[\\/]/).pop()
  check(
    reportedBase === basename && source.line === line,
    `${component}: source must be ${basename}:${line} (its JSX callsite)`,
    source,
  )
  check(source.sourceMapConfidence !== 'unknown', `${component}: source confidence unknown`, source)
}

/** Applies one override, checks the visible DOM change, then resets every override and checks the DOM and the override list are back to the original. */
export async function overrideRoundTrip(ctx, { tool, args, selector, before, after, during }) {
  const { page } = ctx
  await waitForText(page, selector, before)
  const applied = await ctx.call(tool, args)
  check(applied.ok === true, `${tool} did not apply`, applied)
  await waitForText(page, selector, after)
  await during?.()
  const listed = await ctx.call('react_list_overrides', {})
  check(listed.total >= 1, `${tool}: override missing from react_list_overrides`, listed)
  const reset = await ctx.call('react_reset_overrides', {})
  check(reset.ok === true && reset.remaining === 0, `${tool}: reset left overrides`, reset)
  await waitForText(page, selector, before)
  const after2 = await ctx.call('react_list_overrides', {})
  check(after2.total === 0, `${tool}: overrides remain after reset`, after2)
}

/** Simulates a Query state, checks the UI reflects it, restores it and checks the real data and status come back. */
export async function simulateQueryRoundTrip(
  ctx,
  { queryKey, state, selector, simulatedText, readyText },
) {
  const before = await ctx.call('query_get', { queryKey })
  check(before.status === 'success', `${JSON.stringify(queryKey)} must start successful`, before)
  const simulated = await ctx.call('query_simulate_state', { queryKey, state })
  check(simulated.ok === true && simulated.simulatedState === state, 'simulate failed', simulated)
  if (selector) await waitForText(ctx.page, selector, simulatedText)
  const during = await ctx.call('query_get', { queryKey })
  check(during.status === state, `query_get must report the simulated ${state} state`, during)
  const restored = await ctx.call('query_restore_state', { queryKey })
  check(
    restored.ok === true && restored.restored === 1,
    'restore did not restore one query',
    restored,
  )
  if (selector) await waitForText(ctx.page, selector, readyText)
  const after = await ctx.call('query_get', { queryKey })
  check(after.status === 'success', 'restored query must be successful', after)
  check(
    JSON.stringify(after.data) === JSON.stringify(before.data),
    'restored query data differs from the original',
    { before: before.data, after: after.data },
  )
}

/** Navigates with the router tool, checks Genie, the router, the URL and the DOM agree, then goes back and checks the original route is restored. */
export async function navigateRoundTrip(ctx, { to, selector, text, origin = '/' }) {
  const { page } = ctx
  const navigated = await ctx.call('router_navigate', { to })
  check(navigated.ok !== false, 'router_navigate failed', navigated)
  await waitForText(page, selector, text)
  const state = await waitFor('router to settle', async () => {
    const value = await ctx.call('router_get_state', {})
    return value.status === 'idle' && value.pathname === to ? value : undefined
  })
  check(new URL(page.url()).pathname === to, 'browser URL disagrees with router_get_state', {
    browser: page.url(),
    state,
  })
  check(state.locationSync === 'matched', 'router and browser location are out of sync', state)
  const matches = await ctx.call('router_list_matches', {})
  check(
    JSON.stringify(matches).includes(JSON.stringify(to)),
    `router_list_matches does not include ${to}`,
    matches,
  )
  const back = await ctx.call('router_history', { action: 'back' })
  check(back.ok === true, 'router_history back failed', back)
  await waitFor(`back at ${origin}`, async () => new URL(page.url()).pathname === origin)
  const restored = await waitFor('router back to the origin', async () => {
    const value = await ctx.call('router_get_state', {})
    return value.status === 'idle' && value.pathname === origin ? value : undefined
  })
  return restored
}

/** Captures twice, pins and unpins one, and requires the comparison to refuse a verdict on one sample per cohort. */
async function captureRoundTrip(ctx) {
  const first = await ctx.call('devtools_capture_create', { name: 'apps-e2e-baseline' })
  const second = await ctx.call('devtools_capture_create', { name: 'apps-e2e-candidate' })
  const ids = [first, second].map((capture) => capture.captureId ?? capture.id)
  check(
    ids.every((id) => typeof id === 'string'),
    'capture create returned no id',
    [first, second],
  )
  const pinned = await ctx.call('devtools_capture_pin', { captureId: ids[0], pinned: true })
  check(JSON.stringify(pinned).includes('true'), 'capture pin did not report the pin', pinned)
  const listed = await ctx.call('devtools_capture_list', {})
  check(
    ids.every((id) => JSON.stringify(listed).includes(id)),
    'capture list misses created captures',
    listed,
  )
  const read = await ctx.call('devtools_capture_read', { captureId: ids[0] })
  check(JSON.stringify(read).includes('apps-e2e-baseline'), 'capture read lost its name', read)
  await ctx.call('devtools_capture_pin', { captureId: ids[0], pinned: false })
  const compared = await ctx.call('devtools_capture_compare', {
    baselineCaptureIds: [ids[0]],
    candidateCaptureIds: [ids[1]],
  })
  const verdicts = JSON.stringify(compared)
  check(
    !/"(verdict|outcome|status)":"pass"/.test(verdicts),
    'one capture per cohort must never produce a passing comparison',
    compared,
  )
  return compared
}

/** Runs one named bridge interaction around an action and requires the summary to name the component the action renders. */
async function interactionRoundTrip(ctx, { name, component, action }) {
  const begun = await ctx.call('devtools_interaction_begin', { name, components: [component] })
  check(typeof begun.interactionId === 'string', 'interaction begin returned no id', begun)
  await action()
  const stopped = await ctx.call('devtools_interaction_stop', {
    interactionId: begun.interactionId,
    view: 'full',
    sections: ['renders'],
  })
  check(
    JSON.stringify(stopped).includes(`"${component}"`),
    `interaction evidence does not mention ${component}`,
    stopped,
  )
  return stopped
}

/** Opens a labelled span, renders twice inside it, and requires the span to count exactly those updates. */
async function spanRoundTrip(ctx, { component, action }) {
  const span = await ctx.call('react_measure', { label: 'apps-e2e span' })
  await action()
  await action()
  await ctx.call('react_quiesce', { idleMs: 300, timeoutMs: 10_000 })
  const since = await ctx.call('react_renders_since', {
    handle: span.handle,
    close: true,
    component,
    appOnly: false,
  })
  const row = since.components.find((candidate) => candidate.name === component)
  check(row?.updates === 2, `span must count two ${component} updates`, since)
}

async function profileRoundTrip(ctx, action) {
  const started = await ctx.call('react_profile_start', {})
  check(started.ok === true && started.tracking === true, 'profile did not start', started)
  await action()
  await ctx.call('react_quiesce', { idleMs: 300, timeoutMs: 10_000 })
  const stopped = await ctx.call('react_profile_stop', {})
  check(stopped.ok === true && stopped.tracking === false, 'profile did not stop', stopped)
  check(stopped.commits >= 1, 'profile recorded no commit for the interaction', stopped)
}

/** Writes a scratch query the app never reads, reads it back, then removes it, so no app state is touched. */
export async function scratchQueryRoundTrip(ctx) {
  const queryKey = ['apps-e2e', 'scratch']
  const data = { marker: 'apps-e2e', at: 1 }
  await ctx.call('query_set_data', { queryKey, data })
  const read = await ctx.call('query_get_data', { queryKey })
  check(
    JSON.stringify(read).includes('"marker":"apps-e2e"'),
    'query_set_data did not persist',
    read,
  )
  const removed = await ctx.call('query_remove', { queryKey, exact: true })
  check(removed.ok !== false, 'query_remove failed', removed)
  const gone = await ctx.cli.failure('query_get', { queryKey })
  check(gone.reason === 'tool_error', 'a removed query must be reported missing', gone)
  const light = await ctx.call('query_get_data', { queryKey })
  check(light.found === false, 'query_get_data must report found:false for a removed query', light)
}

async function timelineRoundTrip(ctx, { name, action, domains }) {
  const started = await ctx.call('timeline_start', { name })
  await action()
  await ctx.call('react_quiesce', { idleMs: 300, timeoutMs: 10_000 })
  await ctx.call('timeline_stop', { id: started.id })
  const report = await ctx.call('timeline_read', { id: started.id, limit: 1000 })
  for (const domain of domains) {
    check(report.coverage?.[domain]?.status === 'available', `${domain} lane unavailable`, report)
    check(
      report.events.some((event) => event.domain === domain),
      `${domain} lane recorded no event for the interaction`,
      report.events.map((event) => `${event.domain}:${event.type}`),
    )
  }
  return report
}

/** One step that drives span, profile, interaction, capture and timeline tools around the same interaction. */
export function measurementToolsStep({ component, action, timeline, setup }) {
  return {
    name: `measurement tools: span, profile, interaction, capture and timeline agree on ${component}`,
    async run(ctx) {
      await setup?.(ctx)
      await spanRoundTrip(ctx, { component, action: () => action(ctx) })
      await profileRoundTrip(ctx, () => action(ctx))
      await interactionRoundTrip(ctx, {
        name: `apps-e2e ${component}`,
        component,
        action: () => action(ctx),
      })
      await captureRoundTrip(ctx)
      await timeline.setup?.(ctx)
      await timelineRoundTrip(ctx, {
        name: `apps-e2e ${component} timeline`,
        domains: timeline.domains,
        action: () => timeline.action(ctx),
      })
    },
  }
}

/** Emits a marker event on the DevTools bus and requires the buffer to agree with the emit result: buffered when it reports ok, absent when it reports no bus. */
export function pluginBusStep() {
  return {
    name: 'plugin bus: an emitted marker event is buffered exactly when plugin_emit reports a bus',
    async run(ctx) {
      const marker = { marker: `apps-e2e-${Date.now()}` }
      const emitted = await ctx.call('plugin_emit', {
        pluginId: 'apps-e2e',
        type: 'probe',
        payload: marker,
      })
      const events = await ctx.call('plugin_get_events', { pluginId: 'apps-e2e', limit: 200 })
      const buffered = events.events.some((event) => JSON.stringify(event).includes(marker.marker))
      check(buffered === (emitted.ok === true), 'plugin_emit and plugin_get_events disagree', {
        emitted,
        events,
      })
      if (!buffered) return
      const listed = await ctx.call('plugin_list', {})
      check(
        JSON.stringify(listed).includes('"apps-e2e"'),
        'plugin_list misses the emitting plugin',
        listed,
      )
    },
  }
}
