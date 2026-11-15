import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { WebSocket } from 'ws'
import { GENIE_REACT_VERSION, newId } from '../protocol'
import { connect, createTestBridge, type Frame, isResult, open, send } from './bridge-test-harness'
import type { StandaloneBridgeHandle } from './standalone'

const appTool = (name: string) => ({ name, title: name, description: name, group: 'app' })

function hello(app: WebSocket, tools: string[]): void {
  send(app, {
    kind: 'app/hello',
    protocol: 1,
    runtimeVersion: GENIE_REACT_VERSION,
    sessionId: 'tab-1',
    app: { name: 'demo' },
    capabilities: ['app'],
    tools: tools.map(appTool),
  })
}

const toolNames = (status: Frame): string[] => status.tools.map((tool: Frame) => tool.name)
const withoutTools = ({ tools: _, ...rest }: Frame) => rest

describe('status frames for agents that opt out of the tool catalog', () => {
  let handle: StandaloneBridgeHandle
  let url: string

  beforeEach(async () => {
    handle = createTestBridge()
    url = (await handle.listen()).url
  })

  afterEach(async () => {
    await handle.close()
  })

  it('greets with every status field but an empty catalog', async () => {
    const app = await connect(`${url}?role=app`)
    hello(app, ['app_echo'])
    send(app, { kind: 'app/ready', sessionId: 'tab-1' })
    const first = await open(`${url}?role=agent`)
    await first.inbox.wait((m) => m.kind === 'bridge/status' && m.ready === true)

    const full = await open(`${url}?role=agent`)
    const lean = await open(`${url}?role=agent&tools=none`)
    const fullGreeting = await full.inbox.wait((m) => m.kind === 'bridge/status')
    const leanGreeting = await lean.inbox.wait((m) => m.kind === 'bridge/status')

    expect(toolNames(fullGreeting)).toContain('app_echo')
    expect(toolNames(fullGreeting)).toContain('devtools_status')
    expect(leanGreeting.tools).toEqual([])
    expect(withoutTools(leanGreeting)).toEqual(withoutTools(fullGreeting))
    expect(leanGreeting).toMatchObject({ connected: true, ready: true, sessionId: 'tab-1' })
  })

  it('keeps each agent on its own variant when a status change is broadcast', async () => {
    const lean = await open(`${url}?role=agent&tools=none`)
    const full = await open(`${url}?role=agent`)
    const otherLean = await open(`${url}?role=agent&tools=none`)
    for (const agent of [lean, full, otherLean]) {
      await agent.inbox.wait((m) => m.kind === 'bridge/status')
    }

    const app = await connect(`${url}?role=app`)
    hello(app, ['app_echo', 'app_login'])
    const connected = (m: Frame) => m.kind === 'bridge/status' && m.connected === true

    const fullUpdate = await full.inbox.wait(connected)
    expect(toolNames(fullUpdate)).toEqual(expect.arrayContaining(['app_echo', 'app_login']))
    for (const agent of [lean, otherLean]) {
      const update = await agent.inbox.wait(connected)
      expect(update.tools).toEqual([])
      expect(withoutTools(update)).toEqual(withoutTools(fullUpdate))
    }
  })

  it('still answers devtools_status with the catalog when asked for it', async () => {
    const app = await connect(`${url}?role=app`)
    hello(app, ['app_echo'])
    const lean = await open(`${url}?role=agent&tools=none`)
    await lean.inbox.wait((m) => m.kind === 'bridge/status' && m.connected === true)

    const id = newId()
    send(lean.ws, {
      kind: 'agent/invoke',
      id,
      tool: 'devtools_status',
      args: { includeTools: true },
    })
    const answer = await lean.inbox.wait(isResult(id))

    expect(answer.ok).toBe(true)
    expect(toolNames(answer.result)).toContain('app_echo')
  })

  it.each(['tools=all', 'tools=', 'tools=NONE'])('sends the full catalog for %s', async (query) => {
    const app = await connect(`${url}?role=app`)
    hello(app, ['app_echo'])
    const agent = await open(`${url}?role=agent&${query}`)
    const greeting = await agent.inbox.wait((m) => m.kind === 'bridge/status' && m.connected)

    expect(toolNames(greeting)).toContain('app_echo')
  })
})
