import type { FailureErrorCode, FailureOptions, FailureReason } from './failure'
import { CLI_OUTPUT_SCHEMA_VERSION } from './schema-version'

/** Bridge failures keep the wire spelling; CLI-side failures get the kebab-case of their reason, so every envelope carries a code. */
export const DEFAULT_ERROR_CODES: Record<FailureReason, FailureErrorCode> = {
  invalid_input: 'invalid-input',
  invalid_args: 'invalid-args',
  not_connected: 'not-connected',
  unknown_session: 'unknown-session',
  unknown_tool: 'unknown-tool',
  tool_unavailable: 'tool-unavailable',
  tool_error: 'tool-error',
  busy: 'busy',
  timeout: 'timeout',
  bridge_rejected: 'bridge-rejected',
  bridge_unreachable: 'bridge-unreachable',
  operational_failure: 'operational-failure',
}

/** Stable failure payload for every command mode; dependency-free so argument errors render without loading the protocol. */
export function formatAgentFailure(
  reason: FailureReason,
  message: string,
  options: FailureOptions = {},
): string {
  return JSON.stringify({
    schemaVersion: CLI_OUTPUT_SCHEMA_VERSION,
    status: 'error',
    reason,
    message,
    userActionRequired: options.userActionRequired ?? false,
    errorCode: options.errorCode ?? DEFAULT_ERROR_CODES[reason],
    ...(options.retryInMs === undefined ? {} : { retryInMs: options.retryInMs }),
    ...(options.next === undefined ? {} : { next: options.next }),
    ...(options.correctedExample === undefined
      ? {}
      : { correctedExample: options.correctedExample }),
    ...(options.busyTelemetry === undefined ? {} : { busyTelemetry: options.busyTelemetry }),
    ...(options.details === undefined ? {} : { details: options.details }),
  })
}
