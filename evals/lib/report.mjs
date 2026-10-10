import { passAtK, passHatK } from './grade.mjs'

/**
 * @typedef {{
 *   task: string,
 *   split: string,
 *   mode: string,
 *   pass: boolean,
 *   runtimeEvidence: boolean,
 *   failure: string | null,
 *   genieCalls: number,
 *   browserCalls: number,
 *   tokens: number,
 *   costUsd: number | null,
 *   wallMs: number,
 *   genieErrorReasons: Record<string, number>,
 * }} TrialSummary
 * @typedef {{
 *   task: string,
 *   split: string,
 *   mode: string,
 *   trials: number,
 *   passed: number,
 *   passAt1: number | null,
 *   passAtK: number | null,
 *   passHatK: number | null,
 *   runtimeEvidenceRate: number,
 *   meanGenieCalls: number,
 *   meanBrowserCalls: number,
 *   meanTokens: number,
 *   meanCostUsd: number | null,
 *   meanWallSeconds: number,
 *   genieErrorReasons: Record<string, number>,
 *   failures: string[],
 * }} TaskSummary
 */

/**
 * @param {number[]} values
 */
function mean(values) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

/**
 * @param {TrialSummary[]} trials
 * @returns {TaskSummary[]}
 */
export function summarizeTasks(trials) {
  /** @type {Map<string, TrialSummary[]>} */
  const byTask = new Map()
  for (const trial of trials) byTask.set(trial.task, [...(byTask.get(trial.task) ?? []), trial])

  return [...byTask.values()].map((taskTrials) => {
    const [first] = taskTrials
    if (!first) throw new Error('summarizeTasks received an empty task group')
    const n = taskTrials.length
    const passed = taskTrials.filter((trial) => trial.pass).length
    const costs = taskTrials.flatMap((trial) => (trial.costUsd === null ? [] : [trial.costUsd]))
    /** @type {Record<string, number>} */
    const genieErrorReasons = {}
    for (const trial of taskTrials) {
      for (const [reason, total] of Object.entries(trial.genieErrorReasons)) {
        genieErrorReasons[reason] = (genieErrorReasons[reason] ?? 0) + total
      }
    }
    return {
      task: first.task,
      split: first.split,
      mode: first.mode,
      trials: n,
      passed,
      passAt1: passAtK(n, passed, 1),
      passAtK: passAtK(n, passed, n),
      passHatK: passHatK(n, passed, n),
      runtimeEvidenceRate: taskTrials.filter((trial) => trial.runtimeEvidence).length / n,
      meanGenieCalls: mean(taskTrials.map((trial) => trial.genieCalls)),
      meanBrowserCalls: mean(taskTrials.map((trial) => trial.browserCalls)),
      meanTokens: mean(taskTrials.map((trial) => trial.tokens)),
      meanCostUsd: costs.length === 0 ? null : mean(costs),
      meanWallSeconds: mean(taskTrials.map((trial) => trial.wallMs)) / 1000,
      genieErrorReasons,
      failures: taskTrials.flatMap((trial) => (trial.failure ? [trial.failure] : [])),
    }
  })
}

/**
 * @param {number | null} value
 */
function percent(value) {
  return value === null ? 'n/a' : `${Math.round(value * 100)}%`
}

/**
 * @param {number} value
 */
function compact(value) {
  return value >= 10_000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(value % 1 === 0 ? 0 : 1)
}

/**
 * @param {{ id: string, agent: string, model: string | null, trialsPerTask: number, isolation: string }} run
 * @param {TaskSummary[]} tasks
 */
export function renderMarkdown(run, tasks) {
  const k = run.trialsPerTask
  const rateHeaders = k === 1 ? ['pass@1'] : ['pass@1', `pass@${k}`, `pass^${k}`]
  const headers = [
    'Task',
    'Split',
    'Mode',
    'Passed',
    ...rateHeaders,
    'Runtime evidence',
    'Genie calls',
    'Browser calls',
    'Tokens',
    'Cost',
    'Wall s',
    'Genie errors',
  ]
  const lines = [
    `# Genie agent eval ${run.id}`,
    '',
    `Agent: ${run.agent}${run.model ? ` (${run.model})` : ''} · trials per task: ${k} · isolation: ${run.isolation}`,
    '',
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
  ]
  for (const task of tasks) {
    const errors = Object.entries(task.genieErrorReasons)
      .map(([reason, total]) => `${reason}×${total}`)
      .join(', ')
    const rates = k === 1 ? [task.passAt1] : [task.passAt1, task.passAtK, task.passHatK]
    const cells = [
      task.task,
      task.split,
      task.mode,
      `${task.passed}/${task.trials}`,
      ...rates.map(percent),
      percent(task.runtimeEvidenceRate),
      compact(task.meanGenieCalls),
      compact(task.meanBrowserCalls),
      compact(task.meanTokens),
      task.meanCostUsd === null ? 'n/a' : `$${task.meanCostUsd.toFixed(2)}`,
      task.meanWallSeconds.toFixed(0),
      errors || '-',
    ]
    lines.push(`| ${cells.join(' | ')} |`)
  }
  return `${lines.join('\n')}\n`
}
