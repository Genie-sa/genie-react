import { effectOrdinal } from './helpers.mjs'

/** @param {import('../../lib/probe-context.mjs').ProbeContext} ctx */
export default async function probe(ctx) {
  await ctx.signIn()
  await ctx.open('/')
  await ctx.settle()
  const ordinal = effectOrdinal(
    await ctx.inspect('NotificationBell'),
    (hooks) => hooks.length === 0,
  )
  const timeline = await ctx.genie.call('react_effect_timeline', {
    component: 'NotificationBell',
    limit: 200,
  })
  const runs = (timeline.events ?? []).filter(
    (/** @type {any} */ event) =>
      event.effectIndex === ordinal && event.execution?.status === 'observed',
  )
  const replayed = runs.some(
    (/** @type {any} */ event) => event.execution?.trigger === 'strict-mode-replay',
  )
  const withoutCleanup = runs.filter(
    (/** @type {any} */ event) => event.cleanupExecution?.reason === 'no-cleanup-returned',
  )
  const live = await ctx.genie.call('app_live_updates', {})
  ctx.check(
    'strict-mode-replay-labelled',
    replayed,
    `subscribe effect runs: ${runs.length}, labelled strict-mode-replay: ${replayed}`,
  )
  ctx.check(
    'cleanup-observed',
    withoutCleanup.length === 0,
    `runs reported without a cleanup: ${withoutCleanup.length}`,
  )
  ctx.check(
    'single-listener',
    live.topics?.['*'] === 1,
    `wildcard live-update listeners: ${live.topics?.['*']}`,
  )
}
