import { isRecord } from './guards'
import { CLI_OUTPUT_SCHEMA_VERSION } from './schema-version'

const MAX_COUNTED_PATHS = 1_000_000

export interface SelectionEnvelope {
  schemaVersion: typeof CLI_OUTPUT_SCHEMA_VERSION
  status: 'ok'
  selection: {
    expression: string
    matchedPathCount: number
    matchedPaths: string[]
    omittedPathCount: number
  }
  result: unknown
}

export class ResultSelectionError extends Error {
  /** The caller's `--select` expression, when the failure is about it. */
  readonly expression?: string
  /** Top-level paths of the result, when the expression matched nothing. */
  readonly available?: readonly string[]

  constructor(
    message: string,
    selection: { expression?: string; available?: readonly string[] } = {},
  ) {
    super(message)
    this.name = 'ResultSelectionError'
    this.expression = selection.expression
    this.available = selection.available
  }
}

export class FieldSelectionError extends Error {
  readonly unknown: readonly string[]
  readonly available: readonly string[]

  constructor(unknown: string[], available: string[]) {
    const fieldLabel = unknown.length === 1 ? 'field' : 'fields'
    const names = unknown.map((field) => JSON.stringify(field)).join(', ')
    const choices = available.length > 0 ? available.join(', ') : '(none)'
    super(`Unknown ${fieldLabel} ${names}. Available fields: ${choices}.`)
    this.name = 'FieldSelectionError'
    this.unknown = unknown
    this.available = available
  }
}

interface Match {
  path: string
  value: unknown
}

/** Select nested output with RFC 6901 JSON Pointer or a dotted path with `*` / `[*]`. */
export function selectResult(result: unknown, expression: string): SelectionEnvelope {
  const segments = parseSelection(expression)
  const matches = selectMatches([{ path: '', value: result }], segments)
  if (matches.length === 0) {
    const available = isRecord(result)
      ? Object.keys(result)
          .sort()
          .slice(0, 30)
          .map((key) => `/${escapePointer(key)}`)
      : []
    throw new ResultSelectionError(
      `Selection ${JSON.stringify(expression)} matched no paths. Available top-level paths: ${available.join(', ') || '(none)'}. Use an RFC 6901 path such as /components/0/name or a wildcard path such as components[*].name.`,
      { expression, available },
    )
  }
  const matchedPaths = matches.map(({ path }) => path || '/')
  const selectedLeaves = matches.reduce(
    (count, match) => Math.min(MAX_COUNTED_PATHS, count + countLeafPaths(match.value)),
    0,
  )
  const totalLeaves = countLeafPaths(result)
  return {
    schemaVersion: CLI_OUTPUT_SCHEMA_VERSION,
    status: 'ok',
    selection: {
      expression,
      matchedPathCount: matches.length,
      matchedPaths: matchedPaths.slice(0, 200),
      omittedPathCount: Math.max(0, totalLeaves - selectedLeaves),
    },
    result:
      matches.length === 1
        ? matches[0]?.value
        : matches.map((match) => ({ path: match.path || '/', value: match.value })),
  }
}

export interface LargePath {
  path: string
  bytes: number
  items?: number
}

export interface OutputSuggestion {
  reason: string
  command: string
  argv: string[]
}

export interface Overflow {
  serialized: string
  originalBytes: number
  largestPaths: LargePath[]
}

export interface OverflowRecovery {
  outputPath?: string
  suggestions: OutputSuggestion[]
}

const LARGEST_PATH_LIMIT = 5
const LARGEST_PATH_DEPTH = 6
const COMPOSITE_CHILD_SHARE = 0.25

export function renderBoundedJson(
  value: unknown,
  maxBytes?: number,
  recover?: (overflow: Overflow) => OverflowRecovery,
): string {
  const serialized = JSON.stringify(value)
  const originalBytes = Buffer.byteLength(serialized, 'utf8') + 1
  if (maxBytes === undefined || originalBytes <= maxBytes) return serialized

  const largestPaths = largestJsonPaths(value)
  const recovery = recover?.({ serialized, originalBytes, largestPaths })
  const required = {
    schemaVersion: CLI_OUTPUT_SCHEMA_VERSION,
    status: 'truncated',
    reason: 'max_bytes',
    maxBytes,
    originalBytes,
    omittedPathCount: countLeafPaths(value),
    ...(recovery?.outputPath === undefined ? {} : { outputPath: recovery.outputPath }),
    message: recovery?.outputPath
      ? 'The result exceeded --max-bytes. The complete JSON was written to outputPath; read it from there, or follow a suggestion to request less.'
      : 'The result exceeded --max-bytes. Follow a suggestion, use --select on one of largestPaths, or lower a tool limit.',
  }
  const topLevelPaths = isRecord(value)
    ? Object.keys(value)
        .sort()
        .slice(0, 20)
        .map((key) => `/${escapePointer(key)}`)
    : []
  const candidates = [
    { ...required, largestPaths, suggestions: recovery?.suggestions ?? [], topLevelPaths },
    { ...required, largestPaths, suggestions: recovery?.suggestions ?? [] },
    { ...required, largestPaths: largestPaths.slice(0, 2) },
    required,
  ]
  for (const envelope of candidates) {
    const bounded = JSON.stringify(envelope)
    if (Buffer.byteLength(bounded, 'utf8') + 1 <= maxBytes) return bounded
  }
  throw new ResultSelectionError('--max-bytes is too small for the truncation envelope.')
}

/** The heaviest JSON branches; a branch with a heavy descendant defers to that descendant so each path is selectable on its own. */
export function largestJsonPaths(value: unknown): LargePath[] {
  const selectable: LargePath[] = []
  const visit = (current: unknown, path: string, depth: number): number => {
    if (!isRecord(current)) return 0
    let heaviest = 0
    for (const [key, child] of Object.entries(current)) {
      const childPath = `${path}/${escapePointer(key)}`
      const bytes = Buffer.byteLength(JSON.stringify(child) ?? '', 'utf8')
      const heaviestDescendant = depth < LARGEST_PATH_DEPTH ? visit(child, childPath, depth + 1) : 0
      if (heaviestDescendant < bytes * COMPOSITE_CHILD_SHARE) {
        selectable.push({
          path: childPath,
          bytes,
          ...(Array.isArray(child) ? { items: child.length } : {}),
        })
      }
      heaviest = Math.max(heaviest, bytes)
    }
    return heaviest
  }
  visit(value, '', 1)
  return selectable.sort((left, right) => right.bytes - left.bytes).slice(0, LARGEST_PATH_LIMIT)
}

export function renderBoundedText(text: string, maxBytes?: number): string {
  if (maxBytes === undefined || Buffer.byteLength(text, 'utf8') + 1 <= maxBytes) return text
  return renderBoundedJson(
    {
      output: text,
      omittedPathCount: text === '' ? 0 : text.split('\n').length,
    },
    maxBytes,
  )
}

function parseSelection(expression: string): string[] {
  const trimmed = expression.trim()
  if (!trimmed) throw new ResultSelectionError('--select requires a non-empty path.')
  if (trimmed === '/') return ['']
  if (trimmed.startsWith('/')) {
    return trimmed
      .slice(1)
      .split('/')
      .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
  }

  const source = trimmed.replace(/^\$\.?/, '')
  const segments: string[] = []
  let cursor = 0
  while (cursor < source.length) {
    if (source[cursor] === '.') {
      cursor += 1
      continue
    }
    if (source[cursor] === '[') {
      const close = source.indexOf(']', cursor + 1)
      if (close < 0)
        throw new ResultSelectionError(`Invalid selection ${JSON.stringify(expression)}.`, {
          expression,
        })
      const segment = source.slice(cursor + 1, close)
      if (!/^\d+$|^\*$/.test(segment)) {
        throw new ResultSelectionError(
          `Invalid bracket segment ${JSON.stringify(segment)}; use a numeric index or * wildcard.`,
          { expression },
        )
      }
      segments.push(segment)
      cursor = close + 1
      continue
    }
    const nextDot = source.indexOf('.', cursor)
    const nextBracket = source.indexOf('[', cursor)
    const boundaries = [nextDot, nextBracket].filter((index) => index >= 0)
    const end = boundaries.length > 0 ? Math.min(...boundaries) : source.length
    const segment = source.slice(cursor, end)
    if (!segment)
      throw new ResultSelectionError(`Invalid selection ${JSON.stringify(expression)}.`, {
        expression,
      })
    segments.push(segment)
    cursor = end
  }
  return segments
}

function selectMatches(matches: Match[], segments: string[]): Match[] {
  let current = matches
  for (const segment of segments) {
    const next: Match[] = []
    for (const match of current) {
      if (segment === '*') {
        if (Array.isArray(match.value)) {
          for (const [index, value] of match.value.entries()) {
            next.push({ path: `${match.path}/${index}`, value })
          }
        } else if (isRecord(match.value)) {
          for (const [key, value] of Object.entries(match.value)) {
            next.push({ path: `${match.path}/${escapePointer(key)}`, value })
          }
        }
        continue
      }
      if (Array.isArray(match.value) && /^\d+$/.test(segment)) {
        const index = Number(segment)
        if (index < match.value.length)
          next.push({ path: `${match.path}/${index}`, value: match.value[index] })
        continue
      }
      if (isRecord(match.value) && Object.hasOwn(match.value, segment)) {
        next.push({
          path: `${match.path}/${escapePointer(segment)}`,
          value: match.value[segment],
        })
      }
    }
    current = next
  }
  return current
}

function countLeafPaths(value: unknown): number {
  let count = 0
  const stack = [value]
  while (stack.length > 0 && count < MAX_COUNTED_PATHS) {
    const current = stack.pop()
    if (Array.isArray(current)) {
      if (current.length === 0) count += 1
      else stack.push(...current)
    } else if (isRecord(current)) {
      const values = Object.values(current)
      if (values.length === 0) count += 1
      else stack.push(...values)
    } else {
      count += 1
    }
  }
  return count
}

function escapePointer(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1')
}
