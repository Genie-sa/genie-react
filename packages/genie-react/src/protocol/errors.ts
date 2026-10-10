import { z } from 'zod'
import type { ToolErrorDetails, ToolErrorIssue } from './protocol'

/** Canonical message for an unknown thrown value — the one place deciding how non-`Error` throws render. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface ValidationIssue {
  path: readonly PropertyKey[]
  message: string
  expected?: unknown
  values?: readonly unknown[]
}

const MAX_REPORTED_ISSUES = 3
const MAX_LISTED_VALUES = 20

export interface ValidationCallHint {
  requiredKeys: readonly string[]
  exampleArgs: string
}

/** Minimal runnable args (required keys only) derived from a JSON-schema object — shared by CLI help and invalid-args errors. */
export function minimalExampleArgs(
  properties: Record<string, unknown>,
  required: ReadonlySet<unknown>,
  schema?: unknown,
): string {
  if (
    schema &&
    typeof schema === 'object' &&
    'examples' in schema &&
    Array.isArray(schema.examples)
  ) {
    const example = schema.examples[0]
    if (example && typeof example === 'object' && !Array.isArray(example))
      return JSON.stringify(example)
  }
  const example: Record<string, unknown> = {}
  for (const name of Object.keys(properties)) {
    if (required.has(name)) example[name] = examplePropValue(properties[name], name)
  }
  return JSON.stringify(example)
}

function examplePropValue(schema: unknown, name: string): unknown {
  if (typeof schema === 'object' && schema !== null) {
    const { enum: options, default: fallback, type } = schema as Record<string, unknown>
    if (Array.isArray(options) && options.length > 0) return options[0]
    if (fallback !== undefined) return fallback
    const first = Array.isArray(type) ? type[0] : type
    if (first === 'number' || first === 'integer') return 1
    if (first === 'boolean') return true
    if (first === 'array') return []
    if (first === 'object') return {}
  }
  return `<${name}>`
}

/** Stable, bounded validation text shared by browser tools and bridge-local tools. */
export function formatToolValidationError(
  tool: string,
  issues: readonly ValidationIssue[],
  hint?: ValidationCallHint,
): string {
  const details = issues
    .slice(0, MAX_REPORTED_ISSUES)
    .map((issue) => `${jsonPointer(issue.path)}: ${safeDiagnostic(issue.message)}`)
    .join('; ')
  const base = `Invalid arguments for "${safeDiagnostic(tool)}": ${details || '/: invalid arguments'}`
  if (!hint) return base
  const required = hint.requiredKeys.join(', ') || '(none)'
  return `${base} — required: ${required}; minimal call: ${safeDiagnostic(hint.exampleArgs)}`
}

/** A validation failure in both renderings: bounded prose for the wire `error` and structured `errorDetails` for agents. */
export function toolValidationFailure(
  tool: string,
  issues: readonly ValidationIssue[],
  options: { input?: z.ZodType; args?: unknown } = {},
): { error: string; errorDetails: ToolErrorDetails } {
  const hint = options.input && validationCallHint(options.input)
  return {
    error: formatToolValidationError(tool, issues, hint),
    errorDetails: {
      issues: issues
        .slice(0, MAX_REPORTED_ISSUES)
        .map((issue) => describeIssue(issue, options.args)),
      ...(hint ? callHintDetails(hint) : {}),
    },
  }
}

/** Unrecognized argument keys, which zod objects would otherwise strip silently. */
export function unknownArgumentsFailure(
  tool: string,
  unknownKeys: readonly string[],
  validKeys: readonly string[],
  input?: z.ZodType,
): { error: string; errorDetails: ToolErrorDetails } {
  const rejected = unknownKeys.map((key) => `"${safeDiagnostic(key)}"`).join(', ')
  const hint = input && validationCallHint(input)
  return {
    error: `Unknown argument${unknownKeys.length === 1 ? '' : 's'} ${rejected} for "${safeDiagnostic(tool)}" — valid keys: ${validKeys.join(', ') || '(none)'}`,
    errorDetails: {
      unknownKeys: unknownKeys.slice(0, MAX_LISTED_VALUES).map((key) => safeDiagnostic(key)),
      validKeys: [...validKeys],
      ...(hint ? callHintDetails(hint) : {}),
    },
  }
}

/** A rejected call should teach the retry: name the required keys and echo a minimal valid invocation. */
export function validationCallHint(input: z.ZodType): ValidationCallHint | undefined {
  let schema: unknown
  try {
    schema = z.toJSONSchema(input, { io: 'input' })
  } catch {
    return undefined
  }
  if (typeof schema !== 'object' || schema === null) return undefined
  const { properties, required } = schema as {
    properties?: Record<string, unknown>
    required?: string[]
  }
  if (!properties) return undefined
  const requiredKeys = (required ?? []).filter((key) => key in properties)
  return {
    requiredKeys,
    exampleArgs: minimalExampleArgs(properties, new Set(requiredKeys), schema),
  }
}

function callHintDetails(hint: ValidationCallHint): ToolErrorDetails {
  const example: unknown = JSON.parse(hint.exampleArgs)
  return {
    requiredKeys: [...hint.requiredKeys],
    ...(typeof example === 'object' && example !== null && !Array.isArray(example)
      ? { exampleArgs: example as Record<string, unknown> }
      : {}),
  }
}

function describeIssue(issue: ValidationIssue, args: unknown): ToolErrorIssue {
  return {
    path: jsonPointer(issue.path),
    message: safeDiagnostic(issue.message),
    ...(typeof issue.expected === 'string' ? { expected: issue.expected } : {}),
    ...(issue.values && issue.values.length > 0
      ? {
          allowed: issue.values
            .slice(0, MAX_LISTED_VALUES)
            .map((value) => safeDiagnostic(typeof value === 'string' ? value : String(value))),
        }
      : {}),
    ...(args === undefined ? {} : { received: jsonKindAt(args, issue.path) }),
  }
}

/** The JSON type at a path, never the value, so a diagnostic cannot echo secrets the caller sent. */
function jsonKindAt(root: unknown, path: readonly PropertyKey[]): string {
  let value: unknown = root
  for (const key of path) {
    if (typeof value !== 'object' || value === null || !Object.hasOwn(value, key)) return 'missing'
    value = Reflect.get(value, key)
  }
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return value === undefined ? 'missing' : typeof value
}

/** RFC 6901 JSON Pointer keeps nested object/array failures unambiguous and shell-copyable. */
export function jsonPointer(path: readonly PropertyKey[]): string {
  if (path.length === 0) return '/'
  return `/${path
    .map((part) => String(part).replaceAll('~', '~0').replaceAll('/', '~1'))
    .join('/')}`
}

/** Control characters become `?` and long text is cut, so a diagnostic stays one bounded line. */
export function safeDiagnostic(value: string, maxLength = 200): string {
  const printable = [...value]
    .map((character) => {
      const point = character.codePointAt(0) ?? 0
      return point <= 31 || point === 127 ? '?' : character
    })
    .join('')
  return printable.length > maxLength ? `${printable.slice(0, maxLength)}…` : printable
}
