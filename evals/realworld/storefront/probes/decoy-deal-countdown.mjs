import { describeVerdicts, isClean, verdicts } from './support.mjs'

const OBSERVED_TICKS_MS = 3_300

/** @param {import('../../run-probes.mjs').ProbeContext} ctx */
export async function probe(ctx) {
  const page = await ctx.open('/')
  await page.getByTestId('deals').waitFor()
  await ctx.quiesce()
  await ctx.call('react_clear_renders', {
    components: ['DealCountdown'],
    budget: { adaptive: true },
  })
  await page.waitForTimeout(OBSERVED_TICKS_MS)
  const result = await verdicts(ctx, 'DealCountdown')
  ctx.check(
    'ticking countdown is necessary work with a stable interval',
    result.updates >= 2 && result.effectRuns === 0 && isClean(result),
    describeVerdicts('DealCountdown', result),
  )
}
