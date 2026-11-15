import type { BridgeStatusMessage, SessionSummary } from 'genie-react/protocol'
import type { AgentBrowser } from './agent-browser'

/** Where the target came from: `--session`, GENIE_SESSION, agent-browser, or the hub's default tab for this agent. */
export type SessionSource = 'flag' | 'environment' | 'agent-browser' | 'implicit-current'

/** What named the agent-browser session: the Genie selector, AGENT_BROWSER_SESSION, or a scan that found it the only running session showing this app. */
export type AgentBrowserVia = 'selector' | 'environment' | 'discovery'

export interface AgentBrowserLink {
  session: string
  via: AgentBrowserVia
  logicalSessionId: string
}

export interface AgentBrowserMiss {
  session: string
  via: Exclude<AgentBrowserVia, 'discovery'>
  /** `not-running`: agent-browser lists no such session. `no-genie`: its page runs no Genie. `unreachable`: it did not answer. */
  cause: 'not-running' | 'no-genie' | 'unreachable'
}

export interface TabTarget {
  /** Sent with every tab-scoped call; absent leaves the choice to the hub's default tab for this agent. */
  sessionId?: string
  /** The `--session` or GENIE_SESSION value as given. */
  requested?: string
  source: SessionSource
  agentBrowser?: AgentBrowserLink
  /** The agent-browser session that should have named the tab, and why it did not. */
  agentBrowserMiss?: AgentBrowserMiss
  /** Running agent-browser sessions that each show a tab of this hub; set only when there were several, so none was picked. */
  agentBrowserCandidates?: string[]
}

export interface TargetRequest {
  selector?: { value: string; source: 'flag' | 'environment' }
  /** AGENT_BROWSER_SESSION, already checked to be a passable session name. */
  agentBrowserSession?: string
  /** How long to keep probing a page that has not published its Genie identity: `loadingMs` while it is still loading, `loadedMs` after (non-zero only for `status --wait`). */
  settle: { loadingMs: number; loadedMs: number }
}

const PROBE_INTERVAL_MS = 250
/** Bounds the agent-browser processes one scan starts. */
const MAX_SCANNED_SESSIONS = 32

/** Picks the tab every tab-scoped call of this command targets. A selector the hub already knows always wins, so `_genie` names and session IDs behave as before. */
export async function resolveTabTarget(
  request: TargetRequest,
  status: () => Pick<BridgeStatusMessage, 'sessionId' | 'sessions'>,
  agentBrowser: AgentBrowser,
): Promise<TabTarget> {
  const { selector } = request
  if (selector) {
    const named: TabTarget = {
      sessionId: selector.value,
      requested: selector.value,
      source: selector.source,
    }
    const known = (): boolean =>
      status().sessions.some((session) => isTargetOf(session, selector.value))
    if (known()) return named
    const tab = await agentBrowserTab(
      selector.value,
      'selector',
      request.settle,
      agentBrowser,
      known,
    )
    if (tab === null || tab === 'known') return named
    return 'cause' in tab
      ? { ...named, agentBrowserMiss: tab }
      : { ...named, sessionId: tab.logicalSessionId, agentBrowser: tab }
  }
  if (request.agentBrowserSession !== undefined) {
    const tab = await agentBrowserTab(
      request.agentBrowserSession,
      'environment',
      request.settle,
      agentBrowser,
    )
    if (tab === null || tab === 'known') return { source: 'implicit-current' }
    return 'cause' in tab
      ? { source: 'implicit-current', agentBrowserMiss: tab }
      : { sessionId: tab.logicalSessionId, source: 'agent-browser', agentBrowser: tab }
  }
  if (!hasAmbiguousDefault(status())) return { source: 'implicit-current' }
  const shown = await agentBrowserSessionsShowing(
    status().sessions.filter((session) => !session.claimedByOthers),
    agentBrowser,
  )
  const [only] = shown
  if (shown.length === 1 && only) {
    return {
      sessionId: only.logicalSessionId,
      source: 'agent-browser',
      agentBrowser: { ...only, via: 'discovery' },
    }
  }
  return shown.length > 1
    ? { source: 'implicit-current', agentBrowserCandidates: shown.map((tab) => tab.session) }
    : { source: 'implicit-current' }
}

/** With several tabs and none used yet, the hub has no default tab to give an untargeted call. */
export function hasAmbiguousDefault(
  status: Pick<BridgeStatusMessage, 'sessionId' | 'sessions'>,
): boolean {
  return (
    status.sessionId === null &&
    status.sessions.length > 1 &&
    status.sessions.some((session) => session.ready)
  )
}

/** The hub's own matching: physical ID (a predecessor's included), logical ID, or session name. */
export function isTargetOf(session: SessionSummary, target: string): boolean {
  return (
    session.sessionId === target ||
    session.predecessorSessionId === target ||
    session.logicalSessionId === target ||
    session.sessionName === target
  )
}

/** Running agent-browser sessions whose active tab is one of `tabs`. */
export async function agentBrowserSessionsShowing(
  tabs: readonly SessionSummary[],
  agentBrowser: AgentBrowser,
): Promise<Array<Omit<AgentBrowserLink, 'via'>>> {
  const origins = new Set(tabs.flatMap((session) => originOf(session) ?? []))
  if (origins.size === 0) return []
  const running = (await agentBrowser.sessions()) ?? []
  const shown = await Promise.all(
    running.slice(0, MAX_SCANNED_SESSIONS).map(async (session) => {
      // A page on another origin cannot be one of these tabs, so its script never runs.
      const origin = await agentBrowser.origin(session)
      if (origin === null || !origins.has(origin)) return []
      const logicalSessionId = (await agentBrowser.page(session))?.logicalSessionId
      return logicalSessionId && tabs.some((tab) => tab.logicalSessionId === logicalSessionId)
        ? [{ session, logicalSessionId }]
        : []
    }),
  )
  return shown.flat().sort((a, b) => a.session.localeCompare(b.session))
}

/** Null when agent-browser is not installed or did not list its sessions; `known` once the hub learns the selector itself, which then wins. */
async function agentBrowserTab<Via extends Exclude<AgentBrowserVia, 'discovery'>>(
  session: string,
  via: Via,
  settle: TargetRequest['settle'],
  agentBrowser: AgentBrowser,
  known: () => boolean = () => false,
): Promise<(AgentBrowserLink & { via: Via }) | (AgentBrowserMiss & { via: Via }) | 'known' | null> {
  const running = await agentBrowser.sessions()
  if (running === null) return null
  // Any command on a session that is not running would launch a browser for it.
  if (!running.includes(session)) return { session, via, cause: 'not-running' }
  const started = Date.now()
  for (;;) {
    const page = await agentBrowser.page(session)
    if (page?.logicalSessionId) return { session, via, logicalSessionId: page.logicalSessionId }
    if (known()) return 'known'
    const patience = page === null || page.loading ? settle.loadingMs : settle.loadedMs
    if (Date.now() - started >= patience) {
      return { session, via, cause: page === null ? 'unreachable' : 'no-genie' }
    }
    await new Promise((resolve) => setTimeout(resolve, PROBE_INTERVAL_MS))
  }
}

function originOf(session: SessionSummary): string | undefined {
  if (session.origin) return session.origin
  try {
    return session.app.url ? new URL(session.app.url).origin : undefined
  } catch {
    return undefined
  }
}
