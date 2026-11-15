import { z } from 'zod'
import { defineAgentToolContract } from './contract'
import { appInfoSchema } from './protocol'
import { renderObservationBudgetInputSchema } from './react-observation-schema'

export { DEFAULT_RENDER_OBSERVATION_BUDGET } from './react-observation-schema'

export const VERIFY_SCHEMA_VERSION = '1.0' as const
export const MAX_VERIFY_CLAIMS = 20
export const MAX_VERIFY_TARGETS = 10
export const DEFAULT_VERIFY_MAX_DURATION_MS = 300_000

export const VERDICTS = ['pass', 'fail', 'refused', 'inconclusive'] as const
export type Verdict = (typeof VERDICTS)[number]

/** The exit code each verdict carries, so a script or agent cannot read a refusal as a pass. */
export const VERDICT_EXIT_CODES = { pass: 0, fail: 1, refused: 4, inconclusive: 5 } as const

/** Closed list: every refusal names one of these and a fix. */
export const REFUSAL_REASONS = [
  'coverage_incomplete',
  'budget_exhausted',
  'evidence_truncated',
  'evidence_inferred',
  'evidence_unavailable',
  'not_quiescent',
  'no_activity',
  'target_not_found',
  'target_ambiguous',
  'target_inactive',
  'session_changed',
  'window_interrupted',
  'code_changed',
  'document_hidden',
  'override_active',
  'unsupported_environment',
  'capability_unavailable',
  'too_few_samples',
  'not_comparable',
  'window_lost',
] as const
export type RefusalReason = (typeof REFUSAL_REASONS)[number]

/** Closed list: complete, valid evidence that still does not decide the claim. */
export const INCONCLUSIVE_REASONS = [
  'not_significant',
  'below_minimum_effect',
  'strict_mode_replay',
  'mixed_instance_evidence',
] as const
export type InconclusiveReason = (typeof INCONCLUSIVE_REASONS)[number]

/** Domains a verification can settle on before it freezes; React is always one of them. */
export const VERIFY_SETTLE_DOMAINS = ['react', 'query', 'router'] as const
export type VerifySettleDomain = (typeof VERIFY_SETTLE_DOMAINS)[number]

/** Claim kinds of this release; Query, Router, Suspense and budget claims join this union later. */
export const VERIFY_CLAIM_KINDS = [
  'renders',
  'render-causes',
  'effect-runs',
  'effect-settles',
  'boundaries-clean',
] as const

export const VERIFY_CAUSE_KINDS = [
  'mount',
  'children',
  'router',
  'props',
  'state',
  'context',
  'query',
  'parent',
  'external-store',
] as const

/** Causes the render evidence only ever reports as inferred, so no run can prove a claim that depends on them. */
export const ALWAYS_INFERRED_CAUSE_KINDS: ReadonlySet<VerifyCause['kind']> = new Set([
  'parent',
  'external-store',
])

const DSL_DELIMITERS = /[\s@[\]#,]/

const componentNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .refine((name) => !DSL_DELIMITERS.test(name), {
    message: 'a component name cannot contain whitespace, @, [, ], # or ,',
  })
  .describe('Exact component display name; never a numeric component ID.')

const printableText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)
    .refine(
      (value) => ![...value].some((character) => (character.codePointAt(0) ?? 0) <= 31),
      `${label} cannot contain control characters`,
    )

export const verifyTargetSchema = z
  .object({
    component: componentNameSchema,
    source: printableText('source', 300)
      .refine((value) => !DSL_DELIMITERS.test(value), {
        message: 'a source path cannot contain whitespace, @, [, ], # or ,',
      })
      .optional()
      .describe(
        'Narrow to instances whose component source file ends with this path, e.g. src/screens/StatusBadge.tsx.',
      ),
    key: z
      .string()
      .max(200)
      .refine((value) => !/[\]\s]/.test(value), {
        message: 'a key cannot contain whitespace or ]',
      })
      .optional()
      .describe('Narrow to instances with this React key.'),
  })
  .strict()
export type VerifyTarget = z.infer<typeof verifyTargetSchema>

export const verifyEffectTargetSchema = verifyTargetSchema
  .extend({
    effectIndex: z
      .number()
      .int()
      .min(0)
      .max(99)
      .optional()
      .describe(
        'Effect hook position in call order, as react_effect_audit reports it; omitted means each effect of the component separately.',
      ),
  })
  .strict()
export type VerifyEffectTarget = z.infer<typeof verifyEffectTargetSchema>

export const verifyCauseSchema = z
  .object({
    kind: z.enum(VERIFY_CAUSE_KINDS),
    name: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .refine((value) => !/[\s,]/.test(value), {
        message: 'a cause name cannot contain whitespace or ,',
      })
      .optional()
      .describe(
        'Prop name, state hook name (state[0], reducer[1], class state), context display name, or queryHash; omitted allows any of that kind.',
      ),
  })
  .strict()
export type VerifyCause = z.infer<typeof verifyCauseSchema>

const boundSchema = z.number().int().min(0).max(100_000)

const rendersClaimSchema = z
  .object({
    kind: z.literal('renders'),
    target: verifyTargetSchema,
    max: boundSchema.optional(),
    min: boundSchema.optional(),
    counting: z
      .enum(['renders', 'updates'])
      .default('renders')
      .describe(
        'renders counts mounts and updates; updates counts updates and still fails on remounts.',
      ),
    allowRemount: z
      .boolean()
      .default(false)
      .describe('With counting updates, do not fail a max claim on remounts.'),
  })
  .strict()
  .refine((claim) => (claim.max === undefined) !== (claim.min === undefined), {
    message: 'a renders claim takes exactly one of max or min',
  })
  .refine((claim) => !claim.allowRemount || claim.counting === 'updates', {
    message: 'allowRemount applies only with counting updates',
  })

const renderCausesClaimSchema = z
  .object({
    kind: z.literal('render-causes'),
    target: verifyTargetSchema,
    allow: z.array(verifyCauseSchema).min(1).max(20),
  })
  .strict()

const effectRunsClaimSchema = z
  .object({
    kind: z.literal('effect-runs'),
    target: verifyEffectTargetSchema,
    max: boundSchema,
  })
  .strict()

const effectSettlesClaimSchema = z
  .object({ kind: z.literal('effect-settles'), target: verifyEffectTargetSchema })
  .strict()

const boundariesClaimSchema = z
  .object({
    kind: z.literal('boundaries-clean'),
    scope: z
      .enum(['window', 'end'])
      .default('window')
      .describe(
        'window: no boundary caught during the window and none is in an error state at the end; end: only the end state.',
      ),
  })
  .strict()

export const verifyClaimSchema = z.discriminatedUnion('kind', [
  rendersClaimSchema,
  renderCausesClaimSchema,
  effectRunsClaimSchema,
  effectSettlesClaimSchema,
  boundariesClaimSchema,
])
export type VerifyClaim = z.infer<typeof verifyClaimSchema>
export type VerifyClaimInput = z.input<typeof verifyClaimSchema>

const lifecycleSchema = z
  .object({
    bufferLimit: z.number().int().min(100).max(20_000).default(1_000),
    targetReserve: z.number().int().min(0).max(5_000).default(100),
  })
  .default({ bufferLimit: 1_000, targetReserve: 100 })
  .refine((value) => value.targetReserve <= value.bufferLimit, {
    message: 'targetReserve cannot exceed bufferLimit',
    path: ['targetReserve'],
  })

const settleInputSchema = z
  .object({
    quietMs: z
      .number()
      .int()
      .min(100)
      .max(5_000)
      .default(500)
      .describe('How long every settle domain must stay quiet.'),
    timeoutMs: z.number().int().min(500).max(60_000).default(10_000),
    domains: z
      .array(z.enum(VERIFY_SETTLE_DOMAINS))
      .min(1)
      .max(VERIFY_SETTLE_DOMAINS.length)
      .optional()
      .describe(
        'Defaults to every domain the app advertises. A narrowed list must keep react; work in a dropped domain is no longer waited for.',
      ),
  })
  .strict()
  .default({ quietMs: 500, timeoutMs: 10_000 })

export function verifyTargetKey(target: VerifyTarget): string {
  return JSON.stringify([target.component, target.source ?? null, target.key ?? null])
}

export function claimTarget(claim: VerifyClaim): VerifyTarget | null {
  if (claim.kind === 'boundaries-clean') return null
  const { component, source, key } = claim.target
  return {
    component,
    ...(source === undefined ? {} : { source }),
    ...(key === undefined ? {} : { key }),
  }
}

export const devtoolsVerifyBeginContract = defineAgentToolContract({
  name: 'devtools_verify_begin',
  title: 'Begin a verification',
  description:
    'Declare claims about one interaction, resolve their targets, and start a locked observation window on one document. Drive the UI, then call devtools_verify_end. A target, capability or environment problem refuses here, before the interaction. While the window records, react_clear_renders, react_profile_start, react_profile_stop, devtools_interaction_begin and the override tools are refused on that document.',
  group: 'meta',
  input: z
    .object({
      name: printableText('verification name', 80),
      claims: z.array(verifyClaimSchema).min(1).max(MAX_VERIFY_CLAIMS),
      budget: renderObservationBudgetInputSchema,
      lifecycle: lifecycleSchema,
      settle: settleInputSchema,
      tailMs: z
        .number()
        .int()
        .min(0)
        .max(30_000)
        .optional()
        .describe(
          'How long to keep recording after the app settles; default is quietMs (at least 500), or for effect settles claims the larger of twice quietMs and 2000.',
        ),
      maxDurationMs: z
        .number()
        .int()
        .min(10_000)
        .max(1_800_000)
        .default(DEFAULT_VERIFY_MAX_DURATION_MS)
        .describe('The hub expires an unfinished window after this long and releases the lock.'),
      allowOverrides: z
        .boolean()
        .default(false)
        .describe(
          'Allow overrides and simulated Query state during the window; the verdict then says they were active.',
        ),
    })
    .strict()
    .superRefine((input, context) => {
      const targets = new Set(
        input.claims.flatMap((claim) => {
          const target = claimTarget(claim)
          return target ? [verifyTargetKey(target)] : []
        }),
      )
      if (targets.size > MAX_VERIFY_TARGETS) {
        context.addIssue({
          code: 'custom',
          path: ['claims'],
          message: `a verification accepts at most ${MAX_VERIFY_TARGETS} distinct targets`,
        })
      }
      const domains = input.settle.domains
      if (domains && new Set(domains).size !== domains.length) {
        context.addIssue({
          code: 'custom',
          path: ['settle', 'domains'],
          message: 'domains must be unique',
        })
      }
      if (domains && !domains.includes('react')) {
        context.addIssue({
          code: 'custom',
          path: ['settle', 'domains'],
          message: 'domains must include react',
        })
      }
    }),
  output: z.unknown(),
  annotations: { idempotentHint: false },
})

const verificationIdSchema = z.string().regex(/^vfy_[0-9a-f-]{36}$/, 'not a verification ID')

export const devtoolsVerifyEndContract = defineAgentToolContract({
  name: 'devtools_verify_end',
  title: 'End a verification and return its verdict',
  description:
    'Settle the app across the settle domains with recording on, keep recording for the tail, freeze, read the evidence once, and decide every claim: pass, fail, refused or inconclusive. Idempotent: a repeated call returns the stored verdict.',
  group: 'meta',
  input: z.object({ verificationId: verificationIdSchema }).strict(),
  output: z.unknown(),
  annotations: { idempotentHint: true },
})

export const devtoolsVerifyReadContract = defineAgentToolContract({
  name: 'devtools_verify_read',
  title: 'Read a stored verdict and its evidence',
  description:
    'Return a stored verdict, every deciding item of one claim, the guards with their raw inputs, or a retained raw tool result. Reading never changes a verdict.',
  group: 'meta',
  input: z
    .object({
      verificationId: verificationIdSchema,
      claim: z.number().int().min(1).max(MAX_VERIFY_CLAIMS).optional(),
      section: z
        .string()
        .regex(/^(?:guards|raw:[a-z][a-z0-9_]{0,63})$/, 'section is guards or raw:<tool>')
        .optional(),
    })
    .strict()
    .refine((input) => input.claim === undefined || input.section === undefined, {
      message: 'claim and section are mutually exclusive',
    }),
  output: z.unknown(),
  annotations: { readOnlyHint: true },
})

export const devtoolsVerifyAbortContract = defineAgentToolContract({
  name: 'devtools_verify_abort',
  title: 'Abort a verification',
  description:
    'End a verification window without a verdict and release its document lock. Nothing is written to the rerun history.',
  group: 'meta',
  input: z.object({ verificationId: verificationIdSchema }).strict(),
  output: z.unknown(),
  annotations: { idempotentHint: true },
})

export const verifyTools = [
  devtoolsVerifyBeginContract,
  devtoolsVerifyEndContract,
  devtoolsVerifyReadContract,
  devtoolsVerifyAbortContract,
]

export const verifyFixSchema = z.object({
  action: z.enum([
    'begin-again',
    'drive-observed-tab',
    'find-target',
    'list-target-sources',
    'reset-overrides',
    'check-setup',
    'change-claim',
  ]),
  budget: z.record(z.string(), z.number()).optional(),
  settle: z.object({ quietMs: z.number().optional(), timeoutMs: z.number().optional() }).optional(),
  component: z.string().optional(),
  url: z.string().optional(),
})
export type VerifyFix = z.infer<typeof verifyFixSchema>

export const verifyRefusalSchema = z.object({
  reason: z.enum(REFUSAL_REASONS),
  message: z.string(),
  evidence: z.record(z.string(), z.unknown()).optional(),
  fix: verifyFixSchema,
})
export type VerifyRefusal = z.infer<typeof verifyRefusalSchema>

export const verifyInconclusiveSchema = z.object({
  reason: z.enum(INCONCLUSIVE_REASONS),
  message: z.string(),
  evidence: z.record(z.string(), z.unknown()).optional(),
})
export type VerifyInconclusive = z.infer<typeof verifyInconclusiveSchema>

export const verifyClaimResultSchema = z.object({
  index: z.number().int().positive(),
  text: z.string(),
  claim: verifyClaimSchema,
  verdict: z.enum(VERDICTS),
  observed: z.record(z.string(), z.unknown()),
  deciding: z.array(z.record(z.string(), z.unknown())),
  caveats: z.array(z.string()),
  refusal: verifyRefusalSchema.optional(),
  inconclusive: verifyInconclusiveSchema.optional(),
})
export type VerifyClaimResult = z.infer<typeof verifyClaimResultSchema>

export const VERIFY_GUARDS = [
  'same-document',
  'window-intact',
  'development-bundle',
  'render-collection',
  'no-code-change',
  'document-visible',
  'no-overrides',
  'activity',
  'settled',
] as const
export type VerifyGuardName = (typeof VERIFY_GUARDS)[number]

export const verifyGuardSchema = z.object({
  guard: z.enum(VERIFY_GUARDS),
  status: z.enum(['ok', 'refused', 'caveat', 'unobserved']),
  reason: z.enum(REFUSAL_REASONS).optional(),
  message: z.string().optional(),
  raw: z.record(z.string(), z.unknown()),
})
export type VerifyGuard = z.infer<typeof verifyGuardSchema>

export const verificationSessionSchema = z.object({
  sessionId: z.string(),
  logicalSessionId: z.string().optional(),
  documentGeneration: z.number().int().positive().optional(),
  sessionName: z.string().optional(),
  url: z.string().optional(),
  app: appInfoSchema,
})

export const verificationLedgerSchema = z.object({
  fingerprint: z.string(),
  scope: z.literal('logical-session'),
  storage: z.literal('memory').describe('Rerun history lives in the hub; a hub restart resets it.'),
  attempt: z.number().int().positive(),
  history: z.array(
    z.object({
      verificationId: z.string(),
      verdict: z.enum(VERDICTS),
      reasons: z.array(z.string()),
      endedAt: z.string(),
    }),
  ),
  codeChangedSincePrevious: z
    .enum(['fast-refresh', 'document-reloaded', 'none-observed'])
    .nullable(),
  failsOnSameCode: z.number().int().nonnegative(),
})
export type VerificationLedgerView = z.infer<typeof verificationLedgerSchema>

/** One claim in the canonical DSL, the inverse of the CLI parser; also what the verdict prints as `text`. */
export function formatVerifyClaim(claim: VerifyClaim): string {
  switch (claim.kind) {
    case 'renders': {
      const bound = claim.max === undefined ? `min ${claim.min}` : `max ${claim.max}`
      const counting = claim.counting === 'updates' ? ' counting updates' : ''
      const remount = claim.allowRemount ? ' allow-remount' : ''
      return `render ${formatVerifyTarget(claim.target)} ${bound}${counting}${remount}`
    }
    case 'render-causes':
      return `render ${formatVerifyTarget(claim.target)} only ${claim.allow.map(formatVerifyCause).join(',')}`
    case 'effect-runs':
      return `effect ${formatVerifyTarget(claim.target)} max ${claim.max}`
    case 'effect-settles':
      return `effect ${formatVerifyTarget(claim.target)} settles`
    case 'boundaries-clean':
      return claim.scope === 'end' ? 'boundaries clean-at-end' : 'boundaries clean'
  }
}

export function formatVerifyTarget(target: VerifyTarget | VerifyEffectTarget): string {
  const source = target.source === undefined ? '' : `@${target.source}`
  const key = target.key === undefined ? '' : `[key=${target.key}]`
  const effect =
    'effectIndex' in target && target.effectIndex !== undefined ? `#${target.effectIndex}` : ''
  return `${target.component}${source}${key}${effect}`
}

function formatVerifyCause(cause: VerifyCause): string {
  return cause.name === undefined ? cause.kind : `${cause.kind}.${cause.name}`
}
