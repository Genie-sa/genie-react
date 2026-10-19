// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { createRequire } from 'node:module'
import { render } from '@testing-library/react'
import { act, createElement } from 'react'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { CollectorContext } from '../../client'
import { reactCollector } from './collector'
import { forgetCommittedRoots } from './fiber'

interface ReactCopy {
  createElement: typeof createElement
  createRoot: (container: Element) => { render: (node: unknown) => void; unmount: () => void }
}

const require = createRequire(import.meta.url)

// A widget such as Clerk ships its own production React; loading react + react-dom again with a cleared module cache reproduces that second renderer.
function loadProductionReactCopy(): ReactCopy {
  const isReactModule = (id: string) =>
    /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)
  const saved = Object.entries(require.cache).filter(([id]) => isReactModule(id))
  for (const [id] of saved) delete require.cache[id]
  const nodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    const react = require('react') as typeof import('react')
    const client = require('react-dom/client') as ReactCopy
    return { createElement: react.createElement, createRoot: client.createRoot }
  } finally {
    process.env.NODE_ENV = nodeEnv
    for (const id of Object.keys(require.cache)) if (isReactModule(id)) delete require.cache[id]
    for (const [id, module] of saved) require.cache[id] = module
  }
}

const context: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}
const collector = reactCollector()
let stop: (() => void) | undefined
let cleanup: (() => void) | undefined

async function call<T>(name: string, input: unknown): Promise<T> {
  const tool = collector.tools?.find((candidate) => candidate.contract.name === name)
  if (!tool) throw new Error(`Missing tool ${name}`)
  return (await tool.handler(tool.contract.input.parse(input) as never, context)) as T
}

function Toaster() {
  return createElement('div', { id: 'toaster' })
}
function Page() {
  return createElement('main', null, createElement(Toaster), createElement('div', { id: 'widget' }))
}

beforeAll(async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  stop = collector.start?.(context) || undefined
  const container = document.createElement('div')
  document.body.append(container)
  let app: { unmount: () => void } | undefined
  await act(async () => {
    app = render(createElement(Page), { container })
  })

  // The widget tree outscores the app tree, the failure mode that hid app components.
  const widgetReact = loadProductionReactCopy()
  function SignIn() {
    return widgetReact.createElement(
      'form',
      { id: 'sign-in' },
      Array.from({ length: 3000 }, (_, index) => widgetReact.createElement('span', { key: index })),
    )
  }
  const widgetContainer = document.getElementById('widget')
  if (!widgetContainer) throw new Error('app did not render the widget container')
  const widget = widgetReact.createRoot(widgetContainer)
  await act(async () => widget.render(widgetReact.createElement(SignIn)))
  cleanup = () => {
    widget.unmount()
    app?.unmount()
    container.remove()
  }
})

afterAll(() => {
  cleanup?.()
  stop?.()
  forgetCommittedRoots()
})

describe('an app with a widget that bundles its own production React', () => {
  it('keeps the app root primary and finds components in both roots', async () => {
    const tree = await call<{
      nodes: { name: string }[]
      otherRoots?: { rootId: number; name: string }[]
    }>('react_get_tree', { depth: 3 })
    expect(tree.nodes[0]?.name).toBe('Page')
    expect(tree.otherRoots).toEqual([{ rootId: expect.any(Number), name: 'SignIn' }])

    for (const component of ['Toaster', 'SignIn']) {
      const found = await call<{ matches: { name: string }[] }>('react_find_components', {
        component,
      })
      expect(found.matches.map((match) => match.name)).toEqual([component])
    }
  })

  it('reads a widget root through its otherRoots rootId', async () => {
    const tree = await call<{ otherRoots: { rootId: number }[] }>('react_get_tree', { depth: 1 })
    const widgetTree = await call<{ nodes: { name: string }[] }>('react_get_tree', {
      rootId: tree.otherRoots[0]?.rootId,
      depth: 1,
      appOnly: false,
    })
    expect(widgetTree.nodes[0]?.name).toBe('SignIn')
  })

  it('overrides app components and refuses widget components without touching the app renderer', async () => {
    const find = async (component: string) =>
      (await call<{ matches: { id: number }[] }>('react_find_components', { component })).matches[0]
        ?.id

    await expect(
      call('react_override_props', { id: await find('Toaster'), props: { title: 'x' } }),
    ).resolves.toMatchObject({ ok: true })
    await expect(
      call('react_override_props', { id: await find('SignIn'), props: { title: 'x' } }),
    ).rejects.toThrow(/production build/)
    await call('react_reset_overrides', {})
  })
})
