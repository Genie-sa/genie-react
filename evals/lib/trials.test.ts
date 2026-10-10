import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { appendTrial, isolateTrial, readTrials } from './trials.mjs'

const identity = {
  task: 'memo-object-prop',
  split: 'dev',
  mode: 'diagnose',
  trial: 2,
  agent: 'claude',
  model: 'sonnet',
}

describe('isolateTrial', () => {
  it('returns the trial record when the trial completes', async () => {
    expect(await isolateTrial(identity, async () => ({ pass: true }))).toEqual({ pass: true })
  })

  it('turns a harness error into a failed record that summaries accept', async () => {
    const record = await isolateTrial(identity, async () => {
      throw new Error('vite exited')
    })
    expect(record).toMatchObject({
      ...identity,
      pass: false,
      failure: 'harness: vite exited',
      runtimeEvidence: false,
      deniedBeforeGenie: false,
      genieCalls: 0,
      browserCalls: 0,
      tokens: 0,
      costUsd: null,
      genieErrorReasons: {},
    })
  })
})

describe('trial log', () => {
  let dir = ''
  afterEach(() => rm(dir, { recursive: true, force: true }))

  it('appends one record per line and reads them back in order', async () => {
    dir = await mkdtemp(join(tmpdir(), 'genie-eval-trials-'))
    const path = join(dir, 'run.jsonl')
    await appendTrial(path, { trial: 1, pass: true })
    await appendTrial(path, { trial: 2, pass: false })
    expect(await readTrials(path)).toEqual([
      { trial: 1, pass: true },
      { trial: 2, pass: false },
    ])
  })
})
