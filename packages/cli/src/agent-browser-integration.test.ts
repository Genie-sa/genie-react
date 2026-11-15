import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStandaloneBridge } from 'genie-react/hub'
import { decodeFrame, encodeMessage, GENIE_TAB_IDENTITY_GLOBAL } from 'genie-react/protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocket } from 'ws'
import { runCall, runStatus } from './agent'
import type { FakePage } from './agent-browser.test-support'

const AGENT_TOKEN = 'agent-browser-integration-token'
const APP_URL = 'http://127.0.0.1:5173/'

/** An agent-browser executable that answers `--json` commands from a world file, running the CLI's page probe like a browser would. */
const FAKE_AGENT_BROWSER = `#!/usr/bin/env node
const { readFileSync } = require('node:fs')
const { runInNewContext } = require('node:vm')
const world = JSON.parse(readFileSync(process.env.FAKE_AGENT_BROWSER_WORLD, 'utf8'))
const args = process.argv.slice(3)
const reply = (data) => process.stdout.write(JSON.stringify({ success: true, data, error: null }))
const fail = (error) => {
  process.stdout.write(JSON.stringify({ success: false, data: null, error }))
  process.exitCode = 1
}
if (args[0] === 'session' && args[1] === 'list') reply({ sessions: Object.keys(world) })
else {
  const page = world[args[1]]
  if (!page) throw new Error('would launch a browser for ' + args[1])
  if (args[2] === 'get' && args[3] === 'url') reply({ url: page.url })
  else if (args[2] === 'get' && args[3] === 'html') {
    const html = (page.html || {})[args[4].slice(1)]
    html === undefined ? fail('Unknown ref: ' + args[4].slice(1)) : reply({ html })
  } else if (args[2] === 'get' && args[3] === 'box') {
    const box = (page.refs || {})[args[4].slice(1)]
    box ? reply(box) : fail('Unknown ref: ' + args[4].slice(1))
  } else if (args[2] === 'eval') {
    const context = { location: { origin: new URL(page.url).origin }, document: { readyState: 'complete' } }
    if (page.logicalSessionId) context[Symbol.for(${JSON.stringify(GENIE_TAB_IDENTITY_GLOBAL)})] = { logicalSessionId: page.logicalSessionId }
    reply({ result: JSON.parse(JSON.stringify(runInNewContext(Buffer.from(args[4], 'base64').toString(), context))) })
  } else fail('unexpected command')
}
`

describe('CLI commands beside agent-browser', () => {
  const cleanups: Array<() => void | Promise<void>> = []
  let directory: string
  let world: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'genie-agent-browser-'))
    const executable = join(directory, 'agent-browser')
    writeFileSync(executable, FAKE_AGENT_BROWSER)
    chmodSync(executable, 0o755)
    world = join(directory, 'world.json')
    vi.stubEnv('GENIE_AGENT_BROWSER', executable)
    vi.stubEnv('FAKE_AGENT_BROWSER_WORLD', world)
    vi.stubEnv('GENIE_BRIDGE_TOKEN', AGENT_TOKEN)
    vi.stubEnv('GENIE_SESSION', '')
    vi.stubEnv('AGENT_BROWSER_SESSION', '')
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    for (const cleanup of cleanups.reverse()) await cleanup()
    cleanups.length = 0
    rmSync(directory, { recursive: true, force: true })
  })

  const browsers = (sessions: Record<string, FakePage>) =>
    writeFileSync(world, JSON.stringify(sessions))

  /** A hub with one app tab per entry; each tab answers with its own ID and the arguments it received. */
  async function hubWithTabs(...tabs: Array<{ sessionId: string; logicalSessionId: string }>) {
    const bridge = createStandaloneBridge({ agentToken: AGENT_TOKEN })
    cleanups.push(() => bridge.close())
    const { url } = await bridge.listen()
    for (const tab of tabs) {
      const app = new WebSocket(`${url}?role=app`)
      cleanups.push(() => app.close())
      await new Promise<void>((resolve, reject) => {
        app.once('open', resolve)
        app.once('error', reject)
      })
      app.on('message', (data) => {
        const message = decodeFrame(data.toString()) as {
          kind?: string
          id?: string
          args?: unknown
        }
        if (message.kind !== 'bridge/request') return
        app.send(
          encodeMessage({
            kind: 'app/response',
            id: message.id,
            ok: true,
            result: { answeredBy: tab.sessionId, args: message.args },
          }),
        )
      })
      app.send(
        encodeMessage({
          kind: 'app/hello',
          protocol: 1,
          ...tab,
          documentGeneration: 1,
          app: { name: 'fixture', url: APP_URL },
          capabilities: ['react'],
          tools: [
            {
              name: 'react_component_for_dom',
              title: 'Owner',
              description: 'Owner.',
              group: 'react',
            },
          ],
        }),
      )
      app.send(encodeMessage({ kind: 'app/ready', sessionId: tab.sessionId }))
    }
    await vi.waitUntil(
      () =>
        bridge.bridge.getStatus().sessions.filter((session) => session.ready).length ===
        tabs.length,
    )
    return url
  }

  const twoTabs = () =>
    hubWithTabs(
      { sessionId: 'doc-a', logicalSessionId: 'tab-a' },
      { sessionId: 'doc-b', logicalSessionId: 'tab-b' },
    )

  function captured() {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    return {
      result: () => JSON.parse(stdout.mock.calls.flat().join('')),
      diagnostics: () =>
        stderr.mock.calls
          .flat()
          .join('')
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line)),
    }
  }

  it('targets the tab of the agent-browser session --session names, and says so in status', async () => {
    const url = await twoTabs()
    browsers({
      'agent-a': { url: APP_URL, logicalSessionId: 'tab-a' },
      'agent-b': { url: APP_URL, logicalSessionId: 'tab-b' },
    })
    const output = captured()

    expect(await runStatus({ url, session: 'agent-b', json: true })).toBe(0)
    expect(output.result()).toMatchObject({
      sessionId: 'doc-b',
      sessionSelector: {
        requested: 'agent-b',
        source: 'flag',
        resolvedSessionId: 'doc-b',
        implicit: false,
        agentBrowser: { session: 'agent-b', via: 'selector', logicalSessionId: 'tab-b' },
      },
    })
  })

  it('follows AGENT_BROWSER_SESSION when no Genie selector is given', async () => {
    const url = await twoTabs()
    browsers({
      'agent-a': { url: APP_URL, logicalSessionId: 'tab-a' },
      'agent-b': { url: APP_URL, logicalSessionId: 'tab-b' },
    })
    vi.stubEnv('AGENT_BROWSER_SESSION', 'agent-a')
    const output = captured()

    expect(
      await runCall('react_component_for_dom', '{"selector":"button"}', { url, json: true }),
    ).toBe(0)
    expect(output.result()).toMatchObject({ answeredBy: 'doc-a' })
  })

  it('turns a snapshot ref into the box from the session that took the snapshot', async () => {
    const url = await twoTabs()
    const box = { x: 8, y: 66.4375, width: 46.390625, height: 21 }
    browsers({
      'agent-a': { url: APP_URL, logicalSessionId: 'tab-a', refs: { e3: { ...box, x: 300 } } },
      'agent-b': {
        url: APP_URL,
        logicalSessionId: 'tab-b',
        refs: { e3: box },
        html: { e3: 'Save' },
      },
    })
    const output = captured()

    expect(
      await runCall('react_component_for_dom', '{"ref":"@e3","limit":1}', {
        url,
        session: 'agent-b',
        json: true,
      }),
    ).toBe(0)
    expect(output.result()).toEqual({
      answeredBy: 'doc-b',
      args: { limit: 1, box: { ...box, html: 'Save' } },
    })
  })

  it('picks the only agent-browser session showing this app and names it on stderr', async () => {
    const url = await twoTabs()
    browsers({
      'agent-b': { url: APP_URL, logicalSessionId: 'tab-b' },
      docs: { url: 'https://example.com/' },
    })
    const output = captured()

    expect(
      await runCall('react_component_for_dom', '{"selector":"button"}', { url, json: true }),
    ).toBe(0)
    expect(output.result()).toMatchObject({ answeredBy: 'doc-b' })
    expect(output.diagnostics()).toContainEqual(
      expect.objectContaining({
        reason: 'agent-browser',
        data: { session: 'agent-b', logicalSessionId: 'tab-b' },
      }),
    )
  })

  it('names every agent-browser session showing a tab when it cannot choose', async () => {
    const url = await twoTabs()
    browsers({
      'agent-a': { url: APP_URL, logicalSessionId: 'tab-a' },
      'agent-b': { url: APP_URL, logicalSessionId: 'tab-b' },
    })
    const output = captured()

    expect(
      await runCall('react_component_for_dom', '{"selector":"button"}', { url, json: true }),
    ).toBe(1)
    expect(output.result()).toMatchObject({
      reason: 'unknown_session',
      details: { hubCode: 'SESSION_AMBIGUOUS', agentBrowser: { sessions: ['agent-a', 'agent-b'] } },
    })
  })

  it('says why a named agent-browser session gave no tab and how to open the app there', async () => {
    const url = await twoTabs()
    browsers({ blank: { url: 'about:blank' } })
    const output = captured()

    expect(
      await runCall('react_component_for_dom', '{"selector":"button"}', {
        url,
        session: 'blank',
        json: true,
      }),
    ).toBe(1)
    const failure = output.result()
    expect(failure).toMatchObject({
      reason: 'unknown_session',
      details: { agentBrowser: { session: 'blank', cause: 'no-genie' } },
    })
    expect(failure.message).toContain('agent-browser --session blank open <app-url>')
  })

  it('falls back to the default tab with a warning when AGENT_BROWSER_SESSION shows no app', async () => {
    const url = await hubWithTabs({ sessionId: 'doc-a', logicalSessionId: 'tab-a' })
    browsers({ docs: { url: 'https://example.com/' } })
    vi.stubEnv('AGENT_BROWSER_SESSION', 'docs')
    const output = captured()

    expect(
      await runCall('react_component_for_dom', '{"selector":"button"}', { url, json: true }),
    ).toBe(0)
    expect(output.result()).toMatchObject({ answeredBy: 'doc-a' })
    expect(output.diagnostics()).toContainEqual(
      expect.objectContaining({
        reason: 'agent-browser',
        data: { session: 'docs', cause: 'no-genie' },
      }),
    )
  })
})
