import type { CollectorContext } from '../client'
import { reactCollector } from '../collectors/react/collector'
import { forgetCommittedRoots } from '../collectors/react/fiber'

const context: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}

export interface ReactCollectorHarness {
  /** Calls a React collector tool the way the bridge does: input parsed by the tool's own contract. */
  call: <T>(name: string, input: unknown) => Promise<T>
  start: () => void
  stop: () => void
}

export function reactCollectorHarness(): ReactCollectorHarness {
  const collector = reactCollector()
  let dispose: (() => void) | undefined
  return {
    async call<T>(name: string, input: unknown): Promise<T> {
      const tool = collector.tools?.find((candidate) => candidate.contract.name === name)
      if (!tool) throw new Error(`Missing tool ${name}`)
      return (await tool.handler(tool.contract.input.parse(input) as never, context)) as T
    },
    start() {
      dispose = collector.start?.(context) || undefined
    },
    stop() {
      dispose?.()
      forgetCommittedRoots()
    },
  }
}
