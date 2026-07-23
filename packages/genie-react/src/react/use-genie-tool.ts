import { useEffect, useRef } from 'react'
import type { z } from 'zod'
import {
  type DefaultToolInput,
  type DefaultToolOutput,
  defineGenieTool,
  type GenieAppTool,
  type GenieToolDefinition,
  registerGenieTools,
} from '../app-tools'

export type UseGenieToolOptions<
  I extends z.ZodType = DefaultToolInput,
  O extends z.ZodType = DefaultToolOutput,
> = GenieToolDefinition<I, O> & {
  /** Gate registration (e.g. behind a feature flag); the tool tombstones while disabled. */
  enabled?: boolean
}

/** Exposes one custom tool to the genie agent while the component is mounted (afterwards it stays listed as unavailable with a recovery hint); the handler always sees the latest render's closure — no dependency array, no stale state. */
export function useGenieTool<
  I extends z.ZodType = DefaultToolInput,
  O extends z.ZodType = DefaultToolOutput,
>(options: UseGenieToolOptions<I, O>): void {
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })

  const enabled = options.enabled ?? true
  const name = options.name
  useEffect(() => {
    if (!enabled) return
    const snapshot = latest.current
    const tool = defineGenieTool<I, O>({
      ...snapshot,
      name,
      handler: (args) => latest.current.handler(args),
    })
    return registerGenieTools(tool)
  }, [name, enabled])
}

const NO_TOOLS: readonly GenieAppTool[] = []

/** Registers tools built with `defineGenieTool` (typically shared, module-level definitions) for the component's lifetime. */
export function useGenieTools(tools: readonly GenieAppTool[] = NO_TOOLS): void {
  const latest = useRef(tools)
  useEffect(() => {
    latest.current = tools
  })

  const names = tools.map((tool) => tool.contract.name).join(' ')
  useEffect(() => {
    if (names.length === 0) return
    return registerGenieTools(...latest.current)
  }, [names])
}
