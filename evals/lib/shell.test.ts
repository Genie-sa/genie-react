import { describe, expect, it } from 'vitest'
import { programWords, splitShellCommands, unwrapShellInvocation } from './shell.mjs'

describe('splitShellCommands', () => {
  it('splits chained commands without breaking quoted JSON', () => {
    const command = `genie-react call react_get_renders '{"component":"A|B","limit":5}' && agent-browser fill "#q" 'a; b'`
    expect(splitShellCommands(command)).toEqual([
      ['genie-react', 'call', 'react_get_renders', '{"component":"A|B","limit":5}'],
      ['agent-browser', 'fill', '#q', 'a; b'],
    ])
  })

  it('treats pipes, newlines and subshells as boundaries', () => {
    expect(splitShellCommands('cd app\n(genie-react status | head -5)')).toEqual([
      ['cd', 'app'],
      ['genie-react', 'status'],
      ['head', '-5'],
    ])
  })

  it('keeps stream redirections attached to the command', () => {
    expect(splitShellCommands('genie-react doctor 2>&1 | tail -3')).toEqual([
      ['genie-react', 'doctor', '2>&1'],
      ['tail', '-3'],
    ])
  })

  it('honours escaped quotes inside double quotes', () => {
    expect(splitShellCommands('agent-browser eval "say \\"hi\\""')).toEqual([
      ['agent-browser', 'eval', 'say "hi"'],
    ])
  })
})

describe('programWords', () => {
  it('strips env assignments, timeouts and package runners', () => {
    expect(
      programWords(['GENIE_SESSION=a', 'timeout', '30', 'pnpm', 'exec', 'genie-react', 'status']),
    ).toEqual(['genie-react', 'status'])
    expect(programWords(['npx', 'agent-browser', 'open', 'x'])).toEqual([
      'agent-browser',
      'open',
      'x',
    ])
  })

  it('leaves plain commands untouched', () => {
    expect(programWords(['ls', '-la'])).toEqual(['ls', '-la'])
  })
})

describe('unwrapShellInvocation', () => {
  it('unwraps codex-style login shell invocations', () => {
    expect(unwrapShellInvocation(`bash -lc 'genie-react call react_error_state {}'`)).toBe(
      'genie-react call react_error_state {}',
    )
    expect(unwrapShellInvocation('/bin/zsh -lc "agent-browser snapshot"')).toBe(
      'agent-browser snapshot',
    )
  })

  it('returns other commands unchanged', () => {
    expect(unwrapShellInvocation('genie-react status')).toBe('genie-react status')
  })
})
