import { isRecord } from './guards'

/** Lossless compact text encoding of a JSON document for a model to read (docs/json-cli.md); app strings outside a safe character set are JSON-quoted, so they cannot add lines, fields or CLI-owned lines. */

const JSON_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/
const BARE_STRING = /^[A-Za-z0-9_$./@~][A-Za-z0-9_$./@~+:-]*$/
const BARE_KEY = /^[A-Za-z0-9_$][A-Za-z0-9_$.-]*$/
const LITERALS: ReadonlySet<string> = new Set(['true', 'false', 'null'])
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point.
const CONTROL = /[\u0000-\u001f]/g
/** Code points that terminals or editors may render as line breaks, reorder, or hide; JSON.stringify leaves them raw. */
const INVISIBLE_OR_BREAKING =
  /[\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g
/** Object and array levels that may get one line per entry; deeper values render inline. */
const BLOCK_DEPTH = 2
/** A value stays on its key's line while the line fits; a longer object or array is broken out. */
const LINE_WIDTH = 100
/** Arrays of at least this many objects hoist the fields every item shares into one `each:` line. */
const MIN_HOISTED_ITEMS = 3
const INDENT = '  '
const SHELL_SAFE = /^[a-zA-Z0-9_./:@=-]+$/
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/

export interface ShellCommand {
  command: string
  argv: string[]
}

/** JSON string literal that additionally escapes code points able to fake or hide a line break. */
export function quoteString(value: string): string {
  return jsonText(value)
}

/** `JSON.stringify` output with bidirectional overrides, invisible and line-breaking code points escaped as `\uXXXX`; they occur only inside string literals, so the document parses to the same values. */
export function jsonText(value: unknown): string {
  return (JSON.stringify(value) ?? 'null').replace(INVISIBLE_OR_BREAKING, escapeCodePoint)
}

/** CLI-composed prose shown unquoted, such as an envelope message; control and line-breaking characters are escaped. */
export function proseText(value: string): string {
  return value
    .replace(CONTROL, (character) => JSON.stringify(character).slice(1, -1))
    .replace(INVISIBLE_OR_BREAKING, escapeCodePoint)
}

export function scalarText(value: unknown): string {
  if (typeof value === 'string') return isBareString(value) ? value : quoteString(value)
  return JSON.stringify(value) ?? 'null'
}

export function keyText(key: string): string {
  return BARE_KEY.test(key) ? key : quoteString(key)
}

/** Inline form of any JSON value: `{key:value,…}`, `[value,…]` or a scalar. */
export function flowText(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(flowText).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .map(([key, entry]) => `${keyText(key)}:${flowText(entry)}`)
      .join(',')}}`
  }
  return scalarText(value)
}

/** Generic text document. `value` must already be plain JSON, as produced by JSON.parse. */
export function encodeText(value: unknown): string {
  if (isRecord(value))
    return Object.keys(value).length === 0 ? '{}' : blockLines(value, 0, '').join('\n')
  if (Array.isArray(value)) return [`[${value.length}]:`, ...itemLines(value, INDENT)].join('\n')
  return typeof value === 'string' ? quoteString(value) : scalarText(value)
}

/** One `key: value` line per entry; objects and arrays of containers nest until {@link BLOCK_DEPTH}. */
export function blockLines(
  record: Record<string, unknown>,
  depth: number,
  indent: string,
): string[] {
  const lines: string[] = []
  for (const [key, value] of Object.entries(record)) {
    lines.push(...fieldLines(key, value, depth, indent))
  }
  return lines
}

/** Top-level fields in source order, with `key` laid out by `layout`; a null layout falls back to the generic field. */
export function fieldsWithLayout(
  record: Record<string, unknown>,
  key: string,
  layout: (value: unknown) => string[] | null,
): string[] {
  const lines = Object.entries(record).flatMap(
    ([field, value]) => (field === key ? layout(value) : null) ?? fieldLines(field, value, 0, ''),
  )
  return lines.length === 0 ? ['{}'] : lines
}

export function fieldLines(key: string, value: unknown, depth: number, indent: string): string[] {
  const label = `${indent}${keyText(key)}`
  if (asShellCommand(value)) return [`${label}: $ ${value.command}`]
  const inline = `${label}: ${flowText(value)}`
  if (depth >= BLOCK_DEPTH || inline.length <= LINE_WIDTH) return [inline]
  if (isRecord(value) && Object.keys(value).length > 0) {
    return [`${label}:`, ...blockLines(value, depth + 1, indent + INDENT)]
  }
  if (Array.isArray(value) && value.some(isContainer)) {
    return [`${label}[${value.length}]:`, ...itemLines(value, indent + INDENT)]
  }
  return [inline]
}

/** `- value` per item, preceded by `each: {…}` when every object item shares fields. */
export function itemLines(items: readonly unknown[], indent: string): string[] {
  const { shared, rest } = hoistSharedFields(items)
  return [
    ...(shared === null ? [] : [`${indent}each: ${flowText(shared)}`]),
    ...rest.map((item) => `${indent}- ${flowText(item)}`),
  ]
}

/** Fields deep-equal across every item move to `shared`; decoding deep-merges them back into each item. */
export function hoistSharedFields(items: readonly unknown[]): {
  shared: Record<string, unknown> | null
  rest: readonly unknown[]
} {
  if (items.length < MIN_HOISTED_ITEMS || !items.every(isNonEmptyRecord)) {
    return { shared: null, rest: items }
  }
  const shared = sharedFields(items)
  if (Object.keys(shared).length === 0) return { shared: null, rest: items }
  return { shared, rest: items.map((item) => withoutShared(item, shared)) }
}

function sharedFields(records: readonly Record<string, unknown>[]): Record<string, unknown> {
  const shared: Record<string, unknown> = {}
  const [first, ...others] = records
  if (!first) return shared
  for (const [key, value] of Object.entries(first)) {
    if (!others.every((record) => Object.hasOwn(record, key))) continue
    const values = records.map((record) => record[key])
    const serialized = JSON.stringify(value)
    if (values.every((candidate) => JSON.stringify(candidate) === serialized)) {
      shared[key] = value
    } else if (values.every(isNonEmptyRecord)) {
      const nested = sharedFields(values)
      if (Object.keys(nested).length > 0) shared[key] = nested
    }
  }
  return shared
}

function withoutShared(
  record: Record<string, unknown>,
  shared: Record<string, unknown>,
): Record<string, unknown> {
  const rest: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if (!Object.hasOwn(shared, key)) {
      rest[key] = value
      continue
    }
    const common = shared[key]
    if (!isRecord(common) || !isRecord(value) || JSON.stringify(common) === JSON.stringify(value)) {
      continue
    }
    const remainder = withoutShared(value, common)
    if (Object.keys(remainder).length > 0) rest[key] = remainder
  }
  return rest
}

/** `{command, argv}` renders as `$ command` only when the command is exactly the shell-quoted argv on one printable line. */
export function asShellCommand(value: unknown): value is ShellCommand {
  if (!isRecord(value)) return false
  const keys = Object.keys(value)
  if (keys.length !== 2 || !keys.includes('command') || !keys.includes('argv')) return false
  const { command, argv } = value
  return (
    typeof command === 'string' &&
    Array.isArray(argv) &&
    argv.length > 0 &&
    argv.every((word) => typeof word === 'string') &&
    PRINTABLE_ASCII.test(command) &&
    command === argv.map(shellQuote).join(' ')
  )
}

export function shellQuote(value: string): string {
  if (SHELL_SAFE.test(value)) return value
  return `'${value.replaceAll("'", `'\\''`)}'`
}

/** Prefixes every line, for documents nested under a CLI-owned line such as a batch item header. */
export function indentLines(text: string, indent = INDENT): string {
  return text === '' ? '' : text.replaceAll(/^/gm, indent)
}

/** Record access that remembers what was read, so a bespoke renderer hands every field it did not render to the generic encoder. */
export class FieldReader {
  private readonly read = new Set<string>()

  constructor(readonly record: Record<string, unknown>) {}

  take(key: string): unknown {
    this.read.add(key)
    return this.record[key]
  }

  has(key: string): boolean {
    return Object.hasOwn(this.record, key)
  }

  rest(): Record<string, unknown> {
    return Object.fromEntries(Object.entries(this.record).filter(([key]) => !this.read.has(key)))
  }
}

function isBareString(value: string): boolean {
  return (
    BARE_STRING.test(value) &&
    !JSON_NUMBER.test(value) &&
    !LITERALS.has(value) &&
    !value.endsWith(':')
  )
}

function isContainer(value: unknown): boolean {
  return typeof value === 'object' && value !== null
}

function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length > 0
}

function escapeCodePoint(character: string): string {
  return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
}
