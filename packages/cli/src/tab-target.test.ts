import type { BridgeStatusMessage } from 'genie-react/protocol'
import { describe, expect, it } from 'vitest'
import { type FakeSessions, fakeAgentBrowser, hubTab } from './agent-browser.test-support'
import { resolveTabTarget, type TargetRequest } from './tab-target'

const APP = 'http://127.0.0.1:5173/'
const CALL_SETTLE: TargetRequest['settle'] = { loadingMs: 1_000, loadedMs: 0 }

type Hub = Pick<BridgeStatusMessage, 'sessionId' | 'sessions'>

function resolve(request: Partial<TargetRequest>, hub: Hub | (() => Hub), sessions: FakeSessions) {
  const { agentBrowser, commands } = fakeAgentBrowser(sessions)
  const status = typeof hub === 'function' ? hub : () => hub
  const target = resolveTabTarget({ settle: CALL_SETTLE, ...request }, status, agentBrowser)
  return { target, commands }
}

const evaluatedSessions = (commands: string[][]) =>
  commands.filter((command) => command.includes('eval')).map((command) => command[1])

describe('resolveTabTarget with a selector', () => {
  it('keeps a session name the hub knows, even when an agent-browser session of that name shows another tab', async () => {
    const hub = { sessionId: null, sessions: [hubTab('doc-1', { sessionName: 'checkout' })] }
    const { target, commands } = resolve({ selector: { value: 'checkout', source: 'flag' } }, hub, {
      checkout: { url: APP, logicalSessionId: 'tab-elsewhere' },
    })
    expect(await target).toEqual({ sessionId: 'checkout', requested: 'checkout', source: 'flag' })
    expect(commands).toEqual([])
  })

  it('keeps a physical ID the hub has since replaced with a newer document', async () => {
    const hub = { sessionId: null, sessions: [hubTab('doc-2', { predecessorSessionId: 'doc-1' })] }
    const { target, commands } = resolve(
      { selector: { value: 'doc-1', source: 'environment' } },
      hub,
      {},
    )
    expect(await target).toMatchObject({ sessionId: 'doc-1', source: 'environment' })
    expect(commands).toEqual([])
  })

  it('targets the tab an agent-browser session of that name shows', async () => {
    const hub = {
      sessionId: null,
      sessions: [hubTab('doc-a', { logicalSessionId: 'tab-a' }), hubTab('doc-b')],
    }
    const { target } = resolve({ selector: { value: 'agent-a', source: 'flag' } }, hub, {
      'agent-a': { url: APP, logicalSessionId: 'tab-a' },
      'agent-b': { url: APP, logicalSessionId: 'tab-b' },
    })
    expect(await target).toEqual({
      sessionId: 'tab-a',
      requested: 'agent-a',
      source: 'flag',
      agentBrowser: { session: 'agent-a', via: 'selector', logicalSessionId: 'tab-a' },
    })
  })

  it('never runs a command on an agent-browser session that is not running, since that launches a browser', async () => {
    const { target, commands } = resolve(
      { selector: { value: 'typo', source: 'flag' } },
      { sessionId: null, sessions: [] },
      { other: { url: APP, logicalSessionId: 'tab-other' } },
    )
    expect(await target).toEqual({
      sessionId: 'typo',
      requested: 'typo',
      source: 'flag',
      agentBrowserMiss: { session: 'typo', via: 'selector', cause: 'not-running' },
    })
    expect(commands).toEqual([['session', 'list']])
  })

  it('waits for a page that is still loading to publish its identity', async () => {
    let probes = 0
    const { target } = resolve(
      { selector: { value: 'agent-a', source: 'flag' } },
      { sessionId: null, sessions: [] },
      {
        'agent-a': () =>
          ++probes < 3 ? { url: APP, loading: true } : { url: APP, logicalSessionId: 'tab-a' },
      },
    )
    expect((await target).sessionId).toBe('tab-a')
    expect(probes).toBe(3)
  })

  it('gives up at once on a loaded page without Genie unless status --wait asked to wait', async () => {
    const sessions = { blank: { url: 'about:blank' } }
    const call = resolve({ selector: { value: 'blank', source: 'flag' } }, emptyHub(), sessions)
    expect(await call.target).toMatchObject({
      sessionId: 'blank',
      agentBrowserMiss: { session: 'blank', via: 'selector', cause: 'no-genie' },
    })
    expect(evaluatedSessions(call.commands)).toEqual(['blank'])

    const waited = resolve(
      { selector: { value: 'blank', source: 'flag' }, settle: { loadingMs: 600, loadedMs: 600 } },
      emptyHub(),
      sessions,
    )
    await waited.target
    expect(evaluatedSessions(waited.commands).length).toBeGreaterThan(1)
  })

  it('lets a session name the hub learns while it waits win over the agent-browser page', async () => {
    let hub: Hub = emptyHub()
    setTimeout(() => {
      hub = { sessionId: null, sessions: [hubTab('doc-1', { sessionName: 'blank' })] }
    }, 300)
    const { target } = resolve(
      {
        selector: { value: 'blank', source: 'flag' },
        settle: { loadingMs: 5_000, loadedMs: 5_000 },
      },
      () => hub,
      { blank: { url: 'about:blank' } },
    )
    const started = Date.now()
    expect(await target).toEqual({ sessionId: 'blank', requested: 'blank', source: 'flag' })
    expect(Date.now() - started).toBeLessThan(2_000)
  })

  it('prefers a Genie selector over AGENT_BROWSER_SESSION', async () => {
    const { target } = resolve(
      { selector: { value: 'agent-a', source: 'environment' }, agentBrowserSession: 'agent-b' },
      emptyHub(),
      {
        'agent-a': { url: APP, logicalSessionId: 'tab-a' },
        'agent-b': { url: APP, logicalSessionId: 'tab-b' },
      },
    )
    expect((await target).sessionId).toBe('tab-a')
  })
})

describe('resolveTabTarget from AGENT_BROWSER_SESSION', () => {
  it('targets the tab of the session the shell names', async () => {
    const { target } = resolve({ agentBrowserSession: 'agent-b' }, emptyHub(), {
      'agent-a': { url: APP, logicalSessionId: 'tab-a' },
      'agent-b': { url: APP, logicalSessionId: 'tab-b' },
    })
    expect(await target).toEqual({
      sessionId: 'tab-b',
      source: 'agent-browser',
      agentBrowser: { session: 'agent-b', via: 'environment', logicalSessionId: 'tab-b' },
    })
  })

  it('falls back to the default tab, saying why, when that session shows no Genie page', async () => {
    const { target } = resolve({ agentBrowserSession: 'docs' }, emptyHub(), {
      docs: { url: 'https://example.com/' },
    })
    expect(await target).toEqual({
      source: 'implicit-current',
      agentBrowserMiss: { session: 'docs', via: 'environment', cause: 'no-genie' },
    })
  })
})

describe('resolveTabTarget without a selector', () => {
  const twoTabs = (claimed = false): Hub => ({
    sessionId: null,
    sessions: [
      hubTab('doc-a', { logicalSessionId: 'tab-a', ...(claimed ? { claimedByOthers: true } : {}) }),
      hubTab('doc-human', { logicalSessionId: 'tab-human' }),
    ],
  })

  it('leaves a default tab the hub already has alone, without asking agent-browser', async () => {
    const hub = { sessionId: 'doc-a', sessions: twoTabs().sessions }
    const { target, commands } = resolve({}, hub, {
      'agent-a': { url: APP, logicalSessionId: 'tab-a' },
    })
    expect(await target).toEqual({ source: 'implicit-current' })
    expect(commands).toEqual([])
  })

  it('picks the only agent-browser session showing a tab when the default is ambiguous', async () => {
    const { target } = resolve({}, twoTabs(), {
      'agent-a': { url: APP, logicalSessionId: 'tab-a' },
      docs: { url: 'https://example.com/' },
    })
    expect(await target).toEqual({
      sessionId: 'tab-a',
      source: 'agent-browser',
      agentBrowser: { session: 'agent-a', via: 'discovery', logicalSessionId: 'tab-a' },
    })
  })

  it('never picks a tab another agent claimed', async () => {
    const { target } = resolve(
      {},
      { ...twoTabs(true), sessions: [...twoTabs(true).sessions, hubTab('doc-c')] },
      {
        'agent-a': { url: APP, logicalSessionId: 'tab-a' },
      },
    )
    expect(await target).toEqual({ source: 'implicit-current' })
  })

  it('picks none and names them all when several sessions show tabs of this hub', async () => {
    const hub = {
      sessionId: null,
      sessions: [
        hubTab('doc-a', { logicalSessionId: 'tab-a' }),
        hubTab('doc-b', { logicalSessionId: 'tab-b' }),
      ],
    }
    const { target } = resolve({}, hub, {
      'agent-a': { url: APP, logicalSessionId: 'tab-a' },
      'agent-b': { url: APP, logicalSessionId: 'tab-b' },
    })
    expect(await target).toEqual({
      source: 'implicit-current',
      agentBrowserCandidates: ['agent-a', 'agent-b'],
    })
  })

  it('ignores a Genie page that belongs to another hub', async () => {
    const { target } = resolve({}, twoTabs(), {
      'agent-a': { url: APP, logicalSessionId: 'tab-of-another-hub' },
    })
    expect(await target).toEqual({ source: 'implicit-current' })
  })

  it('runs no page script in sessions showing another origin', async () => {
    const { target, commands } = resolve({}, twoTabs(), {
      'agent-a': { url: APP, logicalSessionId: 'tab-a' },
      bank: { url: 'https://bank.example/' },
    })
    await target
    expect(evaluatedSessions(commands)).toEqual(['agent-a'])
  })
})

function emptyHub(): Hub {
  return { sessionId: null, sessions: [] }
}
