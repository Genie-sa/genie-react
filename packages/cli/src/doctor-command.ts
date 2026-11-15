import { DEFAULT_MAX_BYTES, renderEnvelopeText, renderFailure, renderOutput } from './cli-output'
import { renderDoctorText } from './doctor-output'
import { describeFailure } from './failure'
import { agentFailure } from './failure-format'
import { runDoctor, runLiveDoctor } from './index'
import { selectResult } from './result-selection'
import { CLI_OUTPUT_SCHEMA_VERSION } from './schema-version'

export interface DoctorCommandOptions {
  cwd?: string
  live: boolean
  session?: string
  select?: string
  maxBytes?: number
}

/** `genie-react doctor`: setup checks as one result; a bad --select is reported like any other command's. */
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
    const output =
      options.select === undefined
        ? renderOutput(envelope, { maxBytes, text: renderDoctorText })
        : renderOutput(selectResult(envelope, options.select), {
            maxBytes,
            text: renderEnvelopeText,
          })
    process.stdout.write(`${output}\n`)
    return result.ok ? 0 : 1
  } catch (error) {
    const { reason, message, ...failure } = await describeFailure(error, {})
    process.stdout.write(
      `${renderFailure(agentFailure(reason, `Doctor failed. ${message}`, failure), maxBytes)}\n`,
    )
    return 1
  }
}
