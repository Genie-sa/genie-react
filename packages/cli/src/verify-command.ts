import { readFile } from 'node:fs/promises'
import {
  devtoolsVerifyAbortContract,
  devtoolsVerifyBeginContract,
  devtoolsVerifyEndContract,
  devtoolsVerifyReadContract,
  VERDICT_EXIT_CODES,
  VERIFY_SCHEMA_VERSION,
  type VerifyClaimInput,
} from 'genie-react/protocol'
import {
  type AgentOptions,
  type Connection,
  connect,
  failureContext,
  readStdin,
  resolveSession,
  waitForApp,
} from './agent'
import { BridgeCallError } from './agent-link'
import { DEFAULT_MAX_BYTES, renderFailure, writeOutput } from './cli-output'
import { EXIT_CODES, failureExit } from './exit-codes'
import { describeFailure, type FailureOptions, type FailureReason } from './failure'
import { agentFailure } from './failure-format'
import { isRecord } from './guards'
import { setOutputContext } from './output-safety'
import { genieCommand } from './package-manager'
import { ClaimSyntaxError, parseClaim } from './verify-claims'
import { renderVerificationText, withNextCommands } from './verify-output'

const VERIFY_ACTIONS = ['begin', 'end', 'show', 'abort'] as const
type VerifyAction = (typeof VERIFY_ACTIONS)[number]

export interface VerifyOptions extends AgentOptions {
  name?: string
  claim?: string[]
  claims?: string
  budget?: string
  quietMs?: string
  settleTimeoutMs?: string
  tailMs?: string
  domains?: string
  maxDuration?: string
  allowOverrides?: boolean
  section?: string
}

const VERIFICATION_ID = /^vfy_[0-9a-f-]{36}$/
/** `verify end` settles (up to 60 s), records a tail (up to 30 s) and reads evidence, so it gets the hub's full call budget. */
const END_TIMEOUT_MS = 120_000

function fail(
  opts: AgentOptions,
  reason: FailureReason,
  message: string,
  options: FailureOptions = {},
): number {
  const exit = failureExit(reason)
  process.stdout.write(
    `${renderFailure(agentFailure(reason, message, options, exit), opts.maxBytes ?? DEFAULT_MAX_BYTES)}\n`,
  )
  return exit.code
}

function usage(opts: AgentOptions, message: string, action?: VerifyAction): number {
  return fail(opts, 'invalid_input', message, {
    userActionRequired: true,
    next: genieCommand(['verify', ...(action ? [action] : []), '--help']),
  })
}

function exitFor(document: unknown): number {
  if (!isRecord(document)) return EXIT_CODES.failure
  if (document.state === 'completed' && typeof document.verdict === 'string') {
    return (
      VERDICT_EXIT_CODES[document.verdict as keyof typeof VERDICT_EXIT_CODES] ?? EXIT_CODES.failure
    )
  }
  return EXIT_CODES.success
}

function emit(document: unknown, opts: AgentOptions): number {
  writeOutput(withNextCommands(document, resolveSession(opts.session)), {
    maxBytes: opts.maxBytes,
    text: renderVerificationText,
  })
  return exitFor(document)
}

export async function runVerify(
  action: string | undefined,
  verificationId: string | undefined,
  opts: VerifyOptions = {},
): Promise<number> {
  setOutputContext({ operation: `verify ${action ?? '(missing action)'}` })
  if (!VERIFY_ACTIONS.includes(action as VerifyAction)) {
    return usage(opts, `Choose a verify action: ${VERIFY_ACTIONS.join(', ')}.`)
  }
  const verb = action as VerifyAction
  if (verb === 'begin') {
    if (verificationId !== undefined)
      return usage(opts, 'verify begin takes no positional argument.', verb)
    return begin(opts)
  }
  if (verificationId === undefined || !VERIFICATION_ID.test(verificationId)) {
    return usage(
      opts,
      `verify ${verb} needs the verification ID that verify begin printed (vfy_ followed by a UUID).`,
      verb,
    )
  }
  setOutputContext({ operation: `verify ${verb}`, operationId: verificationId })
  if (verb === 'show') return show(verificationId, opts)
  return finish(verb, verificationId, opts)
}

async function beginInput(opts: VerifyOptions): Promise<{ input: unknown } | { error: string }> {
  const dsl = opts.claim ?? []
  if (dsl.length > 0 && opts.claims !== undefined) {
    return { error: 'Choose either --claim or --claims, not both.' }
  }
  let document: Record<string, unknown> = {}
  if (opts.claims !== undefined) {
    let raw: string
    try {
      raw = opts.claims === '-' ? await readStdin(null) : await readFile(opts.claims, 'utf8')
    } catch {
      return { error: '--claims must name a readable JSON file, or - to read it from stdin.' }
    }
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!isRecord(parsed)) throw new Error('not an object')
      document = parsed
    } catch {
      return { error: '--claims must hold one JSON object with a claims array.' }
    }
  }
  let claims: VerifyClaimInput[] | unknown = document.claims
  if (dsl.length > 0) {
    const parsed: VerifyClaimInput[] = []
    for (const [position, text] of dsl.entries()) {
      try {
        parsed.push(parseClaim(text))
      } catch (error) {
        if (error instanceof ClaimSyntaxError)
          return { error: `Claim ${position + 1}: ${error.message}` }
        throw error
      }
    }
    claims = parsed
  }
  if (claims === undefined) return { error: 'Declare at least one claim with --claim or --claims.' }
  let budget: unknown = document.budget
  if (opts.budget !== undefined) {
    try {
      budget = JSON.parse(opts.budget)
    } catch {
      return { error: '--budget must be one JSON object, such as {"fiberLimit":1200}.' }
    }
  }
  const settleDocument = isRecord(document.settle) ? document.settle : {}
  const integer = (value: string | undefined) => (value === undefined ? undefined : Number(value))
  const settle = {
    ...settleDocument,
    ...(opts.quietMs === undefined ? {} : { quietMs: integer(opts.quietMs) }),
    ...(opts.settleTimeoutMs === undefined ? {} : { timeoutMs: integer(opts.settleTimeoutMs) }),
    ...(opts.domains === undefined
      ? {}
      : { domains: opts.domains.split(',').map((domain) => domain.trim()) }),
  }
  return {
    input: {
      name: opts.name ?? document.name,
      claims,
      ...(budget === undefined ? {} : { budget }),
      ...(Object.keys(settle).length === 0 ? {} : { settle }),
      ...(opts.tailMs === undefined
        ? document.tailMs === undefined
          ? {}
          : { tailMs: document.tailMs }
        : { tailMs: integer(opts.tailMs) }),
      ...(opts.maxDuration === undefined ? {} : { maxDurationMs: integer(opts.maxDuration) }),
      ...(opts.allowOverrides ? { allowOverrides: true } : {}),
    },
  }
}

async function begin(opts: VerifyOptions): Promise<number> {
  const built = await beginInput(opts)
  if ('error' in built) return usage(opts, built.error, 'begin')
  const parsed = devtoolsVerifyBeginContract.input.safeParse(built.input)
  if (!parsed.success) {
    const problems = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `/${issue.path.join('/')}: ${issue.message}`)
    return usage(opts, `The verification is invalid: ${problems.join('; ')}.`, 'begin')
  }
  const opened = await open(opts, 'Verify begin failed.')
  if ('exit' in opened) return opened.exit
  const { connection } = opened
  try {
    if (!(await waitForApp(connection.link, opts))) return EXIT_CODES.unreachable
    const { result } = await connection.link.invokeAnswered(
      devtoolsVerifyBeginContract.name,
      built.input,
      undefined,
      { timeoutMs: opts.timeoutMs },
    )
    return emit(result, opts)
  } catch (error) {
    return reportCaught(
      error,
      opts,
      connection,
      devtoolsVerifyBeginContract.name,
      'Verify begin failed.',
    )
  } finally {
    connection.link.close()
  }
}

async function finish(
  verb: Extract<VerifyAction, 'end' | 'abort'>,
  verificationId: string,
  opts: VerifyOptions,
): Promise<number> {
  const tool = verb === 'end' ? devtoolsVerifyEndContract.name : devtoolsVerifyAbortContract.name
  const opened = await open(opts, `Verify ${verb} failed.`)
  if ('exit' in opened) return opened.exit
  const { connection } = opened
  try {
    const { result } = await connection.link.invokeAnswered(tool, { verificationId }, undefined, {
      timeoutMs: opts.timeoutMs ?? END_TIMEOUT_MS,
    })
    return emit(result, opts)
  } catch (error) {
    if (verb === 'end' && isUnknownVerification(error)) {
      return emit(lostVerification(verificationId), opts)
    }
    return reportCaught(error, opts, connection, tool, `Verify ${verb} failed.`)
  } finally {
    connection.link.close()
  }
}

async function show(verificationId: string, opts: VerifyOptions): Promise<number> {
  const claims = opts.claim ?? []
  if (claims.length > 1) return usage(opts, 'verify show takes at most one --claim number.', 'show')
  const [claim] = claims
  if (claim !== undefined && !/^(?:[1-9]|1\d|20)$/.test(claim)) {
    return usage(opts, 'verify show --claim takes a claim number from 1 to 20.', 'show')
  }
  if (claim !== undefined && opts.section !== undefined) {
    return usage(opts, 'Choose either --claim or --section, not both.', 'show')
  }
  if (opts.section !== undefined && !/^(?:guards|raw:[a-z][a-z0-9_]{0,63})$/.test(opts.section)) {
    return usage(
      opts,
      'verify show --section takes guards or raw:<tool>, such as raw:react_get_renders.',
      'show',
    )
  }
  const args = {
    verificationId,
    ...(claim === undefined ? {} : { claim: Number(claim) }),
    ...(opts.section === undefined ? {} : { section: opts.section }),
  }
  const opened = await open(opts, 'Verify show failed.')
  if ('exit' in opened) return opened.exit
  const { connection } = opened
  try {
    const { result } = await connection.link.invokeAnswered(
      devtoolsVerifyReadContract.name,
      args,
      undefined,
      {
        timeoutMs: opts.timeoutMs,
      },
    )
    if (claim !== undefined || opts.section !== undefined) {
      writeOutput(result, { maxBytes: opts.maxBytes })
      return EXIT_CODES.success
    }
    return emit(result, opts)
  } catch (error) {
    return reportCaught(
      error,
      opts,
      connection,
      devtoolsVerifyReadContract.name,
      'Verify show failed.',
    )
  } finally {
    connection.link.close()
  }
}

/** Opens the bridge link, or reports why not with the exit code of that failure. */
async function open(
  opts: AgentOptions,
  operation: string,
): Promise<{ connection: Connection } | { exit: number }> {
  try {
    return { connection: await connect(opts) }
  } catch (error) {
    const { reason, message, ...options } = await describeFailure(error, {})
    return { exit: fail(opts, reason, `${operation} ${message}`, options) }
  }
}

function isUnknownVerification(error: unknown): boolean {
  return error instanceof BridgeCallError && error.details?.hubCode === 'VERIFICATION_UNKNOWN'
}

/** The hub no longer holds the window, so nothing can be decided: a refusal, never a pass. */
function lostVerification(verificationId: string): Record<string, unknown> {
  const refusal = {
    reason: 'window_lost',
    message:
      'The hub holds no verification with this ID: it expired, was evicted, or the hub restarted. Begin a new verification.',
    fix: { action: 'begin-again' },
  }
  return {
    schemaVersion: VERIFY_SCHEMA_VERSION,
    kind: 'verification',
    verificationId,
    verdict: 'refused',
    exitCode: VERDICT_EXIT_CODES.refused,
    state: 'completed',
    stage: 'end',
    claims: [],
    window: {
      refusals: [
        {
          guard: 'window-alive',
          refusal: { ...refusal, next: genieCommand(['verify', 'begin', '--help']) },
        },
      ],
    },
    caveats: ['ui-outcome-not-observed'],
  }
}

async function reportCaught(
  error: unknown,
  opts: AgentOptions,
  connection: Connection,
  tool: string,
  operation: string,
): Promise<number> {
  const { reason, message, ...options } = await describeFailure(
    error,
    failureContext(connection, opts, tool),
  )
  return fail(opts, reason, `${operation} ${message}`, options)
}
