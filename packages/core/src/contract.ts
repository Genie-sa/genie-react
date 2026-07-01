import type { z } from 'zod'

/**
 * Global extension point for third-party collectors, extended via declaration merging. Augment it to
 * teach {@link defineAgentToolContract} about your plugin's tool groups without forking core:
 *
 * ```ts
 * declare module '@genie-react/core' {
 *   interface Register {
 *     toolGroups: 'sentry.issues' | 'sentry.performance'
 *   }
 * }
 * ```
 *
 * Mirrors TanStack Query/Router's `Register` interface: one `declare module` retroactively widens the
 * types the whole surface reads, at zero runtime cost.
 */
// biome-ignore lint/suspicious/noEmptyInterface: intentional extension point for declaration merging
export interface Register {}

/** Tool groups shipped by Genie's built-in collectors. */
export type BuiltInToolGroup =
  | 'meta'
  | 'react.tree'
  | 'react.inspect'
  | 'react.render'
  | 'react.profile'
  | 'query'
  | 'router'
  | 'plugin'
  | 'memory'
  | 'action'

/**
 * The group a tool belongs to. Built-in groups keep literal-type autocomplete; plugins contribute
 * their own by augmenting {@link Register}. The fallback is `never` rather than `string`, so the
 * surface stays closed by default — an unregistered group is a type error, not silently accepted.
 */
export type ToolGroup =
  | BuiltInToolGroup
  | (Register extends { toolGroups: infer G extends string } ? G : never)

/**
 * Agent tool hints, advertised alongside each tool so the agent can reason about it before
 * calling (read-only vs. mutating, idempotent, etc.).
 */
export interface AgentToolAnnotations {
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
}

/**
 * The single source of truth for one agent tool. One declaration drives the advertised JSON Schema
 * (zod v4 is Standard Schema), the TypeScript arg/result types, and the wire descriptor — no drift.
 */
export interface AgentToolContract<
  Input extends z.ZodType = z.ZodType,
  Output extends z.ZodType = z.ZodType,
> {
  name: string
  title: string
  description: string
  group: ToolGroup
  input: Input
  output: Output
  annotations?: AgentToolAnnotations
}

export function defineAgentToolContract<Input extends z.ZodType, Output extends z.ZodType>(
  contract: AgentToolContract<Input, Output>,
): AgentToolContract<Input, Output> {
  return contract
}

/**
 * The argument shape a contract accepts on the wire — `z.input`, so fields with a Zod `.default()`
 * are optional (the app applies defaults when it parses). Paired with {@link ToolOutput}, this lets a
 * consumer holding a contract get an end-to-end typed round-trip without importing zod directly.
 */
export type ToolInput<C extends AgentToolContract> = z.input<C['input']>

/** The result shape a contract produces — `z.output` of its output schema. */
export type ToolOutput<C extends AgentToolContract> = z.output<C['output']>

/**
 * Describes a collector that contributes live data and/or agent tools. Built-in collectors
 * (react, query, router) and third-party plugins implement this so the surface is extensible
 * without forking.
 */
export interface CollectorMeta {
  id: string
  title: string
  description?: string
}
