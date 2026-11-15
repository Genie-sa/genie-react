// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { act, createElement as h, type ReactNode, Suspense, use } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { PendingReactWork } from '../../protocol'
import { reactCollectorHarness } from '../../test-support/react-collector'
import { getPendingReactWork } from './pending-work'

const { call, start, stop } = reactCollectorHarness()
const FIBERS_PER_CALL = 128
const ROWS = 300

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  start()
})
afterAll(stop)

let root: Root | null = null
let host: HTMLElement | null = null

afterEach(() => {
  act(() => root?.unmount())
  root = null
  host?.remove()
  host = null
})

const pending = (): Promise<string> => new Promise<string>(() => {})

function Reader({ data }: { data: Promise<string> }): ReactNode {
  return h('p', null, use(data))
}

/** A long list ahead of the boundary in walk order, so a bounded slice reaches the rows long before the fallback. */
function LargeList({ data }: { data: Promise<string> | null }): ReactNode {
  return h(
    'main',
    null,
    Array.from({ length: ROWS }, (_, index) => h('i', { key: index })),
    data ? h(Suspense, { fallback: h('b', null, 'loading') }, h(Reader, { data })) : 'ready',
  )
}

function mount(element: ReactNode): void {
  host = document.createElement('div')
  document.body.append(host)
  const created = createRoot(host)
  root = created
  act(() => created.render(element))
}

function scanUntilComplete(): PendingReactWork[] {
  const slices: PendingReactWork[] = []
  for (let call = 0; call < 10; call += 1) {
    const slice = getPendingReactWork(FIBERS_PER_CALL)
    slices.push(slice)
    if (!slice.scanTruncated) return slices
  }
  throw new Error('The pending-work scan never completed.')
}

describe('react_pending_work on a tree larger than one scan slice', () => {
  it('reports a partial scan as partial, then finds the fallback past the first slice', () => {
    mount(h(LargeList, { data: pending() }))
    expect(host?.textContent).toBe('loading')

    const slices = scanUntilComplete()

    expect(slices.length).toBeGreaterThan(2)
    for (const [index, slice] of slices.slice(0, -1).entries()) {
      expect(slice).toMatchObject({
        scanTruncated: true,
        suspendedBoundaries: 0,
        scannedFibers: FIBERS_PER_CALL * (index + 1),
      })
    }
    const complete = slices.at(-1)
    expect(complete).toMatchObject({
      scanTruncated: false,
      suspendedBoundaries: 1,
      boundaries: [{ state: 'fallback' }],
    })
    expect(complete?.scannedFibers).toBeGreaterThan(ROWS)
  })

  it('serves the completed scan again without rescanning while no commit lands', () => {
    mount(h(LargeList, { data: pending() }))
    const complete = scanUntilComplete().at(-1)

    expect(getPendingReactWork(FIBERS_PER_CALL)).toEqual(complete)
  })

  it('starts over when a commit lands between slices instead of mixing two trees', async () => {
    mount(h(LargeList, { data: pending() }))
    expect(getPendingReactWork(FIBERS_PER_CALL)).toMatchObject({ scanTruncated: true })

    await act(async () => root?.render(h(LargeList, { data: null })))
    expect(host?.textContent).toBe('ready')

    const slices = scanUntilComplete()
    expect(slices[0]?.scannedFibers).toBe(FIBERS_PER_CALL)
    expect(slices.at(-1)).toMatchObject({
      scanTruncated: false,
      suspendedBoundaries: 0,
      boundaries: [],
    })
  })

  it('the tool scans with its default slice, not with the call arguments', async () => {
    mount(h(LargeList, { data: pending() }))
    const viaTool = await call<PendingReactWork>('react_pending_work', {})

    expect(viaTool).toMatchObject({ scanTruncated: false, suspendedBoundaries: 1 })
  })
})
