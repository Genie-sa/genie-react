import { describe, expect, it } from 'vitest'
import { renderMarkdown, summarizeTasks } from './report.mjs'

function trial(pass: boolean, overrides: Record<string, unknown> = {}) {
  return {
    task: 'memo-object-prop',
    split: 'dev',
    mode: 'diagnose',
    pass,
    runtimeEvidence: pass,
    failure: null,
    genieCalls: 4,
    browserCalls: 2,
    tokens: 1000,
    costUsd: 0.5,
    wallMs: 30_000,
    genieErrorReasons: { busy: 1 },
    ...overrides,
  }
}

describe('summarizeTasks', () => {
  it('aggregates pass rates, means and error reasons per task', () => {
    const [summary] = summarizeTasks([
      trial(true),
      trial(false, { genieCalls: 8, tokens: 3000, costUsd: null, failure: 'timeout' }),
      trial(true, { genieErrorReasons: {} }),
    ])
    expect(summary).toMatchObject({
      task: 'memo-object-prop',
      trials: 3,
      passed: 2,
      passAtK: 1,
      passHatK: 0,
      meanGenieCalls: 16 / 3,
      meanTokens: 5000 / 3,
      meanCostUsd: 0.5,
      meanWallSeconds: 30,
      runtimeEvidenceRate: 2 / 3,
      genieErrorReasons: { busy: 2 },
      failures: ['timeout'],
    })
    expect(summary?.passAt1).toBeCloseTo(2 / 3)
  })
})

describe('renderMarkdown', () => {
  it('renders one row per task with k in the headers', () => {
    const markdown = renderMarkdown(
      { id: 'run-1', agent: 'claude', model: 'sonnet', trialsPerTask: 2 },
      summarizeTasks([trial(true), trial(true, { tokens: 30_000 })]),
    )
    expect(markdown).toContain(
      '| Task | Split | Mode | Passed | pass@1 | pass@2 | pass^2 | Runtime evidence | Genie calls |',
    )
    expect(markdown).toContain(
      '| memo-object-prop | dev | diagnose | 2/2 | 100% | 100% | 100% | 100% | 4 | 2 | 16k | $0.50 | 30 | busy×2 |',
    )
  })

  it('shows a single pass rate for one trial per task', () => {
    const markdown = renderMarkdown(
      { id: 'run-2', agent: 'codex', model: null, trialsPerTask: 1 },
      summarizeTasks([trial(false, { costUsd: null, genieErrorReasons: {} })]),
    )
    expect(markdown).toContain('| Task | Split | Mode | Passed | pass@1 | Runtime evidence |')
    expect(markdown).toContain(
      '| memo-object-prop | dev | diagnose | 0/1 | 0% | 0% | 4 | 2 | 1000 | n/a | 30 | - |',
    )
  })
})
