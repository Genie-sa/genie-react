import { z } from 'zod'
import { defineAgentToolContract } from './contract'
import { appInfoSchema } from './protocol'

/**
 * Meta tools are answered by the bridge itself (not forwarded to the app), so they work even
 * before an app connects — which is exactly what `devtools_wait` needs.
 */
export const devtoolsStatusContract = defineAgentToolContract({
  name: 'devtools_status',
  title: 'DevTools status',
  description:
    'Check whether a Genie-instrumented React + TanStack app is connected, and report its session, React/TanStack versions, available data domains, and tool count.',
  group: 'meta',
  input: z.object({}),
  output: z.object({
    connected: z.boolean(),
    sessionId: z.string().nullable(),
    app: appInfoSchema.nullable(),
    domains: z.array(z.string()),
    toolCount: z.number(),
  }),
  annotations: { readOnlyHint: true },
})

export const WAIT_CONDITIONS = ['connected', 'component', 'query-settled', 'navigation'] as const
export type WaitCondition = (typeof WAIT_CONDITIONS)[number]

export const devtoolsWaitContract = defineAgentToolContract({
  name: 'devtools_wait',
  title: 'Wait for a condition',
  description:
    'Block until a runtime condition holds so the agent can synchronize instead of polling: the app connecting, a component mounting, a query settling, or a navigation completing.',
  group: 'meta',
  input: z.object({
    condition: z.enum(WAIT_CONDITIONS).default('connected'),
    name: z
      .string()
      .optional()
      .describe('Component name, query key, or route to wait for, when relevant to the condition.'),
    timeoutMs: z.number().int().positive().max(60_000).default(10_000),
  }),
  output: z.object({
    ok: z.boolean(),
    waitedMs: z.number(),
    reason: z.string().optional(),
  }),
  annotations: { readOnlyHint: true },
})

export const metaTools = [devtoolsStatusContract, devtoolsWaitContract]
