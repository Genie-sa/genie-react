import { execFile } from 'node:child_process'
import { GENIE_TAB_IDENTITY_GLOBAL } from 'genie-react/protocol'
import { isAgentBrowserSessionName } from './agent-browser-session'
import { isRecord } from './guards'

export { AGENT_BROWSER_SESSION_ENV, isAgentBrowserSessionName } from './agent-browser-session'

/** The agent-browser executable, when it is not `agent-browser` on PATH. */
export const AGENT_BROWSER_COMMAND_ENV = 'GENIE_AGENT_BROWSER'

/** A busy or hung agent-browser daemon must not stall a Genie command. */
export const AGENT_BROWSER_TIMEOUT_MS = 2_000

export type AgentBrowserReply =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; cause: 'missing' | 'timeout' | 'failed'; error?: string }

/** Runs one agent-browser command with `--json` and returns its `data`. */
export type AgentBrowserCommand = (args: readonly string[]) => Promise<AgentBrowserReply>

/** What the active tab of one agent-browser session shows. */
export interface AgentBrowserPage {
  origin: string | null
  /** The Genie tab identity the page's runtime published; null when the page does not run Genie. */
  logicalSessionId: string | null
  loading: boolean
}

export interface DomBox {
  x: number
  y: number
  width: number
  height: number
}

/** Reads the document's Genie identity without touching app state; a page without Genie answers null. */
const PAGE_PROBE = `(() => {
  const identity = globalThis[Symbol.for(${JSON.stringify(GENIE_TAB_IDENTITY_GLOBAL)})]
  return {
    origin: location.origin,
    logicalSessionId: typeof identity?.logicalSessionId === 'string' ? identity.logicalSessionId : null,
    loading: document.readyState !== 'complete',
  }
})()`
const PAGE_PROBE_BASE64 = Buffer.from(PAGE_PROBE).toString('base64')

/** Every argument is an identifier, a ref or base64, so the Windows shell that `.cmd` shims need has nothing to interpret. */
export const runAgentBrowser: AgentBrowserCommand = (args) =>
  new Promise((resolve) => {
    execFile(
      process.env[AGENT_BROWSER_COMMAND_ENV] || 'agent-browser',
      ['--json', ...args],
      {
        timeout: AGENT_BROWSER_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
        shell: process.platform === 'win32',
      },
      (error, stdout) => {
        if (error && 'code' in error && error.code === 'ENOENT') {
          resolve({ ok: false, cause: 'missing' })
        } else if (error?.killed) {
          resolve({ ok: false, cause: 'timeout' })
        } else {
          resolve(parseReply(stdout))
        }
      },
    )
  })

export function parseReply(stdout: string): AgentBrowserReply {
  let reply: unknown
  try {
    reply = JSON.parse(stdout)
  } catch {
    return { ok: false, cause: 'failed' }
  }
  if (!isRecord(reply)) return { ok: false, cause: 'failed' }
  if (reply.success === true && isRecord(reply.data)) return { ok: true, data: reply.data }
  return {
    ok: false,
    cause: 'failed',
    ...(typeof reply.error === 'string' ? { error: reply.error } : {}),
  }
}

/** What tab targeting and ref lookups read from agent-browser; the command path holds a lazy one so it loads the client only when it asks. */
export type AgentBrowserClient = Pick<AgentBrowser, 'sessions' | 'origin' | 'page' | 'html' | 'box'>

/** The documented agent-browser CLI commands Genie reads: `session list`, `get url`, `eval` and `get box`. None changes the page. */
export class AgentBrowser {
  constructor(private readonly run: AgentBrowserCommand = runAgentBrowser) {}

  /** Running sessions in this shell's namespace; null when agent-browser is not installed or did not answer. */
  async sessions(): Promise<string[] | null> {
    const reply = await this.run(['session', 'list'])
    if (!reply.ok || !Array.isArray(reply.data.sessions)) return null
    return reply.data.sessions.filter(
      (name): name is string => typeof name === 'string' && isAgentBrowserSessionName(name),
    )
  }

  /** The origin of the session's active tab, read without running page script. */
  async origin(session: string): Promise<string | null> {
    const reply = await this.run(['--session', session, 'get', 'url'])
    return reply.ok && typeof reply.data.url === 'string' ? originOf(reply.data.url) : null
  }

  /** Null when the session did not answer. Only call it for a running session: agent-browser launches a browser for any other. */
  async page(session: string): Promise<AgentBrowserPage | null> {
    const reply = await this.run(['--session', session, 'eval', '-b', PAGE_PROBE_BASE64])
    const page = reply.ok ? reply.data.result : null
    if (!isRecord(page)) return null
    return {
      origin: typeof page.origin === 'string' ? page.origin : null,
      logicalSessionId:
        typeof page.logicalSessionId === 'string' && page.logicalSessionId !== ''
          ? page.logicalSessionId
          : null,
      loading: page.loading === true,
    }
  }

  /** The innerHTML agent-browser reports for a snapshot ref; null when it reported none. */
  async html(session: string, ref: string): Promise<string | null> {
    const reply = await this.run(['--session', session, 'get', 'html', ref])
    return reply.ok && typeof reply.data.html === 'string' ? reply.data.html : null
  }

  /** The border box agent-browser reports for a snapshot ref, or its error text. */
  async box(session: string, ref: string): Promise<DomBox | { error: string }> {
    const reply = await this.run(['--session', session, 'get', 'box', ref])
    if (!reply.ok) return { error: reply.error ?? reply.cause }
    const { x, y, width, height } = reply.data
    return isFiniteNumber(x) && isFiniteNumber(y) && isFiniteNumber(width) && isFiniteNumber(height)
      ? { x, y, width, height }
      : { error: 'agent-browser returned no box' }
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function originOf(url: string): string | null {
  try {
    const { origin } = new URL(url)
    return origin === 'null' ? null : origin
  } catch {
    return null
  }
}
