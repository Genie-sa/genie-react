import { DEFAULT_MAX_BYTES } from './cli-output'
import { describeFailure, formatAgentFailure } from './failure'
import { runDoctor, runLiveDoctor } from './index'
import { renderBoundedJson, renderBoundedText, selectResult } from './result-selection'
import { CLI_OUTPUT_SCHEMA_VERSION } from './schema-version'

export interface DoctorCommandOptions {
  cwd?: string
  live: boolean
  session?: string
  select?: string
  maxBytes?: number
}

/** `genie-react doctor`: setup checks as one JSON result; a bad --select is reported like any other command's. */
export async function runDoctorCommand(options: DoctorCommandOptions): Promise<number> {
  const logger = { info: () => undefined, error: () => undefined }
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  try {
    const result = options.live
      ? await runLiveDoctor({ cwd: options.cwd, logger, session: options.session })
      : runDoctor({ cwd: options.cwd, logger })
    const envelope = {
      ...result,
      schemaVersion: CLI_OUTPUT_SCHEMA_VERSION,
      status: result.ok ? 'ok' : 'error',
      reason: result.ok ? 'checks_passed' : 'checks_failed',
      message: result.ok
        ? 'Setup checks passed.'
        : 'Setup checks failed. Follow the reported remediation steps.',
      userActionRequired: !result.ok,
    }
    const selected =
      options.select === undefined ? envelope : selectResult(envelope, options.select)
    process.stdout.write(`${renderBoundedJson(selected, maxBytes)}\n`)
    return result.ok ? 0 : 1
  } catch (error) {
    const { reason, message, ...failure } = await describeFailure(error, {})
    process.stdout.write(
      `${renderBoundedText(formatAgentFailure(reason, `Doctor failed. ${message}`, failure), maxBytes)}\n`,
    )
    return 1
  }
}
