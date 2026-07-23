import { z } from 'zod'
import type { AgentToolContract } from '../protocol'

/** Structured failure an app tool handler can throw; `code` and `hint` fold into the agent-visible message, so recovery guidance travels with the error. */
export class GenieToolError extends Error {
  readonly code: string | undefined
  readonly hint: string | undefined

  constructor(message: string, options: { code?: string; hint?: string } = {}) {
    const prefix = options.code ? `[${options.code}] ` : ''
    const suffix = options.hint ? ` — hint: ${options.hint}` : ''
    super(`${prefix}${message}${suffix}`)
    this.name = 'GenieToolError'
    this.code = options.code
    this.hint = options.hint
  }
}

/** Kind-specific options: retry and caution hints are only expressible where they mean something. */
export type GenieToolKindOptions =
  | {
      /** Read-only and safe to retry; advertised as such so agents call it freely. */
      kind: 'query'
    }
  | {
      /** Mutates app state; agents treat it deliberately. */
      kind: 'action'
      /** Marks an action the agent should treat with extra caution (deletes data, irreversible). */
      destructive?: boolean
      /** Declares that repeating the action with the same args is safe, so agents can retry after a timeout. */
      idempotent?: boolean
    }

/** Inferred arg type when `input` is omitted: a no-arg tool. */
export type DefaultToolInput = z.ZodType<Record<string, never>>
/** Inferred result type when `output` is omitted: anything serializable. */
export type DefaultToolOutput = z.ZodType<unknown>

/** What a dev writes to expose one custom tool; the zod schemas drive validation, TS types, and the advertised JSON Schema. */
export type GenieToolDefinition<
  I extends z.ZodType = DefaultToolInput,
  O extends z.ZodType = DefaultToolOutput,
> = GenieToolKindOptions & {
  /** snake_case (kebab-case accepted); advertised to agents as `app_<name>`. */
  name: string
  /** The agent-facing doc: what it does, when to reach for it, and what the result means. */
  description: string
  /** Zod object schema for the args; omit for no-arg tools. Defaults and constraints become agent-visible docs. */
  input?: I
  /** Optional result schema: advertised to the agent, and drift-checked in dev builds. */
  output?: O
  /** Optional subgroup for progressive discovery on large surfaces: `group: 'cart'` lists the tool under `app.cart`. Omit for the flat `app` group. */
  group?: string
  /** Human title for listings; derived from the name when omitted. */
  title?: string
  /** Raises this tool's result-size cap (default 128KB) when it legitimately returns more; results are agent context, so prefer summaries and limit args. */
  maxResultBytes?: number
  /** Receives args parsed by `input` (defaults applied); may be async. Keep sync work well under a second (a blocked main thread trips the CLI's busy detection) and throw {@link GenieToolError} for failures the agent should act on. */
  handler: (args: z.output<I>) => z.output<O> | Promise<z.output<O>>
}

/** A defined app tool, ready for `registerGenieTools`, `useGenieTools`, or `<Genie tools={...}>`. */
export interface GenieAppTool {
  contract: AgentToolContract
  handler: (args: never) => unknown
  maxResultBytes: number | undefined
}

const APP_TOOL_NAME_PATTERN = /^app_[a-z0-9][a-z0-9_]*$/
const DESCRIPTION_SOFT_CAP = 500

/** Defines a custom app tool from one declaration — name, agent-facing description, zod input schema, handler; validation, discovery docs, and the advertised JSON Schema all derive from it. */
export function defineGenieTool<
  I extends z.ZodType = DefaultToolInput,
  O extends z.ZodType = DefaultToolOutput,
>(definition: GenieToolDefinition<I, O>): GenieAppTool {
  const name = normalizeAppToolName(definition.name)
  validateDefinition(name, definition)
  const contract: AgentToolContract = {
    name,
    title: definition.title ?? defaultTitle(name),
    description: definition.description,
    group: appGroup(name, definition.group),
    input: definition.input ?? z.object({}),
    output: definition.output ?? z.unknown(),
    annotations: annotationsOf(definition),
  }
  return {
    contract,
    // Args reach the handler only after contract.input.parse, so the erased signature is safe by construction.
    handler: definition.handler as (args: never) => unknown,
    maxResultBytes: definition.maxResultBytes,
  }
}

function annotationsOf(definition: GenieToolKindOptions): AgentToolContract['annotations'] {
  if (definition.kind === 'query') return { readOnlyHint: true, idempotentHint: true }
  return {
    readOnlyHint: false,
    ...(definition.destructive ? { destructiveHint: true } : {}),
    ...(definition.idempotent ? { idempotentHint: true } : {}),
  }
}

const APP_GROUP_PATTERN = /^[a-z0-9][a-z0-9_]*$/

/** Subgroups namespace under `app.` so the whole family sits together in the group index and `tools app` drills into all of it. */
function appGroup(name: string, raw: string | undefined): AgentToolContract['group'] {
  if (raw === undefined) return 'app'
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')
    .replace(/^app\./, '')
  if (!APP_GROUP_PATTERN.test(normalized)) {
    throw new Error(
      `defineGenieTool: "${name}" has an invalid group ${JSON.stringify(raw)} — one snake_case segment, e.g. "cart" (listed as app.cart)`,
    )
  }
  return `app.${normalized}`
}

/** Kebab-case and stray whitespace normalize to snake_case, and the `app_` namespace is applied exactly once. */
export function normalizeAppToolName(raw: string): string {
  const snake = raw
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')
  const namespaced = snake.startsWith('app_') ? snake : `app_${snake}`
  if (!APP_TOOL_NAME_PATTERN.test(namespaced)) {
    throw new Error(
      `defineGenieTool: invalid tool name ${JSON.stringify(raw)} — use snake_case letters, digits, and underscores, e.g. "seed_cart"`,
    )
  }
  return namespaced
}

function validateDefinition(
  name: string,
  definition: { kind: string; handler: unknown; description: string },
): void {
  if (definition.kind !== 'query' && definition.kind !== 'action') {
    throw new Error(`defineGenieTool: "${name}" needs kind "query" or "action" (read vs mutate)`)
  }
  if (typeof definition.handler !== 'function') {
    throw new Error(`defineGenieTool: "${name}" needs a handler function`)
  }
  if (typeof definition.description !== 'string' || definition.description.trim().length < 20) {
    console.warn(
      `[genie] app tool "${name}" has a thin description — the description is the only doc an agent gets; say what it does, when to use it, and what the result means`,
    )
  } else if (definition.description.length > DESCRIPTION_SOFT_CAP) {
    console.warn(
      `[genie] app tool "${name}" has a ${definition.description.length}-char description — agents pay for every token in the catalog; keep it under ${DESCRIPTION_SOFT_CAP} chars`,
    )
  }
}

function defaultTitle(name: string): string {
  const words = name.replace(/^app_/, '').split('_').filter(Boolean).join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
