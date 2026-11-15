import { z } from 'zod'

/** An app value Genie serialised, which may be `undefined`. JSON cannot carry `undefined`, so the result omits the key rather than advertising one that goes missing. */
export function appValueSchema(description: string): z.ZodOptional<z.ZodUnknown> {
  return z.unknown().optional().describe(`${description} Omitted when the value is undefined.`)
}

/** A serialised value the handler always produces; it accepts any JSON value but rejects `undefined`, so a handler that leaves it unset fails the dev-time output check instead of dropping the key. */
export function definedValueSchema(description?: string): z.ZodUnknown {
  const schema = z.unknown().refine(isDefined, 'must be present')
  return description === undefined ? schema : schema.describe(description)
}

// Annotated as boolean so TypeScript does not infer a type predicate that narrows the schema's output.
function isDefined(value: unknown): boolean {
  return value !== undefined
}

/** JSON Schema metadata for an input that needs at least one of `keys`. A zod refine enforces the rule but never reaches the schema an agent reads, so each refine-only "one of" rule declares its alternatives here as well. */
export function requiresOneOf(...keys: readonly string[]): {
  anyOf: Array<{ required: [string] }>
} {
  return { anyOf: keys.map((key) => ({ required: [key] })) }
}
