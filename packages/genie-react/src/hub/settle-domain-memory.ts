import type { WaitDomain } from '../protocol'

/** The app tool each instrumented settle domain reads; `network` has none. */
const SETTLE_DOMAIN_TOOLS = {
  react: 'react_get_renders',
  query: 'query_is_fetching',
  router: 'router_get_state',
  frames: 'browser_fps',
} as const satisfies Partial<Record<WaitDomain, string>>

/** The settle domains any document of a tab has advertised: a reloaded document says hello before its app collectors register again, so a settle right after a reload waits for Query or Router instead of treating them as absent. */
export class SettleDomainMemory {
  private readonly tabs = new Map<string, Set<WaitDomain>>()

  constructor(private readonly maxTabs: number) {}

  note(tabKey: string, tools: Iterable<{ name: string }>): void {
    const names = new Set([...tools].map((tool) => tool.name))
    const advertised = this.tabs.get(tabKey) ?? new Set<WaitDomain>()
    for (const [domain, tool] of Object.entries(SETTLE_DOMAIN_TOOLS)) {
      if (names.has(tool)) advertised.add(domain as WaitDomain)
    }
    this.tabs.delete(tabKey)
    if (advertised.size === 0) return
    this.tabs.set(tabKey, advertised)
    for (const oldest of this.tabs.keys()) {
      if (this.tabs.size <= this.maxTabs) break
      this.tabs.delete(oldest)
    }
  }

  advertisedBefore(tabKey: string, domain: WaitDomain): boolean {
    return this.tabs.get(tabKey)?.has(domain) === true
  }

  clear(): void {
    this.tabs.clear()
  }
}
