import type { FailureReason } from './failure'

/** One exit-code taxonomy for the CLI; `verify` uses it now, and every failure envelope reports the code its command will use once every command switches. */
export const EXIT_CODES = {
  success: 0,
  failure: 1,
  usage: 2,
  'needs-human': 3,
  refused: 4,
  inconclusive: 5,
  unreachable: 69,
  timeout: 124,
  interrupted: 130,
} as const

export type ExitClass = keyof typeof EXIT_CODES

export interface ExitStatus {
  code: (typeof EXIT_CODES)[ExitClass]
  class: ExitClass
}

const FAILURE_CLASSES: Record<FailureReason, ExitClass> = {
  invalid_input: 'usage',
  invalid_args: 'usage',
  unknown_tool: 'usage',
  unknown_session: 'usage',
  tool_unavailable: 'failure',
  tool_error: 'failure',
  operational_failure: 'failure',
  conflict: 'failure',
  bridge_rejected: 'needs-human',
  bridge_unreachable: 'unreachable',
  not_connected: 'unreachable',
  timeout: 'timeout',
  busy: 'timeout',
}

export function exitStatus(exitClass: ExitClass): ExitStatus {
  return { code: EXIT_CODES[exitClass], class: exitClass }
}

export function failureExit(reason: FailureReason): ExitStatus {
  return exitStatus(FAILURE_CLASSES[reason])
}
