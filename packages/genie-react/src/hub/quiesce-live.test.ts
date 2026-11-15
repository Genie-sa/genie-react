// @vitest-environment jsdom
import '../collectors/react/hook'
import {
  createElement,
  type ReactNode,
  Suspense,
  startTransition,
  use,
  useEffect,
  useState,
} from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { GenieClient, type SocketLike } from '../client'
import { reactCollector } from '../collectors/react'
import { PENDING_WORK_FIBERS_PER_CALL } from '../collectors/react/pending-work'
import { newId, reactQuiesceContract } from '../protocol'
import {
  createTestBridge,
  type Frame,
  type Inbox,
  isResult,
  open,
  send,
} from './bridge-test-harness'
import type { StandaloneBridgeHandle } from './standalone'

let handle: StandaloneBridgeHandle
let url: string
let client: GenieClient
let root: Root
let container: HTMLDivElement
let agent: { ws: WebSocket; inbox: Inbox }

beforeEach(async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  handle = createTestBridge({ clientBundlePath: 'unused-in-these-tests.js' })
  url = (await handle.listen()).url
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  client = new GenieClient({
    url,
    collectors: [reactCollector()],
    socketFactory: (target) => new WebSocket(target) as unknown as SocketLike,
  })
  client.start()
  agent = await open(`${url}?role=agent`)
  await invoke('devtools_wait', { condition: 'ready', timeoutMs: 5_000 })
})

afterEach(async () => {
  root.unmount()
  container.remove()
  client.stop()
  agent.ws.close()
  await handle.close()
})

async function invoke(tool: string, args: unknown): Promise<Frame> {
  const id = newId()
  send(agent.ws, { kind: 'agent/invoke', id, tool, args })
  return agent.inbox.wait(isResult(id), 15_000)
}

async function quiesce(args: { idleMs: number; timeoutMs: number }) {
  const response = await invoke('react_quiesce', args)
  expect(response.ok).toBe(true)
  return reactQuiesceContract.output.parse(response.result)
}

const later = <T>(ms: number, value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms))

async function mounted(element: ReactNode, text: string): Promise<void> {
  root.render(element)
  await expect.poll(() => container.textContent, { timeout: 3_000 }).toContain(text)
}

describe('react_quiesce against a real React tree', () => {
  it('reports idle only after a timer-driven commit has landed', async () => {
    function Delayed(): ReactNode {
      const [label, setLabel] = useState('waiting')
      useEffect(() => {
        const timer = setTimeout(() => setLabel('done'), 300)
        return () => clearTimeout(timer)
      }, [])
      return createElement('p', null, label)
    }
    await mounted(createElement(Delayed), 'waiting')
    const result = await quiesce({ idleMs: 500, timeoutMs: 5_000 })
    expect(result.outcome).toBe('idle')
    expect(container.textContent).toBe('done')
  })

  it('waits out a chain of effects that each schedule the next update', async () => {
    function Chain(): ReactNode {
      const [step, setStep] = useState(0)
      useEffect(() => {
        if (step >= 6) return
        const timer = setTimeout(() => setStep(step + 1), 120)
        return () => clearTimeout(timer)
      }, [step])
      return createElement('p', null, `step ${step}`)
    }
    await mounted(createElement(Chain), 'step 0')
    const result = await quiesce({ idleMs: 400, timeoutMs: 5_000 })
    expect(result.outcome).toBe('idle')
    expect(container.textContent).toBe('step 6')
  })

  it('does not report idle while a Suspense boundary waits on a pending promise', async () => {
    const data = later(1_200, 'loaded')
    function Reader(): ReactNode {
      return createElement('p', null, use(data))
    }
    await mounted(
      createElement(
        Suspense,
        { fallback: createElement('p', null, 'loading') },
        createElement(Reader),
      ),
      'loading',
    )
    const result = await quiesce({ idleMs: 300, timeoutMs: 5_000 })
    expect(container.textContent).toBe('loaded')
    expect(result.outcome).toBe('idle')
    expect(result.pendingWork).toMatchObject({ scheduledRoots: 0, suspendedBoundaries: 0 })
  })

  it('times out naming the boundary when a Suspense fallback never resolves', async () => {
    const never = new Promise<string>(() => {})
    function Reader(): ReactNode {
      return createElement('p', null, use(never))
    }
    function Stuck(): ReactNode {
      return createElement(
        Suspense,
        { fallback: createElement('p', null, 'loading') },
        createElement(Reader),
      )
    }
    await mounted(createElement(Stuck), 'loading')
    const result = await quiesce({ idleMs: 200, timeoutMs: 1_500 })
    expect(result).toMatchObject({ ok: false, outcome: 'timed-out' })
    expect(result.reason).toContain('Suspense')
    expect(result.pendingWork).toMatchObject({ suspendedBoundaries: 1 })
  })

  it('does not count a fallback the agent holds open as pending work', async () => {
    function Content(): ReactNode {
      return createElement('p', null, 'content')
    }
    await mounted(
      createElement(
        Suspense,
        { fallback: createElement('p', null, 'held') },
        createElement(Content),
      ),
      'content',
    )
    const found = await invoke('react_find_components', { query: 'Content', limit: 1 })
    const id = found.result.matches[0].id
    const toggled = await invoke('react_toggle_suspense_fallback', { id, showFallback: true })
    expect(toggled.ok).toBe(true)
    await expect.poll(() => container.textContent, { timeout: 3_000 }).toContain('held')
    const result = await quiesce({ idleMs: 200, timeoutMs: 3_000 })
    expect(result.outcome).toBe('idle')
    expect(result.pendingWork).toMatchObject({ suspendedBoundaries: 0 })
  })

  it('does not report idle while a transition is suspended on a pending promise', async () => {
    let navigate: (() => void) | undefined
    const next = later(1_200, 'next page')
    function Page(): ReactNode {
      return createElement('p', null, use(next))
    }
    function App(): ReactNode {
      const [page, setPage] = useState<'home' | 'next'>('home')
      navigate = () => startTransition(() => setPage('next'))
      return createElement(
        Suspense,
        { fallback: createElement('p', null, 'loading') },
        page === 'home' ? createElement('p', null, 'home') : createElement(Page),
      )
    }
    await mounted(createElement(App), 'home')
    navigate?.()
    const result = await quiesce({ idleMs: 300, timeoutMs: 5_000 })
    expect(container.textContent).toBe('next page')
    expect(result.outcome).toBe('idle')
  })

  it('keeps devtools_wait settled pending while a transition is suspended', async () => {
    let navigate: (() => void) | undefined
    const next = later(1_000, 'next page')
    function Page(): ReactNode {
      return createElement('p', null, use(next))
    }
    function App(): ReactNode {
      const [page, setPage] = useState<'home' | 'next'>('home')
      navigate = () => startTransition(() => setPage('next'))
      return page === 'home' ? createElement('p', null, 'home') : createElement(Page)
    }
    await mounted(createElement(App), 'home')
    navigate?.()
    const response = await invoke('devtools_wait', {
      condition: 'settled',
      domains: ['react'],
      quietMs: 200,
      timeoutMs: 5_000,
    })
    expect(container.textContent).toBe('next page')
    expect(response.result).toMatchObject({ ok: true, domains: { react: { status: 'met' } } })
    expect(response.result.domains.react.lastObserved.pendingWork).toMatchObject({
      scheduledRoots: 0,
    })
  })

  describe('on a tree larger than one pending-work scan slice', () => {
    /** Rows that come before the boundary in walk order, so the first slice ends long before it. */
    function Rows(): ReactNode {
      return Array.from({ length: PENDING_WORK_FIBERS_PER_CALL + 10_000 }, (_, index) =>
        createElement('i', { key: index }),
      )
    }

    it('does not report idle while the only fallback sits past the first slice', async () => {
      const never = new Promise<string>(() => {})
      function Reader(): ReactNode {
        return createElement('p', null, use(never))
      }
      await mounted(
        createElement(
          'main',
          null,
          createElement(Rows),
          createElement(
            Suspense,
            { fallback: createElement('p', null, 'loading') },
            createElement(Reader),
          ),
        ),
        'loading',
      )
      const result = await quiesce({ idleMs: 200, timeoutMs: 3_000 })
      expect(result).toMatchObject({
        ok: false,
        outcome: 'timed-out',
        pendingWork: { suspendedBoundaries: 1, scanTruncated: false },
      })
      expect(result.reason).toContain('1 Suspense boundary shows a fallback')
    }, 20_000)

    it('keeps devtools_wait settled pending while the only fallback sits past the first slice', async () => {
      const never = new Promise<string>(() => {})
      function Reader(): ReactNode {
        return createElement('p', null, use(never))
      }
      await mounted(
        createElement(
          'main',
          null,
          createElement(Rows),
          createElement(
            Suspense,
            { fallback: createElement('p', null, 'loading') },
            createElement(Reader),
          ),
        ),
        'loading',
      )
      const response = await invoke('devtools_wait', {
        condition: 'settled',
        domains: ['react'],
        quietMs: 200,
        timeoutMs: 3_000,
      })
      expect(response.result).toMatchObject({
        ok: false,
        reason: 'timeout',
        domains: { react: { status: 'pending' } },
      })
      expect(response.result.domains.react.lastObserved.pendingWork).toMatchObject({
        suspendedBoundaries: 1,
        scanTruncated: false,
      })
    }, 20_000)

    it('reaches idle once the slices have covered a tree with no pending work', async () => {
      await mounted(createElement('main', null, createElement(Rows), 'rows'), 'rows')
      const result = await quiesce({ idleMs: 200, timeoutMs: 5_000 })
      expect(result).toMatchObject({
        outcome: 'idle',
        pendingWork: { suspendedBoundaries: 0, scanTruncated: false },
      })
      expect(result.pendingWork?.scannedFibers).toBeGreaterThan(PENDING_WORK_FIBERS_PER_CALL)
    }, 20_000)
  })
})
