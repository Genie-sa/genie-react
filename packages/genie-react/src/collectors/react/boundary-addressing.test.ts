// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { Component, createElement as h, type ReactNode, Suspense, use } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { reactCollectorHarness } from '../../test-support/react-collector'

const { call, start, stop } = reactCollectorHarness()

beforeAll(start)
afterAll(stop)

const never = new Promise<string>(() => {})
const settle = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms))

class Guard extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override render(): ReactNode {
    return this.state.failed ? h('p', null, 'failed') : this.props.children
  }
}

function Waits(): ReactNode {
  return h('p', null, use(never))
}

function Throws(): ReactNode {
  throw new Error('boom')
}

function Page(): ReactNode {
  return h(
    'main',
    null,
    h(Suspense, { name: 'feed', fallback: h('p', null, 'loading') }, h(Waits)),
    h(Guard, null, h(Throws)),
  )
}

interface TreeNode {
  id: number
  parentId: number | null
  name: string
  kind: string
  errorBoundary?: boolean
}

let root: Root | null = null
let host: HTMLElement | null = null

afterEach(() => {
  root?.unmount()
  root = null
  host?.remove()
  host = null
  vi.restoreAllMocks()
})

async function mount(): Promise<void> {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  root.render(h(Page))
  await settle()
}

async function tree(appOnly: boolean): Promise<TreeNode[]> {
  return (await call<{ nodes: TreeNode[] }>('react_get_tree', { appOnly, maxNodes: 2000 })).nodes
}

describe('boundary ids from react_suspense and react_error_state address the same node everywhere', () => {
  it('lists every Suspense and error boundary in react_get_tree under the id the boundary tools report', async () => {
    await mount()
    const suspense = await call<{ boundaries: { id: number }[] }>('react_suspense', {
      includeSource: false,
      appOnly: false,
    })
    const errors = await call<{
      caughtErrors: { boundaryId: number }[]
      suspended: { boundaryId: number }[]
    }>('react_error_state', { includeSource: false, appOnly: false })
    const boundaryIds = {
      suspense: [
        ...suspense.boundaries.map((boundary) => boundary.id),
        ...errors.suspended.map((boundary) => boundary.boundaryId),
      ],
      error: errors.caughtErrors.map((boundary) => boundary.boundaryId),
    }
    expect(boundaryIds.suspense).toHaveLength(2)
    expect(boundaryIds.error).toHaveLength(1)

    for (const appOnly of [false, true]) {
      const nodes = new Map((await tree(appOnly)).map((node) => [node.id, node]))
      for (const id of boundaryIds.suspense) {
        expect(nodes.get(id)).toMatchObject({ name: 'Suspense', kind: 'suspense' })
      }
      for (const id of boundaryIds.error) {
        expect(nodes.get(id)).toMatchObject({ name: 'Guard', kind: 'component', errorBoundary: true })
      }
    }
  })

  it('nests the components a boundary renders under it', async () => {
    await mount()
    const nodes = await tree(false)
    const boundary = nodes.find((node) => node.kind === 'suspense')
    const guard = nodes.find((node) => node.name === 'Guard')
    expect(boundary?.parentId).toBe(nodes.find((node) => node.name === 'Page')?.id)
    expect(guard?.parentId).toBe(nodes.find((node) => node.name === 'Page')?.id)
    expect(nodes.filter((node) => node.errorBoundary)).toEqual([guard])
  })

  it('finds and inspects a boundary by the id the tree lists', async () => {
    await mount()
    const boundary = (await tree(false)).find((node) => node.kind === 'suspense')
    const found = await call<{ matches: { id: number; kind: string }[] }>(
      'react_find_components',
      { component: 'Suspense', exact: true },
    )
    expect(found.matches).toEqual([expect.objectContaining({ id: boundary?.id, kind: 'suspense' })])

    const inspected = await call<{ id: number; name: string; kind: string; props: unknown }>(
      'react_inspect_component',
      { id: boundary?.id },
    )
    expect(inspected).toMatchObject({ id: boundary?.id, name: 'Suspense', kind: 'suspense' })
    expect(inspected.props).toMatchObject({ name: 'feed' })

    const located = await call<{ boundaries: { id: number }[] }>('react_suspense', {
      id: boundary?.id,
      includeSource: false,
      appOnly: false,
    })
    expect(located.boundaries.map((entry) => entry.id)).toEqual([boundary?.id])
  })
})
