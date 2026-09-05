/** Canonical message for an unknown thrown value — the one place deciding how non-`Error` throws render. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface ValidationIssue {
  path: readonly PropertyKey[]
  message: string
}

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
    .slice(0, 3)
    .map((issue) => `${jsonPointer(issue.path)}: ${safeDiagnostic(issue.message)}`)
    .join('; ')
  const base = `Invalid arguments for "${safeDiagnostic(tool)}": ${details || '/: invalid arguments'}`
  if (!hint) return base
  const required = hint.requiredKeys.join(', ') || '(none)'
  return `${base} — required: ${required}; minimal call: ${safeDiagnostic(hint.exampleArgs)}`
}

/** RFC 6901 JSON Pointer keeps nested object/array failures unambiguous and shell-copyable. */
export function jsonPointer(path: readonly PropertyKey[]): string {
  if (path.length === 0) return '/'
  return `/${path
    .map((part) => String(part).replaceAll('~', '~0').replaceAll('/', '~1'))
    .join('/')}`
}

function safeDiagnostic(value: string): string {
  const printable = [...value]
    .map((character) => {
      const point = character.codePointAt(0) ?? 0
      return point <= 31 || point === 127 ? '?' : character
    })
    .join('')
  return printable.length > 200 ? `${printable.slice(0, 200)}…` : printable
}
