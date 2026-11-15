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
      .enum(['element-callsite', 'component-body', 'hook-callsite'])
      .optional()
      .describe(
        'element-callsite: where the element was created, e.g. `<Card />` inside its parent (functionName names that parent). component-body: a line inside the component itself. hook-callsite: the hook call itself, e.g. the `useEffect(` that declared an effect. Absent when unknown.',
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
    'When true, hide components known to be library code. Components whose ownership is unresolved stay, marked "unknown", and filteredNote counts both. False includes everything.',
  )

export const ownershipBasisSchema = z
  .enum(['component-definition', 'owned-elements', 'element-callsite'])
  .describe(
    "What ownership rests on. component-definition: a frame inside the component's own body. owned-elements: every element the component created came from app source, or all of them from library code. element-callsite: the element was created inside library code, or, for a boundary such as Suspense that has no code of its own, wherever it was written.",
  )
export const ownershipCoverageSchema = z.object({
  complete: z.boolean(),
  totalCandidates: z.number().int().nonnegative(),
  app: z.number().int().nonnegative(),
  library: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
})

export const frameMappingSchema = z
  .enum(['mapped', 'served', 'unmapped-build-file'])
  .describe(
    'mapped: a source map translated the frame to the original file and line. served: the position is as the dev server served the module, which can differ from the file on disk after a transform. unmapped-build-file: the frame is in build output (a Next.js chunk, a bundle) that no source map explained, so open the original by its function name.',
  )

export const stackFrameSchema = z.object({
  functionName: z.string().nullable(),
  file: z.string().nullable(),
  line: z.number().int().nullable(),
  column: z.number().int().nullable(),
  isLibrary: z.boolean(),
  mapping: frameMappingSchema,
})
