import { z } from 'zod'

export const sourceSchema = z
  .object({
    file: z.string(),
    line: z.number().nullable(),
    column: z.number().nullable(),
    functionName: z.string().nullable(),
    sourceMapConfidence: z
      .enum(['mapped', 'served'])
      .optional()
      .describe(
        'mapped: a source map translated the position to the original file. served: the position is as the dev server served the module, which matches the file on disk only when the transform kept its lines.',
      ),
    role: z
      .enum(['element-callsite', 'component-body'])
      .optional()
      .describe(
        'element-callsite: where the element was created, e.g. `<Card />` inside its parent (functionName names that parent). component-body: a line inside the component itself. Absent when unknown.',
      ),
  })
  .nullable()

export const sourceProvenanceSchema = z.object({
  definitionSource: sourceSchema,
  allocationCallsite: sourceSchema,
  hookDefinitionOwner: sourceSchema,
  hookCallsite: sourceSchema,
  package: z.string().nullable(),
  sourceMapConfidence: z.enum(['mapped', 'served', 'unknown']),
  failureReason: z
    .enum([
      'source-unresolved',
      'definition-and-allocation-not-distinguished',
      'hook-provenance-unavailable',
    ])
    .nullable(),
  usageOrDefinitionFallback: sourceSchema,
})

export const wrapperFrameSchema = z.object({
  kind: z.enum(['memo', 'forward-ref', 'lazy', 'compiler-memo-cache', 'wrapper']),
  name: z.string(),
})

export const appOnlySchema = z
  .boolean()
  .default(false)
  .describe(
    'Include only proven app ownership when true; library and unknown ownership are excluded with coverage. False includes all ownership classes.',
  )
export const ownershipCoverageSchema = z.object({
  complete: z.boolean(),
  totalCandidates: z.number().int().nonnegative(),
  app: z.number().int().nonnegative(),
  library: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
})
