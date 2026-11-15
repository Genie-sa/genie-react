import type { z } from 'zod'

/** Extension point (TanStack-style `Register`): augment via declaration merging (`toolGroups: '…'`) to add plugin tool groups. */
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
  | 'perf'
  | 'timeline'
  | 'action'
  | 'app'

/** Built-in groups plus app-declared subgroups (`app.cart`) and `Register`-contributed ones; the fallback is `never`, so an unregistered group is a type error. */
export type ToolGroup =
  | BuiltInToolGroup
  | `app.${string}`
  | (Register extends { toolGroups: infer G extends string } ? G : never)

/** Hints advertised alongside each tool so the agent can reason about it (read-only vs. mutating, idempotent) before calling. */
export interface AgentToolAnnotations {
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
}

/** The part of a Zod 4 schema that tool types read. Constraining by `z.ZodType` would make TypeScript compare the app's zod classes with genie-react's member by member whenever the two resolve to different copies of zod, which exhausted the checker's memory; reading only the schema's output type keeps that check shallow across zod 4 releases. */
export interface GenieToolSchema<Output = unknown> {
  readonly _zod: { readonly output: Output }
}

/** Single source of truth per tool: one declaration drives the advertised JSON Schema, the TS types, and the wire descriptor. */
export interface AgentToolContract<
  Input extends GenieToolSchema = z.ZodType,
  Output extends GenieToolSchema = z.ZodType,
> {
  name: string
  title: string
  description: string
  group: ToolGroup
  input: Input
  output: Output
  annotations?: AgentToolAnnotations
}

export function defineAgentToolContract<
  Input extends GenieToolSchema,
  Output extends GenieToolSchema,
>(contract: AgentToolContract<Input, Output>): AgentToolContract<Input, Output> {
  return contract
}

/** Wire argument shape — `z.input`, so fields with a Zod `.default()` stay optional (the app applies defaults on parse). */
export type ToolInput<C extends AgentToolContract<GenieToolSchema, GenieToolSchema>> = z.input<
  C['input']
>

/** The result shape a contract produces — `z.output` of its output schema. */
export type ToolOutput<C extends AgentToolContract<GenieToolSchema, GenieToolSchema>> = z.output<
  C['output']
>

/** A collector contributing live data and/or agent tools; third-party plugins implement this too, so no forking. */
export interface CollectorMeta {
  id: string
  title: string
  description?: string
}
