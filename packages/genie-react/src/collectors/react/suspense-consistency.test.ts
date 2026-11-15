// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { Activity, createElement as h, type ReactNode, Suspense, use, useState } from 'react'
import { jsx } from 'react/jsx-runtime'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { PendingReactWork } from '../../protocol'
import { reactCollectorHarness } from '../../test-support/react-collector'

const { call, start, stop } = reactCollectorHarness()

beforeAll(start)
afterAll(stop)

const never = new Promise<string>(() => {})
const settle = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms))

let root: Root | null = null
let host: HTMLElement | null = null

afterEach(async () => {
  await call('react_reset_overrides', {})
  root?.unmount()
  root = null
  host?.remove()
  host = null
  await settle(20)
})

function container(html = ''): HTMLElement {
  host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  return host
}

async function mount(element: ReactNode): Promise<void> {
  root = createRoot(container())
  root.render(element)
  await settle()
}

function Waits(): ReactNode {
  return h('p', null, use(never))
}

function Ready(): ReactNode {
  return h('p', null, 'ready')
}

interface SuspenseBoundary {
  id: number
  name: string
  state: 'fallback' | 'transition-pending' | 'dehydrated' | 'content'
  forced: boolean
}

interface ErrorStateSuspended {
  boundaryId: number
  forced: boolean
}

interface Views {
  suspense: SuspenseBoundary[]
  pending: PendingReactWork
  errorState: ErrorStateSuspended[]
}

async function views(): Promise<Views> {
  const suspense = await call<{ boundaries: SuspenseBoundary[] }>('react_suspense', {
    includeSource: false,
    appOnly: false,
    limit: 200,
  })
  const pending = await call<PendingReactWork>('react_pending_work', {})
  const errorState = await call<{ suspended: ErrorStateSuspended[] }>('react_error_state', {
    includeSource: false,
    appOnly: false,
  })
  return { suspense: suspense.boundaries, pending, errorState: errorState.suspended }
}

const ids = (values: { id?: number; boundaryId?: number }[]) =>
  values.map((value) => value.id ?? value.boundaryId).sort((a, b) => Number(a) - Number(b))

/** The invariant: every tool names the same boundaries as waiting, and only forced ones differ in how they count. */
function expectAgreement({ suspense, pending, errorState }: Views): void {
  const fallback = suspense.filter((boundary) => boundary.state === 'fallback' && !boundary.forced)
  const dehydrated = suspense.filter((boundary) => boundary.state === 'dehydrated')
  expect(ids(pending.boundaries.filter((boundary) => boundary.state === 'fallback'))).toEqual(
    ids(fallback),
  )
  expect(pending.suspendedBoundaries).toBe(fallback.length)
  expect(ids(pending.boundaries.filter((boundary) => boundary.state === 'dehydrated'))).toEqual(
    ids(dehydrated),
  )
  expect(pending.dehydratedBoundaries).toBe(dehydrated.length)
  expect(ids(errorState.filter((entry) => !entry.forced))).toEqual(ids(fallback))
  expect(ids(errorState.filter((entry) => entry.forced))).toEqual(
    ids(suspense.filter((boundary) => boundary.forced)),
  )
}

describe('react_suspense, react_pending_work and react_error_state agree on what is suspended', () => {
  it('a visible fallback is waiting in every tool', async () => {
    await mount(h(Suspense, { fallback: h('p', null, 'loading') }, h(Waits)))

    const seen = await views()
    expect(seen.suspense.map((boundary) => boundary.state)).toEqual(['fallback'])
    expectAgreement(seen)
  })

  it('a server-rendered boundary still awaiting hydration shows server HTML, not its fallback', async () => {
    const html = renderToString(h(Suspense, { fallback: h('p', null, 'loading') }, h(Ready)))
    const target = container(html)
    root = hydrateRoot(target, h(Suspense, { fallback: h('p', null, 'loading') }, h(Waits)))
    await settle()
    expect(target.textContent).toBe('ready')

    const seen = await views()
    expect(seen.suspense.map((boundary) => boundary.state)).toEqual(['dehydrated'])
    expect(seen.errorState).toEqual([])
    expect(seen.pending).toMatchObject({ suspendedBoundaries: 0, dehydratedBoundaries: 1 })
    expectAgreement(seen)
  })

  it('a boundary waiting inside a hidden Activity is not on screen in any tool', async () => {
    let hide: () => void = () => {}
    function Tabs(): ReactNode {
      const [mode, setMode] = useState<'visible' | 'hidden'>('visible')
      hide = () => setMode('hidden')
      return jsx(Activity, {
        mode,
        children: h(Suspense, { name: 'hidden-tab', fallback: h('p', null, 'loading') }, h(Waits)),
      })
    }
    await mount(h(Tabs))
    expect((await views()).pending.suspendedBoundaries).toBe(1)

    hide()
    await settle()
    const seen = await views()
    expect(seen.suspense).toEqual([])
    expect(seen.pending.suspendedBoundaries).toBe(0)
    expectAgreement(seen)
  })

  it('a forced fallback is flagged in react_suspense and react_error_state and never blocks idle', async () => {
    await mount(h(Suspense, { name: 'forced', fallback: h('p', null, 'loading') }, h(Ready)))
    const [boundary] = (await views()).suspense
    expect(boundary).toMatchObject({ state: 'content' })

    await call('react_toggle_suspense_fallback', { id: boundary?.id, showFallback: true })
    await settle()
    const seen = await views()
    expect(seen.suspense).toMatchObject([{ state: 'fallback', forced: true }])
    expect(seen.pending.suspendedBoundaries).toBe(0)
    expectAgreement(seen)
  })

  it('nested boundaries, one waiting inside resolved content, agree', async () => {
    await mount(
      h(
        Suspense,
        { name: 'outer', fallback: h('p', null, 'outer loading') },
        h(Ready),
        h(Suspense, { name: 'inner', fallback: h('p', null, 'inner loading') }, h(Waits)),
        h(Suspense, { name: 'done', fallback: h('p', null, 'done loading') }, h(Ready)),
      ),
    )

    const seen = await views()
    expect(seen.suspense.map((boundary) => [boundary.name, boundary.state]).sort()).toEqual([
      ['done', 'content'],
      ['inner', 'fallback'],
      ['outer', 'content'],
    ])
    expectAgreement(seen)
  })
})
