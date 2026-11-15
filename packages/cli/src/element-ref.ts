import {
  AGENT_BROWSER_REF,
  BOX_HTML_MAX_LENGTH,
  type BridgeStatusMessage,
  type SessionSummary,
} from 'genie-react/protocol'
import type { AgentBrowser } from './agent-browser'
import { CliFailure, nextCommand } from './failure'
import { isRecord } from './guards'
import { agentBrowserSessionsShowing, isTargetOf, type TabTarget } from './tab-target'

/** Tools that take an agent-browser `ref` in place of the `box` their app matches. */
const REF_TOOLS = new Set(['react_component_for_dom'])

type HubView = Pick<BridgeStatusMessage, 'sessionId' | 'sessions'>

/** Replaces an agent-browser snapshot `ref` with the box agent-browser reports for it, read from the session that shows the targeted tab. Any other input passes through for the app to validate. */
export async function withElementBox(
  tool: string,
  args: unknown,
  routing: () => Promise<{ target: TabTarget; status: HubView }>,
  agentBrowser: AgentBrowser,
): Promise<unknown> {
  if (
    !REF_TOOLS.has(tool) ||
    !isRecord(args) ||
    typeof args.ref !== 'string' ||
    !AGENT_BROWSER_REF.test(args.ref) ||
    'box' in args
  ) {
    return args
  }
  const { ref: rawRef, ...rest } = args
  const ref = rawRef.startsWith('@') ? rawRef : `@${rawRef}`
  const { target, status } = await routing()
  const session =
    target.agentBrowser?.session ?? (await sessionShowing(ref, target, status, agentBrowser))
  const box = await agentBrowser.box(session, ref)
  if ('error' in box) {
    const stale = box.error.startsWith('Unknown ref')
    throw new CliFailure({
      reason: 'invalid_input',
      message: stale
        ? `agent-browser session ${session} has no ref ${ref}. Refs come from that session's latest snapshot; take one with agent-browser --session ${session} snapshot -i and pass a ref from it.`
        : `agent-browser session ${session} reported no box for ${ref}. Pass a CSS selector instead.`,
      userActionRequired: true,
      details: { agentBrowser: { session, ref } },
    })
  }
  const html = await agentBrowser.html(session, ref)
  return {
    ...rest,
    box: html !== null && html.length <= BOX_HTML_MAX_LENGTH ? { ...box, html } : box,
  }
}

async function sessionShowing(
  ref: string,
  target: TabTarget,
  status: HubView,
  agentBrowser: AgentBrowser,
): Promise<string> {
  const tab = targetedTab(target, status)
  if (!tab) {
    throw new CliFailure({
      reason: 'unknown_session',
      message: `No app tab is targeted, so ${ref} cannot be matched to an agent-browser session. Pass --session with the agent-browser session that took the snapshot.`,
      userActionRequired: true,
      next: nextCommand('status', '--sessions-only'),
    })
  }
  const shown = await agentBrowserSessionsShowing([tab], agentBrowser)
  const [only] = shown
  if (shown.length === 1 && only) return only.session
  throw new CliFailure({
    reason: 'unknown_session',
    message:
      shown.length === 0
        ? `No running agent-browser session shows the targeted tab, so ${ref} cannot be resolved. Pass --session with the agent-browser session that took the snapshot, or pass {"selector": …} instead of a ref.`
        : `${shown.length} agent-browser sessions show the targeted tab, so ${ref} is ambiguous. Pass --session with the one that took the snapshot.`,
    userActionRequired: true,
    ...(shown.length > 1
      ? { details: { agentBrowser: { sessions: shown.map((entry) => entry.session) } } }
      : {}),
  })
}

function targetedTab(target: TabTarget, status: HubView): SessionSummary | undefined {
  const selected = target.sessionId ?? status.sessionId
  if (selected === null) return undefined
  const matches = status.sessions.filter((session) => isTargetOf(session, selected))
  return matches.length === 1 ? matches[0] : undefined
}
