import type { z } from 'zod'
import type { AgentToolContract, AppInfo, CollectorMeta, GenieToolSchema } from '../protocol'
import { isZodSchema, notZodSchemaError } from '../protocol/zod-schema'

/** Handed to each collector so it can stream live state and refresh the advertised tool list. */
export interface CollectorContext {
  pushSnapshot: (domain: string, data: unknown) => void
  pushEvent: (domain: string, event: unknown) => void
  refreshTools: () => void
  /** Report that the app is doing work (e.g. a React commit) so a throttled heartbeat rides the render loop; keeps a commit-saturated thread from reading as busy when the interval timer is starved. */
  markActivity: () => void
}

export interface CollectorTool<
  I extends GenieToolSchema = z.ZodType,
  O extends GenieToolSchema = z.ZodType,
> {
  contract: AgentToolContract<I, O>
  handler: (args: z.infer<I>, ctx: CollectorContext) => z.infer<O> | Promise<z.infer<O>>
}

/** Live availability of an advertised tool: an unavailable tool stays listed (with a recovery hint) instead of vanishing. */
export type ToolAvailability = { available: true } | { available: false; reason: string }

/** Type-erased tool as stored by the registry; the `never` arg keeps every concrete {@link CollectorTool} contravariantly assignable. */
export interface ErasedCollectorTool {
  contract: AgentToolContract
  handler: (args: never, ctx: CollectorContext) => unknown
  availability?: () => ToolAvailability
}

/** The extension seam: built-in and third-party collectors implement this; the client aggregates their tools and app info. */
export interface GenieCollector {
  meta: CollectorMeta
  capabilities?: string[]
  tools?: ErasedCollectorTool[]
  appInfo?: () => Partial<AppInfo>
  // biome-ignore lint/suspicious/noConfusingVoidType: cleanup-or-nothing, like a React effect callback
  start?: (ctx: CollectorContext) => void | (() => void)
}

export function defineCollector(collector: GenieCollector): GenieCollector {
  return collector
}

/** Types the handler from the contract's schemas, which may come from any zod 4 copy, then erases the tool for a collector's `tools`. */
export function defineCollectorTool<I extends GenieToolSchema, O extends GenieToolSchema>(
  tool: CollectorTool<I, O>,
): ErasedCollectorTool {
  const { contract, handler } = tool
  if (hasZodSchemas(contract)) return { contract, handler }
  throw notZodSchemaError(
    'defineCollectorTool',
    contract.name,
    isZodSchema(contract.input) ? 'output' : 'input',
  )
}

function hasZodSchemas(
  contract: AgentToolContract<GenieToolSchema, GenieToolSchema>,
): contract is AgentToolContract {
  return isZodSchema(contract.input) && isZodSchema(contract.output)
}
