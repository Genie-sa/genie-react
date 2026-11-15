import { z } from 'zod'
import type { CollectorContext, GenieCollector } from '../client'
import type { InteractionSettleResult } from '../hub/interaction-manager'
import { VerificationManager } from '../hub/verification-manager'
import type { ToolDescriptor } from '../protocol'

const context: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}

export interface VerifyHarnessOptions {
  /** Runs while the hub settles; return a non-met outcome to simulate a settle timeout. */
  duringSettle?: () => Promise<InteractionSettleResult['ok'] | undefined> | undefined
  /** Runs while the hub records the tail after settle, before the freeze. */
  duringTail?: () => Promise<void> | void
}

/** A verification manager whose app requests are answered by real collectors in this document, as the client would answer them. */
export function verifyHarness(collectors: GenieCollector[], options: VerifyHarnessOptions = {}) {
  const tools = new Map(
    collectors.flatMap((collector) =>
      (collector.tools ?? []).map((tool) => [tool.contract.name, tool]),
    ),
  )
  const stops = collectors.map((collector) => collector.start?.(context))
  const descriptors: ToolDescriptor[] = [...tools.values()].map(({ contract }) => ({
    name: contract.name,
    title: contract.title,
    description: contract.description,
    group: contract.group,
    inputJsonSchema: z.toJSONSchema(contract.input, { io: 'input' }) as Record<string, unknown>,
    ...(contract.annotations ? { annotations: contract.annotations } : {}),
  }))
  let current = true
  const session = {
    sessionId: 'document-1',
    logicalSessionId: 'tab-1',
    documentGeneration: 1,
    sessionName: 'verify-test',
    app: { name: 'verify fixture', url: 'http://localhost/search' },
    tools: descriptors,
  }
  const request = async (_session: unknown, name: string, args: unknown) => {
    const tool = tools.get(name)
    if (!tool) return { ok: false, error: `${name} is not registered` }
    try {
      const input = tool.contract.input.parse(args ?? {})
      return { ok: true, result: await tool.handler(input as never, context) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
  const manager = new VerificationManager({
    resolveSession: () => (current ? session : null),
    sessionUnavailable: () => ({ errorCode: 'not-connected', error: 'The document is gone.' }),
    isCurrentSession: () => current,
    hasLogicalCollision: () => false,
    isInteractionRecording: () => false,
    request,
    settle: async () => {
      const outcome = await options.duringSettle?.()
      const probe = await request(session, 'react_get_renders', {
        sort: 'renders',
        limit: 1,
        appOnly: false,
        includeCursor: false,
      })
      const documentCommitId = (probe.result as { documentCommitId?: number } | undefined)
        ?.documentCommitId
      const met = outcome !== false
      return {
        ok: met,
        waitedMs: 0,
        ...(met ? {} : { reason: 'timeout' }),
        domains: {
          react: { status: met ? 'met' : 'pending', lastObserved: { documentCommitId } },
        },
      }
    },
    wait: async () => {
      await options.duringTail?.()
    },
  })
  return {
    manager,
    session,
    async invoke<T = Record<string, unknown>>(tool: string, args: unknown): Promise<T> {
      const response = await manager.invoke(tool, args)
      if (!response.ok) throw new Error(`${tool} failed: ${response.error}`)
      return response.result as T
    },
    raw: (tool: string, args: unknown) => manager.invoke(tool, args),
    call: request,
    reload() {
      current = false
    },
    stop() {
      manager.clear()
      for (const stop of stops) if (typeof stop === 'function') stop()
    },
  }
}
