// @vitest-environment jsdom
import '../collectors/react/hook'
import { QueryClient } from '@tanstack/react-query'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { GenieClient, type GenieCollector, type SocketLike } from '../client'
import { reactCollector } from '../collectors/react'
import { queryCollector } from '../collectors/tanstack/query'
import { newId } from '../protocol'
import {
  createTestBridge,
  type Frame,
  type Inbox,
  isResult,
  open,
  send,
} from './bridge-test-harness'
import type { StandaloneBridgeHandle } from './standalone'

const TAB = 'reloaded-tab'

function Dashboard() {
  return createElement('main', null, 'dashboard')
}

let handle: StandaloneBridgeHandle
let url: string
let root: Root
let container: HTMLDivElement
let agent: { ws: WebSocket; inbox: Inbox }
const documents: GenieClient[] = []

beforeEach(async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  handle = createTestBridge({ clientBundlePath: 'unused-in-these-tests.js' })
  url = (await handle.listen()).url
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  root.render(createElement(Dashboard))
  await expect.poll(() => container.textContent).toBe('dashboard')
  agent = await open(`${url}?role=agent`)
})

afterEach(async () => {
  for (const client of documents.splice(0)) client.stop()
  root.unmount()
  container.remove()
  agent.ws.close()
  await handle.close()
})

async function invoke(tool: string, args: unknown): Promise<Frame> {
  const id = newId()
  send(agent.ws, { kind: 'agent/invoke', id, tool, args })
  return agent.inbox.wait(isResult(id), 20_000)
}

/** One page load of the tab: a new document of the same logical session, as sessionStorage gives a reloaded page. */
function load(documentGeneration: number, collectors: GenieCollector[]): GenieClient {
  const client = new GenieClient({
    url,
    collectors,
    sessionIdentity: { logicalSessionId: TAB, documentGeneration },
    socketFactory: (target) => new WebSocket(target) as unknown as SocketLike,
  })
  documents.push(client)
  client.start()
  return client
}

/** The dashboard's shape: the first load advertises Query, then a reload says hello with React tools before `<Genie>` registers the Query collector again. */
async function reloadBeforeQueryRegisters(): Promise<GenieClient> {
  const first = load(1, [reactCollector(), queryCollector(new QueryClient())])
  expect((await invoke('devtools_wait', { condition: 'ready', timeoutMs: 5_000 })).ok).toBe(true)
  first.stop()
  const connected = async () => (await invoke('devtools_status', {})).result.connected
  await expect.poll(connected).toBe(false)
  const reloaded = load(2, [reactCollector()])
  await expect.poll(connected).toBe(true)
  return reloaded
}

describe('settling right after a reload', () => {
  it('waits on the Query domain the tab advertised before the reload and says it was not observed', async () => {
    await reloadBeforeQueryRegisters()

    const response = await invoke('devtools_wait', {
      condition: 'settled',
      domains: ['react', 'query'],
      quietMs: 100,
      timeoutMs: 1_000,
    })

    expect(response.result).toMatchObject({
      ok: false,
      reason: 'timeout',
      domains: { react: { status: 'met' }, query: { status: 'pending', lastObserved: null } },
    })
    expect(response.result.domains.query.reason).toContain('not observed')
  })

  it('settles the Query domain once the reloaded document registers it and its fetch finishes', async () => {
    const reloaded = await reloadBeforeQueryRegisters()
    let release!: () => void
    const response = new Promise<string>((resolve) => {
      release = () => resolve('orders')
    })
    const queryClient = new QueryClient()
    void queryClient.fetchQuery({ queryKey: ['orders'], queryFn: () => response })
    let released = false
    const settled = invoke('devtools_wait', {
      condition: 'settled',
      domains: ['react', 'query'],
      quietMs: 100,
      timeoutMs: 10_000,
    }).then((result) => ({ result, releasedFirst: released }))

    reloaded.registerCollector(queryCollector(queryClient))
    await expect
      .poll(async () => (await invoke('query_is_fetching', {})).result, { timeout: 5_000 })
      .toMatchObject({ fetching: 1 })
    released = true
    release()

    const { result, releasedFirst } = await settled
    expect(releasedFirst).toBe(true)
    expect(result.result).toMatchObject({
      ok: true,
      domains: { query: { status: 'met', lastObserved: { fetching: 0 } } },
    })
  })

  it('verify waits on the Query domain from before the reload instead of dropping it', async () => {
    await reloadBeforeQueryRegisters()
    const began = await invoke('devtools_verify_begin', {
      name: 'after reload',
      claims: [{ kind: 'renders', target: { component: 'Dashboard' }, max: 0 }],
      settle: { quietMs: 100, timeoutMs: 1_000 },
    })
    expect(began.ok).toBe(true)

    const ended = await invoke('devtools_verify_end', {
      verificationId: began.result.verificationId,
    })

    expect(ended.result.window.settle).toMatchObject({
      outcome: 'timed-out',
      domains: { query: 'pending' },
    })
  })
})
