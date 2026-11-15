import { readFile } from 'node:fs/promises'
import { run } from '../../lib/process.mjs'

const CLI_TIMEOUT_MS = 60_000
const STRIPPED_ENV = [
  'GENIE_BRIDGE_URL',
  'GENIE_BRIDGE_PORT',
  'GENIE_BRIDGE_TOKEN',
  'GENIE_SESSION',
]

export class GenieCallError extends Error {
  /**
   * @param {string} message
   * @param {unknown} result
   */
  constructor(message, result) {
    super(message)
    this.name = 'GenieCallError'
    this.result = result
  }
}

/**
 * Binds the built CLI to one app checkout, hub runtime directory and session; every call passes `--json`.
 * @param {{ cliPath: string, cwd: string, runtimeDir: string, session: string }} options
 */
export function createGenieCli({ cliPath, cwd, runtimeDir, session }) {
  /** @type {NodeJS.ProcessEnv} */
  const env = { ...process.env, XDG_RUNTIME_DIR: runtimeDir }
  for (const key of STRIPPED_ENV) delete env[key]

  /**
   * @param {string[]} args
   * @returns {Promise<{ code: number | null, json: any }>}
   */
  async function exec(args) {
    const result = await run(process.execPath, [cliPath, ...args, '--session', session, '--json'], {
      cwd,
      env,
      timeoutMs: CLI_TIMEOUT_MS,
    })
    let json
    try {
      json = JSON.parse(result.stdout)
    } catch {
      throw new GenieCallError(
        `genie-react ${args[0]} ${args[1] ?? ''} returned non-JSON (exit ${result.code}): ${result.stdout.slice(0, 500)}${result.stderr.slice(0, 500)}`,
        null,
      )
    }
    return { code: result.code, json }
  }

  return {
    /**
     * Calls one tool and returns its result, throwing when the CLI reports a failure.
     * @param {string} tool
     * @param {Record<string, unknown>} [args]
     */
    async call(tool, args = {}) {
      const { code, json } = await exec(['call', tool, JSON.stringify(args)])
      if (code !== 0 || json?.status === 'error') {
        throw new GenieCallError(
          `${tool} failed: ${json?.reason ?? 'unknown'} ${json?.message ?? ''}`.trim(),
          json,
        )
      }
      if (json?.status === 'truncated') {
        if (typeof json.outputPath !== 'string')
          throw new GenieCallError(`${tool} output was truncated without a saved copy`, json)
        return JSON.parse(await readFile(json.outputPath, 'utf8'))
      }
      return json
    },
    /**
     * @param {number} timeoutMs
     */
    async waitReady(timeoutMs) {
      const { code, json } = await exec(['status', '--wait', String(timeoutMs)])
      if (code !== 0 || json?.ready !== true) {
        throw new GenieCallError(
          `Genie session ${session} did not become ready: ${json?.reason ?? ''} ${json?.message ?? ''}`.trim(),
          json,
        )
      }
      return json
    },
  }
}
