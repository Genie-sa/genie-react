import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { describe, expect, it } from 'vitest'
import { CLI_OPTIONS, cliHelp, parseArgsFailureMessage } from './cli-help'

function parseError(args: string[]): Error {
  try {
    parseArgs({ args, allowPositionals: true, options: CLI_OPTIONS })
  } catch (error) {
    if (error instanceof Error) return error
  }
  throw new Error('expected parseArgs to fail')
}

describe('parseArgsFailureMessage', () => {
  it('suggests the closest valid option without echoing the unknown one', () => {
    const message = parseArgsFailureMessage(parseError(['status', '--sesion', 'tab']), 'status')
    expect(message).toContain('did you mean --session?')
    expect(message).toContain('status accepts')
    expect(message).not.toContain('sesion ')
  })

  it('lists the accepted options when nothing is close', () => {
    const message = parseArgsFailureMessage(parseError(['call', '--secret-token-flag']), 'call')
    expect(message).toMatch(/^Unknown option\. call accepts --help, /)
    expect(message).not.toContain('secret-token')
  })

  it('names a known option that is missing its value', () => {
    expect(parseArgsFailureMessage(parseError(['status', '--url']), 'status')).toBe(
      'Option --url requires a value. Run pnpm exec genie-react status --help for its options.',
    )
  })
})

describe('cliHelp', () => {
  it('documents GENIE_BRIDGE_PORT alongside the other environment variables', () => {
    expect(cliHelp()).toMatchObject({
      environment: { GENIE_BRIDGE_PORT: expect.stringContaining('1 to 65535') },
    })
  })

  it('accepts --session for doctor', () => {
    expect(cliHelp('doctor')).toMatchObject({ options: { session: expect.any(Object) } })
  })
})

describe('CLI startup imports', () => {
  const source = (module: string): string =>
    readFileSync(new URL(`./${module}.ts`, import.meta.url), 'utf8')

  /** Local modules cli.ts loads before running a command; dynamic imports are excluded on purpose. */
  function startupGraph(module: string, seen = new Set<string>()): Set<string> {
    seen.add(module)
    for (const [, specifier] of source(module).matchAll(
      /^import (?!type )[^;]*?from '([^']+)'/gms,
    )) {
      if (specifier?.startsWith('./') && !seen.has(specifier.slice(2))) {
        startupGraph(specifier.slice(2), seen)
      } else if (specifier) seen.add(specifier)
    }
    return seen
  }

  it('keeps the protocol schemas, hub server and bridge client out of --help and --version', () => {
    const graph = [...startupGraph('cli')]
    expect(graph.filter((module) => module.startsWith('genie-react'))).toEqual([])
    expect(graph).not.toContain('ws')
    expect(graph).not.toContain('agent')
  })
})
