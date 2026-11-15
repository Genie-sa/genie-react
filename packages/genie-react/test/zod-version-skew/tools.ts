import { z } from 'zod-version-skew'
import { defineGenieTool, useGenieTool } from '../../src/tools'

export const lookup = defineGenieTool({
  name: 'lookup',
  kind: 'query',
  description: 'Looks up one record by id so the skewed zod copy is exercised end to end.',
  input: z.object({ id: z.string(), limit: z.number().int().default(10) }),
  output: z.object({ id: z.string(), limit: z.number() }),
  handler: ({ id, limit }) => {
    // @ts-expect-error the inferred id is a string
    const numericId: number = id
    return { id: `${id}${numericId}`, limit }
  },
})

export const mistypedOutput = defineGenieTool({
  name: 'mistyped_output',
  kind: 'query',
  description: 'Returns a result that contradicts its output schema, which must not type-check.',
  output: z.object({ id: z.string() }),
  // @ts-expect-error the handler result must match the output schema
  handler: () => ({ id: 1 }),
})

export function useSeed(): void {
  useGenieTool({
    name: 'seed',
    kind: 'action',
    description:
      'Seeds a number of records so the hook signature is exercised with the skewed copy.',
    input: z.object({ count: z.number() }),
    handler: ({ count }) => ({ seeded: count.toFixed(0) }),
  })
}
