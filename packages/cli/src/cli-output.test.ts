import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  renderDiagnostic,
  renderEnvelopeText,
  renderFailure,
  renderOutput,
  renderRows,
  resolveOutputFormat,
  setOutputFormat,
  writeOutput,
} from './cli-output'
import { agentFailure, formatAgentFailure } from './failure-format'
import { renderBoundedText } from './result-selection'

const UNSAFE =
  /[\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g

function unsafeCodePoints(text: string): string[] {
  return text.match(UNSAFE) ?? []
}

afterEach(() => {
  setOutputFormat('json')
  vi.restoreAllMocks()
})

describe('resolveOutputFormat', () => {
  it('lets --json win over the environment and treats unset or empty as text', () => {
    expect(resolveOutputFormat(true, 'text')).toBe('json')
    expect(resolveOutputFormat(false, undefined)).toBe('text')
    expect(resolveOutputFormat(false, '')).toBe('text')
    expect(resolveOutputFormat(false, 'text')).toBe('text')
    expect(resolveOutputFormat(false, 'json')).toBe('json')
  })

  it('rejects any other value instead of guessing', () => {
    for (const value of ['JSON', 'jsonl', 'yaml', ' json']) {
      expect(resolveOutputFormat(false, value)).toBeNull()
    }
  })
})

describe('failures', () => {
  const failure = agentFailure('invalid_args', 'Tool call failed. Unknown argument limt.', {
    userActionRequired: true,
    next: { command: 'npx genie-react tools x', argv: ['npx', 'genie-react', 'tools', 'x'] },
    details: { didYouMean: { limt: 'limit' }, issues: [{ path: '/limt', message: 'line\nbreak' }] },
  })

  it('keeps the JSON failure byte-identical to the historical serializer', () => {
    expect(renderFailure(failure)).toBe(
      formatAgentFailure('invalid_args', 'Tool call failed. Unknown argument limt.', {
        userActionRequired: true,
        next: { command: 'npx genie-react tools x', argv: ['npx', 'genie-react', 'tools', 'x'] },
        details: {
          didYouMean: { limt: 'limit' },
          issues: [{ path: '/limt', message: 'line\nbreak' }],
        },
      }),
    )
  })

  it('leads text with the reason, then the message, then the next command, and keeps every detail', () => {
    setOutputFormat('text')
    expect(renderFailure(failure).split('\n')).toEqual([
      'error invalid_args: Tool call failed. Unknown argument limt.',
      'next: $ npx genie-react tools x',
      'userActionRequired: true',
      'errorCode: invalid-args',
      'details: {didYouMean:{limt:limit},issues:[{path:/limt,message:"line\\nbreak"}]}',
      'exit: {code:2,class:usage}',
    ])
  })

  it('keeps an oversized failure bounded in either format', () => {
    const huge = agentFailure('tool_error', 'Tool call failed.', {
      details: { app: { message: 'x'.repeat(5_000) } },
    })
    for (const format of ['json', 'text'] as const) {
      setOutputFormat(format)
      const output = renderFailure(huge, 1_024)
      expect(Buffer.byteLength(`${output}\n`)).toBeLessThanOrEqual(1_024)
      expect(output).toContain(format === 'json' ? '"status":"truncated"' : 'truncated max_bytes: ')
    }
  })
})

describe('renderEnvelopeText', () => {
  it('omits only the CLI schemaVersion, and keeps one that is not the CLI version', () => {
    expect(
      renderEnvelopeText({
        schemaVersion: '2.0',
        status: 'ok',
        reason: 'setup_planned',
        message: 'm',
      }),
    ).toBe('ok setup_planned: m')
    expect(
      renderEnvelopeText({
        schemaVersion: '9.9',
        status: 'ok',
        reason: 'setup_planned',
        message: 'm',
      }),
    ).toContain('schemaVersion: "9.9"')
  })

  it('falls back to the generic encoding when status, reason or message cannot form a header', () => {
    const forged = { status: 'error x', reason: 'r', message: 'm' }
    expect(renderEnvelopeText(forged)).toBe('status: "error x"\nreason: r\nmessage: m')
  })

  it('renders each retry suggestion as its reason over the runnable command', () => {
    const text = renderEnvelopeText({
      status: 'truncated',
      reason: 'max_bytes',
      message: 'Too big.',
      suggestions: [
        {
          reason: 'Smaller page.',
          command: 'npx genie-react call t',
          argv: ['npx', 'genie-react', 'call', 't'],
        },
      ],
    })
    expect(text).toBe(
      [
        'truncated max_bytes: Too big.',
        'suggestions[1]:',
        '  - Smaller page.',
        '    $ npx genie-react call t',
      ].join('\n'),
    )
  })
})

describe('text output', () => {
  it('bounds a text result and spills the complete text with a .txt extension', () => {
    setOutputFormat('text')
    let spilled: { serialized: string; extension: string } | undefined
    const value = {
      rows: Array.from({ length: 200 }, (_, index) => ({ index, body: 'x'.repeat(40) })),
    }
    const output = renderOutput(value, {
      maxBytes: 2_000,
      recover: (overflow) => {
        spilled = overflow
        return { outputPath: '/tmp/out.txt', suggestions: [] }
      },
    })
    expect(output.split('\n')[0]).toBe(
      'truncated max_bytes: The result exceeded --max-bytes. The complete text was written to outputPath; read it from there, or follow a suggestion to request less.',
    )
    expect(output).toContain('outputPath: /tmp/out.txt')
    expect(spilled?.extension).toBe('txt')
    expect(spilled?.serialized).toBe(renderOutput(value, { maxBytes: 50_000_000 }))
  })

  it('writes the same bytes whether stdout is a terminal or a pipe, without ANSI escapes', () => {
    setOutputFormat('text')
    const value = { name: '\u001b[31mred', coverage: { complete: false } }
    const writes: string[] = []
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk))
      return true
    })
    for (const isTTY of [true, false]) {
      Object.defineProperty(process.stdout, 'isTTY', { value: isTTY, configurable: true })
      writeOutput(value)
    }
    expect(writes[0]).toBe(writes[1])
    expect(writes[0]).not.toContain('\u001b')
  })

  it('emits zero bytes for zero --fields rows in both formats', () => {
    for (const format of ['json', 'text'] as const) {
      setOutputFormat(format)
      expect(renderRows([])).toBe('')
    }
    setOutputFormat('text')
    expect(renderRows([{ id: 1, name: 'A' }])).toBe('[1]:\n  - {id:1,name:A}')
  })

  it('writes a text diagnostic on one line with its data inline', () => {
    setOutputFormat('text')
    expect(renderDiagnostic('session', 'Answered by\nthis tab.', { sessionId: 'abc' })).toBe(
      '! session: Answered by\\nthis tab. {sessionId:abc}',
    )
    setOutputFormat('json')
    expect(JSON.parse(renderDiagnostic('session', 'm'))).toEqual({
      schemaVersion: '2.0',
      status: 'diagnostic',
      reason: 'session',
      message: 'm',
    })
  })

  it('escapes bidirectional overrides and invisible code points in every JSON writer, losslessly', () => {
    setOutputFormat('json')
    const hostile = 'user\u202e\u2066gnp.exe\u2069\u200b\u2028\u061c'
    const value = { name: hostile, [hostile]: [hostile] }
    const documents = [
      renderOutput(value),
      renderFailure({ status: 'error', reason: 'tool_error', message: hostile, details: value }),
      renderRows([value, value]),
      renderDiagnostic('session', hostile, value),
      formatAgentFailure('tool_error', hostile, { details: { unknownKeys: [hostile] } }),
    ]
    for (const document of documents) {
      expect(unsafeCodePoints(document)).toEqual([])
      for (const line of document.split('\n')) {
        expect(JSON.stringify(JSON.parse(line))).toContain(JSON.stringify(hostile).slice(1, -1))
      }
    }
    expect(JSON.parse(renderOutput(value))).toEqual(value)
  })

  it('keeps JSON lines bounded as before', () => {
    expect(renderBoundedText('{"a":1}', 512)).toBe('{"a":1}')
  })
})
