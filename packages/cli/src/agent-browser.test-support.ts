import { runInNewContext } from 'node:vm'
import { GENIE_TAB_IDENTITY_GLOBAL, type SessionSummary } from 'genie-react/protocol'
import { AgentBrowser, type AgentBrowserCommand, type DomBox } from './agent-browser'

export interface FakePage {
  url: string
  /** The identity a Genie runtime in the page published; absent for a page without Genie. */
  logicalSessionId?: string
  loading?: boolean
  refs?: Record<string, DomBox>
  /** innerHTML by ref, as `get html` reports it. */
  html?: Record<string, string>
}

/** Running agent-browser sessions by name; a function is read again on every command, for pages that change while the CLI probes. */
export type FakeSessions = Record<string, FakePage | (() => FakePage)>

/** An agent-browser that answers like the real CLI's `--json` mode, and runs the CLI's real page probe against each fake page. */
export function fakeAgentBrowser(sessions: FakeSessions): {
  agentBrowser: AgentBrowser
  commands: string[][]
} {
  const commands: string[][] = []
  const pageOf = (name: string): FakePage | undefined => {
    const page = sessions[name]
    return typeof page === 'function' ? page() : page
  }
  const run: AgentBrowserCommand = async (args) => {
    commands.push([...args])
    if (args[0] === 'session' && args[1] === 'list') {
      return { ok: true, data: { sessions: Object.keys(sessions) } }
    }
    const [flag, name = '', command, ...rest] = args
    const page = flag === '--session' ? pageOf(name) : undefined
    if (!page) throw new Error(`agent-browser would launch a browser for session ${name}`)
    if (command === 'get' && rest[0] === 'url') return { ok: true, data: { url: page.url } }
    if (command === 'get' && rest[0] === 'html') {
      const html = page.html?.[rest[1]?.replace(/^@/, '') ?? '']
      return html === undefined
        ? { ok: false, cause: 'failed', error: `Unknown ref: ${rest[1]?.replace(/^@/, '')}` }
        : { ok: true, data: { html } }
    }
    if (command === 'get' && rest[0] === 'box') {
      const box = page.refs?.[rest[1]?.replace(/^@/, '') ?? '']
      return box
        ? { ok: true, data: { ...box } }
        : { ok: false, cause: 'failed', error: `Unknown ref: ${rest[1]?.replace(/^@/, '')}` }
    }
    if (command === 'eval' && rest[0] === '-b' && rest[1]) {
      return { ok: true, data: { result: evaluateIn(page, rest[1]) } }
    }
    throw new Error(`unexpected agent-browser command: ${args.join(' ')}`)
  }
  return { agentBrowser: new AgentBrowser(run), commands }
}

function evaluateIn(page: FakePage, base64: string): unknown {
  const script = Buffer.from(base64, 'base64').toString('utf8')
  const context: Record<PropertyKey, unknown> = {
    location: { origin: new URL(page.url).origin },
    document: { readyState: page.loading ? 'loading' : 'complete' },
  }
  if (page.logicalSessionId !== undefined) {
    context[Symbol.for(GENIE_TAB_IDENTITY_GLOBAL)] = {
      logicalSessionId: page.logicalSessionId,
      documentGeneration: 1,
    }
  }
  return structuredClone(runInNewContext(script, context))
}

/** A connected, ready tab of the hub as `devtools_status` lists it. */
export function hubTab(
  sessionId: string,
  fields: Partial<SessionSummary> & { origin?: string } = {},
): SessionSummary {
  return {
    sessionId,
    logicalSessionCollision: false,
    collisionWithSessionIds: [],
    app: {},
    domains: ['react'],
    toolCount: 1,
    connectedAt: 1,
    ready: true,
    current: false,
    origin: 'http://127.0.0.1:5173',
    ...fields,
  }
}
