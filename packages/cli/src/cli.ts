#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { CAPTURE_DOMAINS, type CaptureDomain, errorMessage } from 'genie-react/protocol'
import {
  formatAgentFailure,
  renderResult,
  runBatch,
  runCall,
  runCaptureExport,
  runStatus,
  runTools,
} from './agent'
import { CLI_OPTIONS, COMMAND_OPTIONS, COMMANDS, cliHelp, POSITIONAL_LIMITS } from './cli-help'
import { writeDiagnostic, writeJson } from './cli-output'
import { isRecord } from './guards'
import { runHub } from './hub-command'
import { runDoctor, runLiveDoctor } from './index'
import { runLink } from './link'
import { installOutputFailureHandler, setOutputContext } from './output-safety'
import { runInitCommand } from './setup-output'

installOutputFailureHandler()
setOutputContext({ operation: 'cli' })

type ParsedValues = Record<string, boolean | string | undefined>

function unsupportedOption(command: string, values: ParsedValues): string | null {
  const allowed = COMMAND_OPTIONS[command]
  if (!allowed) return null
  for (const [name, value] of Object.entries(values)) {
    if (name === 'help' || name === 'version' || value === undefined || value === false) continue
    if (!allowed.has(name)) return `Option --${name} isn't valid for ${command}.`
  }
  return null
}

function writeCliFailure(message: string, command?: string): void {
  const argv = ['genie-react', ...(command ? [command] : []), '--help']
  writeJson(
    JSON.parse(
      formatAgentFailure('invalid_input', message, {
        userActionRequired: true,
        next: { command: argv.join(' '), argv },
      }),
    ),
  )
}

function parseFields(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined
  const fields = raw
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean)
  return fields.length > 0 ? fields : undefined
}

function parseCaptureSections(raw: string | undefined): CaptureDomain[] | undefined {
  const sections = parseFields(raw)
  if (!sections) return undefined
  const allowed = new Set<string>(CAPTURE_DOMAINS)
  const invalid = sections.filter((section) => !allowed.has(section))
  if (invalid.length > 0) {
    throw new Error(`Unknown capture section. Valid sections: ${CAPTURE_DOMAINS.join(', ')}.`)
  }
  return sections as CaptureDomain[]
}

function readVersion(): string {
  try {
    const url = new URL('../package.json', import.meta.url)
    const pkg: unknown = JSON.parse(readFileSync(url, 'utf8'))
    if (isRecord(pkg) && typeof pkg.version === 'string') return pkg.version
    return '0.0.0'
  } catch {
    return '0.0.0'
  }
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: CLI_OPTIONS,
  })

  const command = positionals[0]
  if (command !== undefined && !Object.hasOwn(COMMANDS, command)) {
    writeCliFailure('Unknown command. Run `genie-react --help` for accepted commands.')
    return 1
  }
  if (!command) {
    const unsupported = Object.keys(values).some(
      (key) => !['help', 'version', 'json', 'max-bytes'].includes(key),
    )
    if (unsupported) {
      writeCliFailure('Provide a command before using command-specific options.')
      return 1
    }
  }
  const operation = command ?? 'help'
  setOutputContext({ operation })
  const optionError = unsupportedOption(operation, values)
  if (optionError) {
    writeCliFailure(optionError)
    return 1
  }
  const positionalLimit = POSITIONAL_LIMITS[operation]
  if (positionalLimit !== undefined && positionals.length > positionalLimit) {
    writeCliFailure(`Too many arguments for ${command}. Run \`genie-react ${command} --help\`.`)
    return 1
  }

  if (
    values['connect-timeout'] !== undefined &&
    (!Number.isFinite(Number(values['connect-timeout'])) ||
      Number(values['connect-timeout']) < 100 ||
      Number(values['connect-timeout']) > 120_000)
  ) {
    writeCliFailure('--connect-timeout must be a number from 100 to 120000 milliseconds.')
    return 1
  }
  if (
    values.timeout !== undefined &&
    (!Number.isFinite(Number(values.timeout)) || Number(values.timeout) <= 0)
  ) {
    writeCliFailure('--timeout must be a positive number of milliseconds.')
    return 1
  }
  if (
    values.wait !== undefined &&
    (!Number.isFinite(Number(values.wait)) ||
      Number(values.wait) < 1 ||
      Number(values.wait) > 120_000)
  ) {
    writeCliFailure('--wait must be a number from 1 to 120000 milliseconds.')
    return 1
  }
  if (values.fields !== undefined && parseFields(values.fields) === undefined) {
    writeCliFailure('--fields requires at least one comma-separated field name.')
    return 1
  }
  if (values.select !== undefined && values.select.trim() === '') {
    writeCliFailure('--select requires a non-empty JSON Pointer or dotted path.')
    return 1
  }
  if (values.fields !== undefined && values.select !== undefined) {
    writeCliFailure('Choose either --fields or --select, not both.')
    return 1
  }
  if (
    values['max-bytes'] !== undefined &&
    (!Number.isInteger(Number(values['max-bytes'])) ||
      Number(values['max-bytes']) < 512 ||
      Number(values['max-bytes']) > 50_000_000)
  ) {
    writeCliFailure('--max-bytes must be an integer from 512 to 50000000.')
    return 1
  }
  if (
    values.marker !== undefined &&
    (values.marker.length === 0 ||
      values.marker.length > 80 ||
      [...values.marker].some((character) => (character.codePointAt(0) ?? 0) <= 31))
  ) {
    writeCliFailure('--marker must be 1–80 characters without control characters.')
    return 1
  }
  if (command === 'batch' && values.json === true && values.ndjson === true) {
    writeCliFailure('Choose either --json or --ndjson, not both.')
    return 1
  }
  const maxBytes = values['max-bytes'] ? Number(values['max-bytes']) : undefined
  if (values.version) {
    writeJson({ schemaVersion: '1.0', status: 'ok', version: readVersion() }, maxBytes)
    return 0
  }
  if (!command || values.help) {
    writeJson(cliHelp(command), maxBytes)
    return 0
  }

  const agentOptions = {
    url: values.url,
    connectTimeoutMs: values['connect-timeout'] ? Number(values['connect-timeout']) : undefined,
    waitMs: values.wait ? Number(values.wait) : undefined,
    json: values.json,
    ndjson: values.ndjson,
    session: values.session,
    all: values.all,
    timeoutMs: values.timeout ? Number(values.timeout) : undefined,
    fields: parseFields(values.fields),
    select: values.select,
    maxBytes,
    failOnResultError: values['fail-on-result-error'],
    marker: values.marker,
    sessionsOnly: values['sessions-only'],
    verbose: values.verbose,
    cliVersion: readVersion(),
  }

  if (values.verbose) {
    writeDiagnostic('bootstrap', 'Starting CLI command.', {
      version: agentOptions.cliVersion,
      command,
    })
  }

  switch (command) {
    case 'init':
      return runInitCommand({
        dryRun: values['dry-run'] ?? false,
        yes: values.yes ?? false,
        maxBytes,
      })
    case 'doctor': {
      const logger = { info: () => undefined, error: () => undefined }
      const result = values.live ? await runLiveDoctor({ logger }) : runDoctor({ logger })
      process.stdout.write(
        `${renderResult(
          'doctor',
          {
            ...result,
            schemaVersion: '1.0',
            status: result.ok ? 'ok' : 'error',
            reason: result.ok ? 'checks_passed' : 'checks_failed',
            message: result.ok
              ? 'Setup checks passed.'
              : 'Setup checks failed. Follow the reported remediation steps.',
            userActionRequired: !result.ok,
          },
          true,
          undefined,
          values.select,
          maxBytes,
        )}\n`,
      )
      return result.ok ? 0 : 1
    }
    case 'hub': {
      const port = values.port ? Number(values.port) : undefined
      if (port !== undefined && (!Number.isInteger(port) || port <= 0 || port > 65_535)) {
        writeCliFailure('--port must be an integer from 1 to 65535.')
        return 1
      }
      return runHub({ port, maxBytes })
    }
    case 'link':
      return runLink({ genieRoot: positionals[1], maxBytes })
    case 'tools':
      return runTools(positionals[1], agentOptions)
    case 'status':
      return runStatus(agentOptions)
    case 'call':
      return runCall(positionals[1], positionals[2], agentOptions)
    case 'batch':
      return runBatch(positionals[1], agentOptions)
    case 'capture': {
      if (positionals[1] !== 'export') {
        writeCliFailure('Capture currently requires the `export` subcommand.')
        return 1
      }
      let sections: CaptureDomain[] | undefined
      try {
        sections = parseCaptureSections(values.section)
      } catch (error) {
        writeCliFailure(errorMessage(error))
        return 1
      }
      return runCaptureExport(positionals[2], {
        ...agentOptions,
        output: values.output,
        sections,
        force: values.force,
      })
    }
    default:
      return 1
  }
}

// exitCode + natural exit, NOT process.exit(): exit() drops buffered stdout past the 64KB pipe window, truncating piped --json output.
main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error: unknown) => {
    const argumentError =
      error instanceof Error &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code.startsWith('ERR_PARSE_ARGS_')
    if (argumentError) {
      writeCliFailure(
        'Invalid command-line arguments. Use the options and value types from `genie-react --help`.',
      )
    } else {
      writeJson(
        JSON.parse(
          formatAgentFailure(
            'operational_failure',
            'CLI operation failed. Inspect local setup with `genie-react doctor` before retrying.',
            {
              next: { command: 'genie-react doctor', argv: ['genie-react', 'doctor'] },
            },
          ),
        ),
      )
    }
    process.exitCode = 1
  })
