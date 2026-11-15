import { describe, expect, it } from 'vitest'
import { AgentBrowser, type AgentBrowserCommand, parseReply } from './agent-browser'
import { fakeAgentBrowser } from './agent-browser.test-support'

describe('parseReply', () => {
  it('returns the data of a successful reply', () => {
    expect(parseReply('{"success":true,"data":{"url":"http://x/"},"error":null}')).toEqual({
      ok: true,
      data: { url: 'http://x/' },
    })
  })

  it('keeps the error of a failed reply and rejects output that is not a reply', () => {
    expect(parseReply('{"success":false,"data":null,"error":"Unknown ref: e9"}')).toEqual({
      ok: false,
      cause: 'failed',
      error: 'Unknown ref: e9',
    })
    expect(parseReply('✓ Done')).toEqual({ ok: false, cause: 'failed' })
    expect(parseReply('{"success":true,"data":[1]}')).toEqual({ ok: false, cause: 'failed' })
  })
})

describe('AgentBrowser', () => {
  const replying =
    (data: Record<string, unknown>): AgentBrowserCommand =>
    async () => ({ ok: true, data })

  it('drops session names that agent-browser could read as a flag', async () => {
    const agentBrowser = new AgentBrowser(
      replying({ sessions: ['agent-a', '--cdp', 'two words', '', 7, 'task-29196f246063'] }),
    )
    expect(await agentBrowser.sessions()).toEqual(['agent-a', 'task-29196f246063'])
  })

  it('reports no sessions when agent-browser is not installed', async () => {
    const agentBrowser = new AgentBrowser(async () => ({ ok: false, cause: 'missing' }))
    expect(await agentBrowser.sessions()).toBeNull()
  })

  it('reads the identity the Genie runtime publishes, through the real page probe', async () => {
    const { agentBrowser } = fakeAgentBrowser({
      'agent-a': { url: 'http://127.0.0.1:5173/cart?id=1', logicalSessionId: 'tab-a' },
    })
    expect(await agentBrowser.page('agent-a')).toEqual({
      origin: 'http://127.0.0.1:5173',
      logicalSessionId: 'tab-a',
      loading: false,
    })
  })

  it('reads no identity from a page without Genie', async () => {
    const { agentBrowser } = fakeAgentBrowser({
      docs: { url: 'https://example.com/', loading: true },
    })
    expect(await agentBrowser.page('docs')).toEqual({
      origin: 'https://example.com',
      logicalSessionId: null,
      loading: true,
    })
  })

  it('passes the probe as base64, so no argument needs shell quoting', async () => {
    const { agentBrowser, commands } = fakeAgentBrowser({ a: { url: 'http://x/' } })
    await agentBrowser.page('a')
    const [command] = commands
    expect(command?.slice(0, 4)).toEqual(['--session', 'a', 'eval', '-b'])
    expect(command?.every((argument) => /^[A-Za-z0-9+/=._-]+$/.test(argument))).toBe(true)
  })

  it('returns a box only when every coordinate is a finite number', async () => {
    expect(
      await new AgentBrowser(replying({ x: 8, y: 66.4, width: 46, height: 21, lifecycle: {} })).box(
        'a',
        '@e3',
      ),
    ).toEqual({ x: 8, y: 66.4, width: 46, height: 21 })
    expect(
      await new AgentBrowser(replying({ x: 8, y: null, width: 46, height: 21 })).box('a', '@e3'),
    ).toEqual({ error: 'agent-browser returned no box' })
  })
})
