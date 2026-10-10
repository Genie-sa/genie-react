import { appendFile, readFile } from 'node:fs/promises'

/**
 * @typedef {{ task: string, split: string, mode: string, trial: number, agent: string, model: string | null }} TrialIdentity
 */

/**
 * Runs one trial; a harness error becomes a failed trial record so the remaining trials still run.
 * @template {object} Record
 * @param {TrialIdentity} identity
 * @param {() => Promise<Record>} execute
 */
export async function isolateTrial(identity, execute) {
  const startedAt = Date.now()
  try {
    return await execute()
  } catch (error) {
    return {
      ...identity,
      pass: false,
      failure: `harness: ${error instanceof Error ? error.message : String(error)}`,
      checks: [],
      runtimeEvidence: false,
      deniedBeforeGenie: false,
      genieCalls: 0,
      browserCalls: 0,
      genieErrorReasons: {},
      tokens: 0,
      costUsd: null,
      wallMs: Date.now() - startedAt,
    }
  }
}

/**
 * @param {string} path
 * @param {unknown} record
 */
export async function appendTrial(path, record) {
  await appendFile(path, `${JSON.stringify(record)}\n`)
}

/**
 * @param {string} path
 * @returns {Promise<any[]>}
 */
export async function readTrials(path) {
  return (await readFile(path, 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}
