import type { BridgeStatusMessage } from 'genie-react/protocol'
import { describe, expect, it } from 'vitest'
import { type FakeSessions, fakeAgentBrowser, hubTab } from './agent-browser.test-support'
import { withElementBox } from './element-ref'
import { CliFailure } from './failure'
import type { TabTarget } from './tab-target'

const APP = 'http://127.0.0.1:5173/'
const SAVE = { x: 8, y: 66.4375, width: 46.390625, height: 21 }
const TOOL = 'react_component_for_dom'

type Hub = Pick<BridgeStatusMessage, 'sessionId' | 'sessions'>

const twoTabs: Hub = {
  sessionId: 'doc-a',
  sessions: [
    hubTab('doc-a', { logicalSessionId: 'tab-a', sessionName: 'checkout' }),
    hubTab('doc-b', { logicalSessionId: 'tab-b' }),
  ],
}

function convert(
  args: unknown,
  sessions: FakeSessions,
  target: TabTarget = { source: 'implicit-current' },
  hub: Hub = twoTabs,
  tool = TOOL,
) {
  const { agentBrowser, commands } = fakeAgentBrowser(sessions)
  let routed = 0
  const result = withElementBox(
    tool,
    args,
    async () => {
      routed += 1
      return { target, status: hub }
    },
    agentBrowser,
  )
  return { result, commands, routed: () => routed }
}

async function failureOf(promise: Promise<unknown>) {
  const error = await promise.catch((caught: unknown) => caught)
  if (!(error instanceof CliFailure)) throw new Error(`expected a CliFailure, got ${String(error)}`)
  return error.failure
}

describe('withElementBox', () => {
  it('passes other tools, other inputs and an explicit box through untouched, without routing', async () => {
    for (const [tool, args] of [
      ['stylex_inspect', { ref: '@e3' }],
      [TOOL, { selector: 'button' }],
      [TOOL, { ref: '@e3', box: SAVE }],
      [TOOL, { ref: '#save' }],
      [TOOL, null],
    ] as const) {
      const { result, routed } = convert(args, {}, undefined, undefined, tool)
      expect(await result).toBe(args)
      expect(routed()).toBe(0)
    }
  })

  it('reads the box from the session showing the default tab and keeps the other inputs', async () => {
    const { result, commands } = convert(
      { ref: 'e3', limit: 2 },
      {
        'agent-b': { url: APP, logicalSessionId: 'tab-b', refs: { e3: { ...SAVE, x: 400 } } },
        'agent-a': { url: APP, logicalSessionId: 'tab-a', refs: { e3: SAVE } },
      },
    )
    expect(await result).toEqual({ limit: 2, box: SAVE })
    expect(commands).toContainEqual(['--session', 'agent-a', 'get', 'box', '@e3'])
  })

  it('sends the innerHTML agent-browser reports, unless it is too long to compare', async () => {
    const short = convert(
      { ref: '@e3' },
      {
        'agent-a': {
          url: APP,
          logicalSessionId: 'tab-a',
          refs: { e3: SAVE },
          html: { e3: 'Save' },
        },
      },
    )
    expect(await short.result).toEqual({ box: { ...SAVE, html: 'Save' } })

    const long = convert(
      { ref: '@e3' },
      {
        'agent-a': {
          url: APP,
          logicalSessionId: 'tab-a',
          refs: { e3: SAVE },
          html: { e3: '<li>row</li>'.repeat(1_000) },
        },
      },
    )
    expect(await long.result).toEqual({ box: SAVE })
  })

  it('finds the session of a tab targeted by its Genie name', async () => {
    const { result } = convert(
      { ref: '@e3' },
      {
        'agent-a': { url: APP, logicalSessionId: 'tab-a', refs: { e3: SAVE } },
        'agent-b': { url: APP, logicalSessionId: 'tab-b', refs: { e3: { ...SAVE, x: 400 } } },
      },
      { sessionId: 'checkout', requested: 'checkout', source: 'flag' },
      { ...twoTabs, sessionId: null },
    )
    expect(await result).toEqual({ box: SAVE })
  })

  it('reads a linked session directly, without scanning the others', async () => {
    const { result, commands } = convert(
      { ref: '@e3' },
      { 'agent-b': { url: APP, logicalSessionId: 'tab-b', refs: { e3: SAVE } } },
      {
        sessionId: 'tab-b',
        source: 'agent-browser',
        agentBrowser: { session: 'agent-b', via: 'environment', logicalSessionId: 'tab-b' },
      },
    )
    expect(await result).toEqual({ box: SAVE })
    expect(commands).toEqual([
      ['--session', 'agent-b', 'get', 'box', '@e3'],
      ['--session', 'agent-b', 'get', 'html', '@e3'],
    ])
  })

  it('says to take a new snapshot when the ref is not in the session', async () => {
    const { result } = convert(
      { ref: '@e9' },
      { 'agent-a': { url: APP, logicalSessionId: 'tab-a', refs: { e3: SAVE } } },
    )
    const failure = await failureOf(result)
    expect(failure).toMatchObject({
      reason: 'invalid_input',
      details: { agentBrowser: { session: 'agent-a', ref: '@e9' } },
    })
    expect(failure.message).toContain('agent-browser --session agent-a snapshot -i')
  })

  it('refuses to guess when no session shows the targeted tab', async () => {
    const { result } = convert(
      { ref: '@e3' },
      { 'agent-b': { url: APP, logicalSessionId: 'tab-b', refs: { e3: SAVE } } },
    )
    const failure = await failureOf(result)
    expect(failure.reason).toBe('unknown_session')
    expect(failure.message).toContain('No running agent-browser session shows the targeted tab')
  })

  it('refuses to guess when no tab is targeted', async () => {
    const { result } = convert(
      { ref: '@e3' },
      { 'agent-a': { url: APP, logicalSessionId: 'tab-a', refs: { e3: SAVE } } },
      { source: 'implicit-current' },
      { ...twoTabs, sessionId: null },
    )
    expect((await failureOf(result)).reason).toBe('unknown_session')
  })
})
