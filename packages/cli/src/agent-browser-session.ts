import type { AgentBrowserClient } from './agent-browser'

/** agent-browser's own default-session variable: an agent that exports it shares it with every Genie command in that shell. */
export const AGENT_BROWSER_SESSION_ENV = 'AGENT_BROWSER_SESSION'

/** Names this CLI hands to agent-browser; anything else could read as one of its flags. */
const SESSION_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

export function isAgentBrowserSessionName(value: string | undefined): value is string {
  return value !== undefined && SESSION_NAME.test(value)
}

/** An agent-browser client that loads the client module on first use, so a command that never asks agent-browser never loads it. */
export function lazyAgentBrowser(): AgentBrowserClient {
  let client: Promise<AgentBrowserClient> | undefined
  const load = () =>
    (client ??= import('./agent-browser').then(({ AgentBrowser }) => new AgentBrowser()))
  return {
    sessions: async () => (await load()).sessions(),
    origin: async (session) => (await load()).origin(session),
    page: async (session) => (await load()).page(session),
    html: async (session, ref) => (await load()).html(session, ref),
    box: async (session, ref) => (await load()).box(session, ref),
  }
}
