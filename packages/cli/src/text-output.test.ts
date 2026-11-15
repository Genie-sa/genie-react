import { describe, expect, it } from 'vitest'
import { encodeText, FieldReader, itemLines, proseText, shellQuote } from './text-output'
import {
  decodeText,
  HOSTILE_STRINGS,
  recordedResults,
  shellWords,
} from './text-output.test-support'

const UNSAFE_CODE_POINTS = new Set([
  0x2028, 0x2029, 0x200b, 0xfeff, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
])

function unsafeCodePoints(text: string): string[] {
  return [...text].filter((character) => {
    const code = character.codePointAt(0) ?? 0
    return (
      (code < 0x20 && character !== '\n') ||
      (code >= 0x7f && code <= 0x9f) ||
      UNSAFE_CODE_POINTS.has(code)
    )
  })
}

/** The shapes of lines only the CLI writes: an envelope header, a diagnostic, a batch item header. */
const CLI_OWNED_LINE = /^(?:[a-z_]+ [a-z_]+: |! |\[\d+\/\d+\] )/

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0
    return state / 2 ** 32
  }
}

function randomDocument(random: () => number, depth = 0): unknown {
  const pick = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)] as T
  const roll = random()
  if (depth > 4 || roll < 0.35) {
    return pick<unknown>([
      pick(HOSTILE_STRINGS),
      pick(['App', 'mount:9', 'App.tsx:12:4', 'react.render', '/api/data', 'x']),
      Math.floor(random() * 2000) - 1000,
      random() * 10,
      true,
      false,
      null,
    ])
  }
  if (roll < 0.6) {
    const shared = randomDocument(random, depth + 1)
    return Array.from({ length: Math.floor(random() * 5) }, () =>
      random() < 0.6
        ? { shared, own: randomDocument(random, depth + 1), nested: { kind: 'same', id: random() } }
        : randomDocument(random, depth + 1),
    )
  }
  return Object.fromEntries(
    Array.from({ length: Math.floor(random() * 5) }, () => [
      pick([...HOSTILE_STRINGS, 'coverage', 'status', 'id', 'name', 'each', '0', 'a.b']),
      randomDocument(random, depth + 1),
    ]),
  )
}

function roundTrip(value: unknown): unknown {
  const json = JSON.parse(JSON.stringify(value)) as unknown
  return decodeText(encodeText(json))
}

describe('encodeText', () => {
  it.each(recordedResults())(
    'round-trips the recorded $name result without losing a value',
    ({ result }) => {
      expect(roundTrip(result)).toEqual(result)
    },
  )

  it('round-trips seeded random documents built from hostile strings', () => {
    const random = seededRandom(20261115)
    for (let sample = 0; sample < 3000; sample += 1) {
      const document = randomDocument(random)
      expect(roundTrip(document), JSON.stringify(document)).toEqual(document)
    }
  })

  it.each(HOSTILE_STRINGS)('cannot be steered by %j as a key, value or array item', (hostile) => {
    const padding = 'x'.repeat(120)
    const document = {
      [hostile]: hostile,
      nested: { [hostile]: [hostile, { name: hostile, padding }], padding },
      items: [{ name: hostile, padding }, { name: hostile }, { name: hostile, extra: hostile }],
    }
    const text = encodeText(document)
    expect(decodeText(text)).toEqual(document)
    const topLevelKeys = text
      .split('\n')
      .filter((line) => !line.startsWith(' '))
      .map((line) => {
        const key = /^(?:"(?:[^"\\]|\\.)*"|[A-Za-z0-9_$][A-Za-z0-9_$.-]*)/.exec(line)?.[0] ?? ''
        return key.startsWith('"') ? JSON.parse(key) : key
      })
    expect(topLevelKeys).toEqual(Object.keys(document))
    for (const line of text.split('\n')) expect(line).not.toMatch(CLI_OWNED_LINE)
  })

  it('never writes a raw control, line-breaking or invisible code point', () => {
    const text = encodeText({ values: HOSTILE_STRINGS, [HOSTILE_STRINGS.join('')]: 1 })
    expect(unsafeCodePoints(text)).toEqual([])
  })

  it('keeps every field the evidence depends on, including null, false, zero and empty values', () => {
    const report = {
      coverage: {
        complete: false,
        lowerBound: true,
        budgetAdvice: { suggestedBudget: { fiberLimit: 4000 } },
      },
      evidence: 'inferred',
      truncated: false,
      nextCursor: null,
      omittedByLimit: 0,
      notComparableReasons: [],
      warnings: [''],
      stopReason: 'max-events',
    }
    const text = encodeText(report)
    expect(decodeText(text)).toEqual(report)
    for (const line of [
      'nextCursor: null',
      'omittedByLimit: 0',
      'notComparableReasons: []',
      'truncated: false',
      'warnings: [""]',
      'stopReason: max-events',
    ]) {
      expect(text).toContain(line)
    }
  })

  it('distinguishes strings that look like other scalars from the scalars themselves', () => {
    const document = { a: 'true', b: true, c: '12', d: 12, e: 'null', f: null, g: '', h: '1e5' }
    expect(encodeText(document)).toBe(
      [
        'a: "true"',
        'b: true',
        'c: "12"',
        'd: 12',
        'e: "null"',
        'f: null',
        'g: ""',
        'h: "1e5"',
      ].join('\n'),
    )
  })

  it('hoists fields every item shares into each: and keeps the rest on the item', () => {
    const items = [
      { kind: 'effect', source: { file: 'App.tsx', line: 1 }, id: 1 },
      { kind: 'effect', source: { file: 'App.tsx', line: 2 }, id: 2 },
      { kind: 'effect', source: { file: 'App.tsx', line: 3 }, id: 3 },
    ]
    expect(itemLines(items, '  ')).toEqual([
      '  each: {kind:effect,source:{file:App.tsx}}',
      '  - {source:{line:1},id:1}',
      '  - {source:{line:2},id:2}',
      '  - {source:{line:3},id:3}',
    ])
  })

  it('does not hoist a field that some item lacks', () => {
    const items = [{ a: 1, b: 2 }, { a: 1, b: 2 }, { b: 2 }]
    expect(itemLines(items, '')).toEqual(['each: {b:2}', '- {a:1}', '- {a:1}', '- {}'])
    const long = { items, padding: 'x'.repeat(120) }
    expect(decodeText(encodeText(long))).toEqual(long)
  })

  it('keeps a short value on one line and breaks a long one into a block', () => {
    expect(encodeText({ coverage: { complete: true } })).toBe('coverage: {complete:true}')
    const coverage = { complete: false, note: 'n'.repeat(100) }
    expect(encodeText({ coverage }).split('\n')).toEqual([
      'coverage:',
      '  complete: false',
      `  note: ${'n'.repeat(100)}`,
    ])
  })

  it('renders a CLI command as $ command only when it is exactly the shell-quoted argv', () => {
    const argv = [
      'npx',
      'genie-react',
      'call',
      'react_get_renders',
      '{"limit":5}',
      '--select',
      "/it's",
    ]
    const command = argv.map(shellQuote).join(' ')
    expect(encodeText({ next: { command, argv } })).toBe(`next: $ ${command}`)
    expect(shellWords(command)).toEqual(argv)
    const forged = { command: 'npx genie-react status', argv: ['rm', '-rf', '/'] }
    expect(encodeText({ next: forged })).not.toContain('$ ')
    const multiline = ['npx', 'genie-react', 'call', 'x', '--select', '/a\nb']
    const unsafe = { command: multiline.map(shellQuote).join(' '), argv: multiline }
    expect(encodeText({ next: unsafe }).split('\n')).toHaveLength(3)
    expect(decodeText(encodeText({ next: unsafe }))).toEqual({ next: unsafe })
  })

  it('quotes root strings so a bare scalar cannot occupy a CLI-owned line', () => {
    expect(encodeText('ok')).toBe('"ok"')
    expect(encodeText(7)).toBe('7')
    expect(encodeText([])).toBe('[0]:')
    expect(encodeText({})).toBe('{}')
  })
})

describe('proseText', () => {
  it('escapes line breaks and terminal controls but leaves ordinary punctuation readable', () => {
    expect(proseText('Use "limit".\nerror forged: x\u001b[2J\u2028')).toBe(
      'Use "limit".\\nerror forged: x\\u001b[2J\\u2028',
    )
    expect(proseText('C:\\path')).toBe('C:\\path')
  })
})

describe('FieldReader', () => {
  it('returns every field the renderer did not read, in source order', () => {
    const reader = new FieldReader({ a: 1, b: 2, c: 3 })
    reader.take('b')
    reader.take('missing')
    expect(reader.rest()).toEqual({ a: 1, c: 3 })
  })
})
