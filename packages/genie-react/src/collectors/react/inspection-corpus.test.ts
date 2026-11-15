// @vitest-environment jsdom

// biome-ignore-all lint/correctness/useHookAtTopLevel: the conditional use() fixture reads a context conditionally on purpose
import 'bippy/install-hook-only'
import { act, render } from '@testing-library/react'
import {
  Activity,
  Component,
  createContext,
  Fragment,
  type FunctionComponent,
  forwardRef,
  createElement as h,
  lazy,
  memo,
  type ReactNode,
  Suspense,
  use,
  useActionState,
  useContext,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useOptimistic,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react'
import * as compilerRuntime from 'react/compiler-runtime'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { reactCollectorHarness } from '../../test-support/react-collector'

const { call, start, stop } = reactCollectorHarness()

interface Match {
  id: number
  name: string
  path: string
  props: Record<string, unknown>
}
interface FindResult {
  matches: Match[]
  omittedByLimit: number
  nextCursor: string | null
  unmountedSinceSearch: number
}
interface TreeNode {
  id: number
  parentId: number | null
  name: string
  omittedDescendants?: number
  wrapperAncestry?: { kind: string; name: string }[]
}
interface Tree {
  nodes: TreeNode[]
  total: number
  truncatedBy: string | null
  omitted: { depth: number; maxNodes: number }
}
interface HookEntry {
  index: number
  kind: string
  hook?: string
  stateful: boolean
  stateIndex?: number
  value?: unknown
  customHooks?: string[] | null
}
interface Inspected {
  name: string
  hooks: HookEntry[]
  customHookGrouping?: string
  wrapperAncestry: { kind: string; name: string }[]
}

const find = (component: string, extra: Record<string, unknown> = {}) =>
  call<FindResult>('react_find_components', { component, exact: true, ...extra })

async function idOf(component: string): Promise<number> {
  const [match] = (await find(component)).matches
  if (!match) throw new Error(`${component} is not mounted`)
  return match.id
}

const inspect = async (component: string) =>
  call<Inspected>('react_inspect_component', { id: await idOf(component) })

// ── Fixture app: every element's truth is known by construction ────────────

const MemoNamed = memo(function MemoInner() {
  return h('span', null, 'memo')
})
const ForwardNamed = forwardRef<HTMLInputElement>(function FancyInput(_props, ref) {
  return h('input', { ref })
})
const ForwardAnonymous = forwardRef<HTMLInputElement>((_props, ref) => h('input', { ref }))
function withTracking<P extends object>(Inner: (props: P) => ReactNode) {
  const Tracked = (props: P) => h(Inner, props)
  Tracked.displayName = `withTracking(${Inner.name})`
  return Tracked
}
const TrackedCard = withTracking(function Card() {
  return h('div', null, 'card')
})
const LazyPanel = lazy(async () => ({
  default: function Panel() {
    return h('p', null, 'lazy panel')
  },
}))
class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  override render() {
    return this.state.error ? h('p', null, 'failed') : this.props.children
  }
}

// React Compiler output calls the runtime's `c(size)`, which @types/react does not declare.
const useMemoCache = (compilerRuntime as unknown as { c: (size: number) => unknown[] }).c

function CompiledBadge({ label }: { label: string }) {
  const $ = useMemoCache(2)
  let element: ReactNode
  if ($[0] !== label) {
    element = h('b', null, label)
    $[0] = label
    $[1] = element
  } else {
    element = $[1] as ReactNode
  }
  return element
}

const externalValue = 7
const subscribe = () => () => {}
function useCart(id: string) {
  const [items] = useState([id])
  useEffect(() => {}, [])
  return items
}
function AllHooks() {
  const id = useId()
  const [count] = useState(1)
  const [total] = useReducer((value: number, delta: number) => value + delta, 10)
  const ref = useRef('ref')
  const [pending] = useTransition()
  const deferred = useDeferredValue('deferred')
  const external = useSyncExternalStore(subscribe, () => externalValue)
  const [optimistic] = useOptimistic('optimistic')
  const [actionState] = useActionState(async (state: number) => state, 3)
  const onEvent = useEffectEvent(() => {})
  useLayoutEffect(() => {}, [])
  const cart = useCart('sku')
  void onEvent
  return h(
    'em',
    null,
    [
      id,
      count,
      total,
      ref.current,
      pending,
      deferred,
      external,
      optimistic,
      actionState,
      cart,
    ].join(),
  )
}

const Theme = createContext('default-theme')
Theme.displayName = 'Theme'
function ThemeReader() {
  return h('span', null, useContext(Theme))
}
const MemoThemeReader = memo(function MemoThemeReader() {
  return h('span', null, useContext(Theme))
})
function ConditionalReader({ read }: { read: boolean }) {
  const theme = read ? use(Theme) : 'none'
  const [after] = useState('after-use')
  return h('span', null, theme, after)
}

function TextOnly() {
  return 'loose text'
}
function Fragmented() {
  return h(
    Fragment,
    null,
    h('em', { id: 'frag-a' }, 'a'),
    ' between ',
    h('em', { id: 'frag-b' }, 'b'),
  )
}
const portalHost = document.createElement('div')
portalHost.id = 'portal-host'
document.body.append(portalHost)
function Modal() {
  return createPortal(
    h('dialog', { id: 'modal', open: true }, h(Leaf, { label: 'in-portal' })),
    portalHost,
  )
}
function Leaf({ label }: { label: string }) {
  return h('li', { 'data-testid': `leaf-${label}` }, label)
}
function Chain({ depth }: { depth: number }): ReactNode {
  return depth === 0 ? h(Leaf, { label: 'chain-end' }) : h(Chain, { depth: depth - 1 })
}

let setOrder: (order: string[]) => void = () => {}
let setShowToggled: (show: boolean) => void = () => {}
function List() {
  const [order, set] = useState(['a', 'b', 'c'])
  setOrder = set
  return h(
    'ul',
    null,
    order.map((key) => h(Leaf, { key, label: key })),
  )
}
function Toggled() {
  return h('p', null, 'toggled')
}
function ToggleHost() {
  const [show, set] = useState(true)
  setShowToggled = set
  return show ? h(Toggled) : null
}

function App() {
  return h(
    'main',
    null,
    h(MemoNamed),
    h(ForwardNamed),
    h(ForwardAnonymous),
    h(TrackedCard),
    h(Suspense, { fallback: h('i', null, 'loading') }, h(LazyPanel)),
    h(Boundary, null, h('p', null, 'healthy')),
    h(CompiledBadge, { label: 'compiled' }),
    h(AllHooks),
    h(
      Theme.Provider,
      { value: 'outer' },
      h(Theme.Provider, { value: 'inner' }, h(ThemeReader), h(MemoThemeReader)),
      h(ConditionalReader, { read: true }),
    ),
    h('div', { id: 'text-only-host' }, h(TextOnly)),
    h(Fragmented),
    h(Modal),
    h(Chain, { depth: 4 }),
    h(List),
    h(ToggleHost),
    h(HiddenActivity, { mode: 'hidden' }, h(Leaf, { label: 'hidden' })),
  )
}

// ActivityProps requires `children` as a prop, but createElement passes them as arguments.
const HiddenActivity = Activity as unknown as FunctionComponent<{ mode: 'hidden' | 'visible' }>

function Widget() {
  return h('aside', null, h(Leaf, { label: 'widget' }))
}

let unmountApp: (() => void) | undefined
let unmountWidget: (() => void) | undefined

beforeAll(async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  start()
  const container = document.createElement('div')
  container.id = 'root'
  document.body.append(container)
  await act(async () => {
    unmountApp = render(h(App), { container }).unmount
  })
  const widgetContainer = document.createElement('div')
  document.body.append(widgetContainer)
  const widget = createRoot(widgetContainer)
  await act(async () => widget.render(h(Widget)))
  unmountWidget = () => widget.unmount()
})

afterAll(() => {
  unmountWidget?.()
  unmountApp?.()
  stop()
})

describe('component names and wrappers', () => {
  it('names wrapped components by their inner function and reports the wrapper', async () => {
    const tree = await call<Tree>('react_get_tree', { appOnly: false, depth: 30, maxNodes: 2000 })
    const byName = (name: string) => tree.nodes.find((node) => node.name === name)
    expect(byName('MemoInner')?.wrapperAncestry).toEqual([{ kind: 'memo', name: 'MemoInner' }])
    expect(byName('FancyInput')?.wrapperAncestry).toEqual([
      { kind: 'forward-ref', name: 'FancyInput' },
    ])
    expect(byName('withTracking(Card)')).toBeDefined()
    expect(byName('Card')?.parentId).toBe(byName('withTracking(Card)')?.id)
    expect(byName('Panel')?.wrapperAncestry).toEqual([{ kind: 'lazy', name: 'Panel' }])
    expect(byName('Boundary')).toBeDefined()
  })

  it('names an inline forwardRef render "Anonymous" rather than borrowing a neighbour name', async () => {
    const tree = await call<Tree>('react_get_tree', { appOnly: false, depth: 30, maxNodes: 2000 })
    const anonymous = tree.nodes.filter((node) => node.name === 'Anonymous')
    expect(anonymous).toHaveLength(1)
    expect(anonymous[0]?.wrapperAncestry).toEqual([{ kind: 'forward-ref', name: 'Anonymous' }])
  })

  it('marks React Compiler output with its memo-cache frame', async () => {
    const badge = await inspect('CompiledBadge')
    expect(badge.wrapperAncestry).toEqual([{ kind: 'compiler-memo-cache', name: 'CompiledBadge' }])
    expect(badge.hooks).toEqual([])
  })
})

describe('hooks', () => {
  it('names the React hook behind every slot and marks only real state as overridable', async () => {
    const { hooks, customHookGrouping } = await inspect('AllHooks')
    expect(hooks.map(({ hook, kind, stateful }) => [hook, kind, stateful])).toEqual([
      ['useId', 'other', false],
      ['useState', 'state', true],
      ['useReducer', 'reducer', true],
      ['useRef', 'ref', false],
      ['useTransition', 'other', false],
      ['useTransition', 'other', false],
      ['useDeferredValue', 'other', false],
      ['useSyncExternalStore', 'other', false],
      ['useSyncExternalStore', 'effect', false],
      ['useOptimistic', 'other', true],
      ['useActionState', 'reducer', true],
      ['useActionState', 'other', false],
      ['useActionState', 'other', true],
      ['useEffectEvent', 'other', false],
      ['useLayoutEffect', 'layout-effect', false],
      ['useState', 'state', true],
      ['useEffect', 'effect', false],
    ])
    expect(hooks.slice(-2).map((hook) => hook.customHooks)).toEqual([['useCart'], ['useCart']])
    expect(hooks.map((hook) => hook.stateIndex)).toEqual([
      undefined,
      0,
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      2,
      3,
      undefined,
      4,
      undefined,
      undefined,
      5,
      undefined,
    ])
    expect(hooks.find((hook) => hook.hook === 'useSyncExternalStore')?.value).toBe(externalValue)
    expect(customHookGrouping).toBe('partial')
  })

  it('keeps hook order and values exact after a conditional use()', async () => {
    const { hooks, customHookGrouping } = await inspect('ConditionalReader')
    expect(hooks).toEqual([
      expect.objectContaining({ index: 0, hook: 'useState', value: 'after-use', stateIndex: 0 }),
    ])
    expect(customHookGrouping).toBe('exact')
  })
})

describe('context', () => {
  interface ContextResult {
    contexts: { name: string; value: unknown; provider: { id: number; name: string } | null }[]
  }
  const contextsOf = async (component: string) =>
    (await call<ContextResult>('react_inspect_context', { id: await idOf(component) })).contexts

  it('names the innermost Provider of a nested context, through memo too', async () => {
    const [reader] = await contextsOf('ThemeReader')
    const [memoReader] = await contextsOf('MemoThemeReader')
    expect(reader).toEqual({
      name: 'Theme',
      value: 'inner',
      provider: { id: expect.any(Number), name: 'Theme.Provider' },
    })
    expect(memoReader).toEqual(reader)
    const [outer] = await contextsOf('ConditionalReader')
    expect(outer?.value).toBe('outer')
    expect(outer?.provider?.id).not.toBe(reader?.provider?.id)
  })

  it('the named Provider is the one react_override_context edits', async () => {
    const [reader] = await contextsOf('ThemeReader')
    const applied = await call<{ providerId: number }>('react_override_context', {
      id: await idOf('ThemeReader'),
      value: 'inner',
    })
    await call('react_reset_overrides', {})
    expect(applied.providerId).toBe(reader?.provider?.id)
  })
})

describe('DOM mapping', () => {
  interface DomFor {
    elements: { tag: string; selector: string; text: string | null }[]
    total: number
  }
  interface ComponentFor {
    components: { id: number; name: string }[]
  }
  const domOf = async (component: string) =>
    call<DomFor>('react_dom_for_component', { id: await idOf(component) })
  const ownersOf = (selector: string) =>
    call<ComponentFor>('react_component_for_dom', { selector, appOnly: false })

  it('reports a text-only component by the element containing its text', async () => {
    expect(await domOf('TextOnly')).toMatchObject({
      total: 1,
      elements: [{ tag: '#text', selector: '#text-only-host', text: 'loose text' }],
    })
  })

  it('lists every host node of a fragment in order, loose text included', async () => {
    const dom = await domOf('Fragmented')
    expect(dom.elements.map((element) => [element.tag, element.text])).toEqual([
      ['em', 'a'],
      ['#text', 'between'],
      ['em', 'b'],
    ])
  })

  it('maps a portal both ways', async () => {
    expect((await domOf('Modal')).elements.map((element) => element.selector)).toEqual(['#modal'])
    expect((await ownersOf('#modal')).components.map((owner) => owner.name)).toEqual(['Modal'])
    expect((await ownersOf('[data-testid="leaf-in-portal"]')).components).toEqual([
      expect.objectContaining({ name: 'Leaf' }),
    ])
  })

  it('round-trips a component that renders its own elements', async () => {
    const id = await idOf('Fragmented')
    for (const selector of ['#frag-a', '#frag-b']) {
      expect((await ownersOf(selector)).components.map((owner) => owner.id)).toEqual([id])
    }
  })
})

describe('tree limits', () => {
  it('accounts for every node it leaves out, per limit', async () => {
    const full = await call<Tree>('react_get_tree', { appOnly: false, depth: 80, maxNodes: 2000 })
    for (const options of [{ depth: 2 }, { maxNodes: 5 }, { depth: 1, maxNodes: 12 }]) {
      const tree = await call<Tree>('react_get_tree', { appOnly: false, ...options })
      expect(tree.total, JSON.stringify(options)).toBe(full.total)
      expect(tree.nodes.length + tree.omitted.depth + tree.omitted.maxNodes).toBe(full.total)
      const clipped = tree.nodes.reduce((sum, node) => sum + (node.omittedDescendants ?? 0), 0)
      expect(clipped).toBe(tree.omitted.depth)
    }
    const both = await call<Tree>('react_get_tree', { appOnly: false, depth: 1, maxNodes: 12 })
    expect(both.truncatedBy).toBe('maxNodes')
    expect(both.omitted.depth).toBeGreaterThan(0)
  })

  it('a depth-clipped node can be drilled into to read exactly what was cut', async () => {
    const tree = await call<Tree>('react_get_tree', { appOnly: false, depth: 1 })
    const chain = tree.nodes.find((node) => node.name === 'Chain')
    const subtree = await call<Tree>('react_get_tree', {
      appOnly: false,
      rootId: chain?.id,
      depth: 80,
    })
    expect(subtree.nodes).toHaveLength(1 + (chain?.omittedDescendants ?? 0))
  })
})

describe('react_find_components', () => {
  it('finds matches in every root, hidden Activity content included', async () => {
    const labels = (await find('Leaf', { limit: 200 })).matches.map((match) => match.props.label)
    expect(labels).toEqual(
      expect.arrayContaining(['in-portal', 'chain-end', 'a', 'b', 'c', 'hidden', 'widget']),
    )
    expect(labels).toHaveLength(7)
  })

  it('pages through every match exactly once', async () => {
    const all = (await find('Leaf', { limit: 200 })).matches.map((match) => match.id)
    const paged: number[] = []
    let page = await find('Leaf', { limit: 2 })
    paged.push(...page.matches.map((match) => match.id))
    while (page.nextCursor) {
      expect(page.omittedByLimit).toBe(all.length - paged.length)
      page = await call<FindResult>('react_find_components', { cursor: page.nextCursor, limit: 2 })
      paged.push(...page.matches.map((match) => match.id))
    }
    expect(paged).toEqual(all)
    expect(page.omittedByLimit).toBe(0)
  })

  it('skips and counts a match that unmounted between pages, never returning its id', async () => {
    const first = await find('Leaf', { limit: 1 })
    const before = (await find('Leaf', { limit: 200 })).matches
    const removed = before.find((match) => match.props.label === 'b')
    await act(async () => setOrder(['a', 'c']))
    const rest: Match[] = []
    let cursor = first.nextCursor
    let unmounted = 0
    while (cursor) {
      const page = await call<FindResult>('react_find_components', { cursor, limit: 50 })
      rest.push(...page.matches)
      unmounted += page.unmountedSinceSearch
      cursor = page.nextCursor
    }
    expect(unmounted).toBe(1)
    expect(rest.map((match) => match.id)).not.toContain(removed?.id)
    expect(rest).toHaveLength(before.length - 2)
    await act(async () => setOrder(['a', 'b', 'c']))
  })

  it('rejects an unknown cursor instead of starting over', async () => {
    await expect(
      call('react_find_components', { cursor: '00000000-0000-4000-8000-000000000000:1' }),
    ).rejects.toThrow(/cursor is invalid, expired, or evicted/)
  })
})

describe('instance identity', () => {
  it('keeps an id across a keyed reorder and fails it after the instance unmounts', async () => {
    const leafB = (await find('Leaf', { limit: 200 })).matches.find((m) => m.props.label === 'b')
    await act(async () => setOrder(['c', 'b', 'a']))
    expect(
      (await call<{ props: unknown }>('react_inspect_component', { id: leafB?.id })).props,
    ).toEqual({ label: 'b' })
    await act(async () => setOrder(['c', 'a']))
    await expect(call('react_inspect_component', { id: leafB?.id })).rejects.toThrow(/not found/)
    await act(async () => setOrder(['a', 'b', 'c']))
  })

  it('never resolves a remounted component through the id of its previous instance', async () => {
    const before = await idOf('Toggled')
    await act(async () => setShowToggled(false))
    await act(async () => setShowToggled(true))
    const after = await idOf('Toggled')
    expect(after).not.toBe(before)
    await expect(call('react_inspect_component', { id: before })).rejects.toThrow(/not found/)
  })

  it('numbers this document past the ids a previous document handed out', async () => {
    const tree = await call<Tree>('react_get_tree', { appOnly: false, depth: 80, maxNodes: 2000 })
    const smallest = Math.min(...tree.nodes.map((node) => node.id))
    for (const staleId of [0, 1, tree.nodes.length, 10_000]) {
      expect(staleId).toBeLessThan(smallest)
      await expect(call('react_inspect_component', { id: staleId })).rejects.toThrow(/not found/)
    }
  })
})
