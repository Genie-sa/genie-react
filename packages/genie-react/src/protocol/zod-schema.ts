import type { z } from 'zod'
import type { GenieToolSchema } from './contract'

/** Runtime counterpart of {@link GenieToolSchema}: tells a Zod 4 schema from any other value, whichever copy of zod built it. */
export function isZodSchema(schema: GenieToolSchema): schema is GenieToolSchema & z.ZodType {
  const internals: unknown = schema._zod
  return (
    typeof internals === 'object' &&
    internals !== null &&
    'def' in internals &&
    'safeParse' in schema &&
    typeof schema.safeParse === 'function'
  )
}

/** The error a tool definition raises when a plain JavaScript caller, or a Zod 3 schema, reaches it, so the failure names the tool instead of surfacing on its first call. */
export function notZodSchemaError(
  definer: string,
  toolName: string,
  field: 'input' | 'output',
): Error {
  return new Error(
    `${definer}: "${toolName}" ${field} must be a Zod 4 schema, e.g. z.object({ id: z.string() }) imported from "zod"`,
  )
}
