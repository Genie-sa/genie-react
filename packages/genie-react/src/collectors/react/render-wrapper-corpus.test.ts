// @vitest-environment jsdom
import './hook'
import {
  Component,
  type ComponentType,
  createContext,
  createElement,
  forwardRef,
  memo,
  type ReactNode,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { freezeAnalysisClock } from '../../test-support/analysis-clock'
import { act, mount, startCollector, unmountAll } from '../../test-support/react-app'
import type { RenderCause, RenderCauseEvent } from './render-causes'
import {
  clearRenders,
  disposeRenderTracking,
  getRenderCauseEventsReport,
  getRenderTrackingCoverage,
  startRenderTracking,
} from './render-tracker'

vi.mock('bippy/source', () => ({
  getSource: async () => null,
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
}))

interface Store<State> {
  getState: () => State
  setState: (next: State) => void
  subscribe: (listener: () => void) => () => void
}

function createStore<State>(initial: State): Store<State> {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    getState: () => state,
    setState(next) {
      state = next
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** The shape of react-redux connect(): a memo wrapper that selects child props from a store through useSyncExternalStore. */
function connect<State, Selected extends object>(
  store: Store<State>,
  mapState: ((state: State) => Selected) | null,
) {
  return <Props extends object>(Inner: ComponentType<Props & Selected>) => {
    const neverNotifies = () => () => {}
    function ConnectFunction(ownProps: Props): ReactNode {
      // Like react-redux, the snapshot is the merged child props, recomputed when the store or the wrapper props change.
      const select = useMemo(() => {
        let lastState: State | undefined
        let lastChildProps = { ...ownProps } as Props & Selected
        return () => {
          const state = store.getState()
          if (mapState && state !== lastState) {
            lastState = state
            lastChildProps = { ...ownProps, ...mapState(state) }
          }
          return lastChildProps
        }
      }, [ownProps])
      const childProps = useSyncExternalStore(mapState ? store.subscribe : neverNotifies, select)
      return createElement(Inner, childProps)
    }
    ConnectFunction.displayName = `Connect(${Inner.displayName ?? Inner.name})`
    return memo(ConnectFunction)
  }
}

async function eventFor(name: string): Promise<RenderCauseEvent> {
  const { events } = await getRenderCauseEventsReport({ component: name, limit: 100 })
  const event = events.find((candidate) => candidate.componentName === name)
  if (!event) throw new Error(`${name} did not render`)
  return event
}

function observe(): void {
  clearRenders({ budget: { timeLimitMs: 500, adaptive: false } })
}

const ofKind = <Kind extends RenderCause['kind']>(causes: RenderCause[], kind: Kind) =>
  causes.filter((cause): cause is Extract<RenderCause, { kind: Kind }> => cause.kind === kind)

beforeEach(() => {
  freezeAnalysisClock()
  expect(startRenderTracking()).toBe(true)
})

afterEach(async () => {
  await unmountAll()
  disposeRenderTracking()
})

describe('evidence follows the wrapper relation', () => {
  it('joins a connect wrapper store cause to the exact prop evidence of the class it wraps', async () => {
    interface State {
      byKey: Record<string, { key: string }>
      filter: string
    }
    const projects = { core: { key: 'core' }, web: { key: 'web' } }
    const store = createStore<State>({ byKey: projects, filter: '' })
    class ProjectNav extends Component<{ projects: { key: string }[] }> {
      override render(): ReactNode {
        return createElement(
          'ul',
          null,
          this.props.projects.map((project) =>
            createElement('li', { key: project.key }, project.key),
          ),
        )
      }
    }
    const Connected = connect(store, (state: State) => ({ projects: Object.values(state.byKey) }))(
      ProjectNav,
    )
    await mount(createElement(Connected))
    observe()

    await act(() => store.setState({ ...store.getState(), filter: 'c' }))

    const wrapper = await eventFor('Connect(ProjectNav)')
    const [storeCause] = ofKind(wrapper.causes, 'external-store')
    expect(storeCause).toMatchObject({
      subscriptionFired: true,
      changedFields: ['projects'],
      deepDiff: { changes: [{ kind: 'reference-only', path: '/projects' }], truncated: false },
    })
    expect(wrapper).toMatchObject({
      necessity: 'unnecessary',
      necessityReason: 'inputs-unchanged',
      wraps: {
        componentName: 'ProjectNav',
        necessity: 'unnecessary',
        causes: expect.arrayContaining([
          { kind: 'props', evidence: 'exact', name: 'projects', referenceOnly: true },
        ]),
      },
    })
    expect(await eventFor('ProjectNav')).toMatchObject({
      wrappedBy: {
        componentName: 'Connect(ProjectNav)',
        causes: [expect.objectContaining({ kind: 'external-store' })],
      },
    })
  })

  it('claims no store cause for a wrapper that never subscribes', async () => {
    const store = createStore({ unused: true })
    function TitleEditor({ title }: { title: string }): ReactNode {
      return createElement('input', { value: title, onChange: () => {} })
    }
    const Connected = connect(store, null)(TitleEditor)
    let rename: () => void = () => {}
    function Page(): ReactNode {
      const [title, setTitle] = useState('Draft')
      rename = () => setTitle('Final')
      return createElement(Connected, { title })
    }
    await mount(createElement(Page))
    observe()

    await act(() => rename())

    const wrapper = await eventFor('Connect(TitleEditor)')
    expect(ofKind(wrapper.causes, 'external-store')).toEqual([])
    expect(wrapper.causes).toEqual([
      expect.objectContaining({ kind: 'props', name: 'title', before: 'Draft', after: 'Final' }),
    ])
  })

  it('links the two fibers of memo(forwardRef())', async () => {
    const Field = memo(
      forwardRef<HTMLSpanElement, { label: string }>(function Field({ label }, ref) {
        return createElement('span', { ref }, label)
      }),
    )
    let relabel: () => void = () => {}
    function Form(): ReactNode {
      const [label, setLabel] = useState('a')
      relabel = () => setLabel('b')
      return createElement(Field, { label })
    }
    await mount(createElement(Form))
    observe()

    await act(() => relabel())

    const { events } = await getRenderCauseEventsReport({ component: 'Field', limit: 10 })
    const fieldEvents = events.filter((event) => event.componentName === 'Field')
    expect(fieldEvents).toHaveLength(2)
    expect(fieldEvents.some((event) => event.wraps?.componentName === 'Field')).toBe(true)
    expect(fieldEvents.some((event) => event.wrappedBy?.componentName === 'Field')).toBe(true)
  })
})

describe('external store snapshots', () => {
  it('names the snapshot fields that changed and keeps one store identity across subscribers', async () => {
    const store = createStore({ selected: 0, recent: ['Orders'] })
    function useWorkspace() {
      return useSyncExternalStore(store.subscribe, () => store.getState())
    }
    function SidebarNav(): ReactNode {
      return createElement('nav', null, useWorkspace().recent.join(', '))
    }
    function SelectionBar(): ReactNode {
      return createElement('output', null, useWorkspace().selected)
    }
    await mount(createElement('div', null, createElement(SidebarNav), createElement(SelectionBar)))
    observe()

    await act(() => store.setState({ ...store.getState(), selected: 3 }))

    const [sidebar] = ofKind((await eventFor('SidebarNav')).causes, 'external-store')
    const [bar] = ofKind((await eventFor('SelectionBar')).causes, 'external-store')
    expect(sidebar).toMatchObject({
      subscriptionFired: true,
      changedFields: ['selected'],
      after: { selected: 3 },
      deepDiff: { changes: [{ kind: 'value', path: '/selected', before: 0, after: 3 }] },
    })
    expect(sidebar?.storeId).toBe(bar?.storeId)
    expect(await eventFor('SidebarNav')).toMatchObject({ necessity: 'unnecessary' })
    expect(await eventFor('SelectionBar')).toMatchObject({ necessity: 'necessary' })
  })
})

describe('parent causes name the update that started the cascade', () => {
  it('names the ancestor whose state changed, not the provider between them', async () => {
    const Preferences = createContext('light')
    function SidebarNav({ collapsed }: { collapsed: boolean }): ReactNode {
      useContext(Preferences)
      return createElement('aside', { className: collapsed ? 'narrow' : 'wide' })
    }
    function PreferencesProvider({ children }: { children: ReactNode }): ReactNode {
      return createElement(Preferences.Provider, { value: 'light' }, children)
    }
    let collapse: () => void = () => {}
    function AppShell(): ReactNode {
      const [collapsed, setCollapsed] = useState(false)
      collapse = () => setCollapsed(true)
      return createElement(PreferencesProvider, null, createElement(SidebarNav, { collapsed }))
    }
    await mount(createElement(AppShell))
    observe()

    await act(() => collapse())

    const [parent] = ofKind((await eventFor('SidebarNav')).causes, 'parent')
    expect(parent).toMatchObject({
      parentName: 'PreferencesProvider',
      origin: { componentName: 'AppShell' },
    })
    const [providerParent] = ofKind((await eventFor('PreferencesProvider')).causes, 'parent')
    expect(providerParent).toMatchObject({
      parentName: 'AppShell',
      origin: { componentName: 'AppShell' },
    })
  })
})

describe('render tools share one component selector', () => {
  function Row(): ReactNode {
    return createElement('li', null, 'row')
  }
  function RowHeader(): ReactNode {
    return createElement('li', null, 'header')
  }
  const targeted = async (args: Record<string, unknown>) => {
    const collector = startCollector()
    try {
      const started = await collector.call<{ deprecations?: string[] }>('react_clear_renders', args)
      return { started, components: getRenderTrackingCoverage().targeted?.components }
    } finally {
      collector.stop()
    }
  }

  it('matches component exactly by default, like the read tools', async () => {
    await mount(createElement('ul', null, createElement(Row), createElement(RowHeader)))

    expect(await targeted({ component: 'Row' })).toEqual({
      started: expect.not.objectContaining({ deprecations: expect.anything() }),
      components: ['Row'],
    })
    expect((await targeted({ component: ['Row', 'RowHeader'] })).components).toEqual([
      'Row',
      'RowHeader',
    ])
    expect((await targeted({ component: 'row', exact: false })).components).toEqual(['row'])
  })

  it('still accepts components and says which key replaces it', async () => {
    await mount(createElement(Row))

    const { started, components } = await targeted({ components: ['row'] })

    expect(components).toEqual(['row'])
    expect(started.deprecations).toEqual([expect.stringContaining('pass component')])
  })
})

describe('class state causes', () => {
  it('names the fields of this.state that changed', async () => {
    let editor: TitleEditor | null = null
    class TitleEditor extends Component<object, { draft: string; saving: boolean; title: string }> {
      override state = { draft: '', saving: false, title: 'Fix login' }
      override componentDidMount(): void {
        editor = this
      }
      override render(): ReactNode {
        return createElement('input', { value: this.state.draft, onChange: () => {} })
      }
    }
    await mount(createElement(TitleEditor))
    observe()

    await act(() => editor?.setState({ draft: 'Fix login on Safari', saving: true }))

    const event = await eventFor('TitleEditor')
    expect(event.causes).toEqual([
      expect.objectContaining({ kind: 'state', name: 'this.state.{draft,saving}' }),
    ])
  })
})
