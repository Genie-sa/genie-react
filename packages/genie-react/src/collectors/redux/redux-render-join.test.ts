// @vitest-environment jsdom
import '../react/hook'
import {
  Component,
  createElement,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react'
import { connect, Provider, useDispatch, useSelector } from 'react-redux'
import {
  Provider as Provider9,
  useDispatch as useDispatch9,
  useSelector as useSelector9,
} from 'react-redux-9'
import { combineReducers, createStore, type Store } from 'redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, byText, click, mount, startCollector, unmountAll } from '../../test-support/react-app'
import { reduxStoreTaps, resetReduxStoreRegistryForTests } from '../causal/redux-store-registry'
import type { RenderCause } from '../react/render-causes'
import {
  clearRenders,
  disposeRenderTracking,
  getRenderCauseEventsReport,
  startRenderTracking,
} from '../react/render-tracker'
import { reduxCollector } from './index'
import type { ReduxStoreTap } from './store-tap'

vi.mock('bippy/source', () => ({
  getSource: async () => null,
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
}))

type StoreCause = Extract<RenderCause, { kind: 'external-store' }>

interface Note {
  id: string
}

interface State {
  notes: Note[]
  filter: string
}

type Action = { type: 'notes/added'; id: string } | { type: 'filter/set'; filter: string }

function notes(state: Note[] = [], action: Action): Note[] {
  return action.type === 'notes/added' ? [...state, { id: action.id }] : state
}

function filter(state = 'all', action: Action): string {
  return action.type === 'filter/set' ? action.filter : state
}

function makeStore(): Store<State, Action> {
  return createStore(combineReducers({ notes, filter })) as unknown as Store<State, Action>
}

async function storeCausesOf(component: string): Promise<StoreCause[][]> {
  const { events } = await getRenderCauseEventsReport({ component, limit: 50 })
  return events
    .filter((event) => event.componentName === component)
    .map((event) =>
      event.causes.filter((cause): cause is StoreCause => cause.kind === 'external-store'),
    )
    .filter((causes) => causes.length > 0)
    .reverse()
}

function observe(): void {
  clearRenders({ budget: { timeLimitMs: 500, adaptive: false } })
}

beforeEach(() => {
  expect(startRenderTracking()).toBe(true)
})

afterEach(async () => {
  await unmountAll()
  disposeRenderTracking()
  for (const tap of reduxStoreTaps() as ReduxStoreTap[]) tap.dispose()
  resetReduxStoreRegistryForTests()
})

function NoteCount(): ReactNode {
  const count = useSelector((state: State) => state.notes.length)
  return createElement('output', null, `notes ${count}`)
}

function AddButtons(): ReactNode {
  const dispatch = useDispatch()
  return createElement(
    'div',
    null,
    createElement(
      'button',
      { type: 'button', onClick: () => dispatch({ type: 'notes/added', id: 'n1' }) },
      'add',
    ),
    createElement(
      'button',
      {
        type: 'button',
        onClick: () => {
          dispatch({ type: 'filter/set', filter: 'mine' })
          dispatch({ type: 'notes/added', id: 'n2' })
        },
      },
      'add batched',
    ),
  )
}

// NoteSummary's selector returns a new object on every dispatch, and connect() nests its subscription under ShellView's.
function NoteSummary(): ReactNode {
  const summary = useSelector((state: State) => ({ count: state.notes.length }), {
    stabilityCheck: 'never',
  })
  return createElement('output', null, `summary ${summary.count}`)
}

function Ticker(): ReactNode {
  const [ticks, setTicks] = useState(0)
  return createElement('button', { type: 'button', onClick: () => setTicks(ticks + 1) }, 'tick')
}

function ShellView(): ReactNode {
  return createElement('div', null, createElement(NoteSummary), createElement(Ticker))
}

const Shell = connect((state: State) => ({ filter: state.filter }))(ShellView)

describe('a render names the Redux action that changed its snapshot', () => {
  it('names the clicked action as exact for a useSelector subscriber', async () => {
    const store = makeStore()
    reduxCollector(store)
    const app = await mount(
      createElement(
        Provider,
        { store } as never,
        createElement(NoteCount),
        createElement(AddButtons),
      ),
    )
    observe()

    await click(byText(app.container, 'add'))

    const [causes] = await storeCausesOf('NoteCount')
    expect(causes?.[0]?.redux).toMatchObject({
      link: 'subscription',
      evidence: 'exact',
      reason: 'dispatched-between-renders',
      actions: [{ kind: 'action', type: 'notes/added', changedSlices: ['notes'] }],
      omittedActions: 0,
    })
  })

  it('names every action React batched into one render, oldest first', async () => {
    const store = makeStore()
    reduxCollector(store)
    const app = await mount(
      createElement(
        Provider,
        { store } as never,
        createElement(NoteCount),
        createElement(AddButtons),
      ),
    )
    observe()

    await click(byText(app.container, 'add batched'))

    const [causes] = await storeCausesOf('NoteCount')
    expect(causes?.[0]?.redux?.evidence).toBe('exact')
    expect(causes?.[0]?.redux?.actions.map((action) => action.type)).toEqual([
      'filter/set',
      'notes/added',
    ])
  })

  it('leaves out an action an earlier render of the same component already saw', async () => {
    const store = makeStore()
    reduxCollector(store)
    await mount(createElement(Provider, { store } as never, createElement(NoteCount)))
    observe()

    await act(() => {
      store.dispatch({ type: 'notes/added', id: 'first' })
    })
    await act(() => {
      store.dispatch({ type: 'notes/added', id: 'second' })
    })

    const renders = await storeCausesOf('NoteCount')
    const sequences = renders.map((causes) =>
      causes[0]?.redux?.actions.map((action) => [action.sequence, action.type]),
    )
    expect(sequences).toEqual([[[1, 'notes/added']], [[2, 'notes/added']]])
    expect(renders.every((causes) => causes[0]?.redux?.evidence === 'exact')).toBe(true)
  })

  it('does not credit a render with an action a layout effect dispatched after it rendered', async () => {
    const store = makeStore()
    reduxCollector(store)
    function FilterOnFirstNote(): ReactNode {
      const count = useSelector((state: State) => state.notes.length)
      const dispatch = useDispatch()
      useLayoutEffect(() => {
        if (count === 1) dispatch({ type: 'filter/set', filter: 'first-note' })
      }, [count, dispatch])
      return null
    }
    function FilterLabel(): ReactNode {
      return createElement(
        'span',
        null,
        useSelector((state: State) => state.filter),
      )
    }
    await mount(
      createElement(
        Provider,
        { store } as never,
        createElement(NoteCount),
        createElement(FilterOnFirstNote),
        createElement(FilterLabel),
      ),
    )
    observe()

    await act(() => {
      store.dispatch({ type: 'notes/added', id: 'n1' })
    })

    const [countCauses] = await storeCausesOf('NoteCount')
    const [labelCauses] = await storeCausesOf('FilterLabel')
    expect(countCauses?.[0]?.redux?.actions.map((action) => action.type)).toEqual(['notes/added'])
    expect(countCauses?.[0]?.redux?.evidence).toBe('exact')
    expect(labelCauses?.[0]?.redux?.actions.map((action) => action.type)).toEqual(['filter/set'])
    expect(labelCauses?.[0]?.redux?.evidence).toBe('exact')
  })

  it('refuses exact when a child dispatched while its subscriber parent was still rendering', async () => {
    const store = makeStore()
    reduxCollector(store)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    function SetFilterWhileRendering({ count }: { count: number }): ReactNode {
      const dispatch = useDispatch()
      if (count === 1 && store.getState().filter === 'all') {
        dispatch({ type: 'filter/set', filter: 'during-render' })
      }
      return null
    }
    function Board(): ReactNode {
      const count = useSelector((state: State) => state.notes.length)
      return createElement(SetFilterWhileRendering, { count })
    }
    await mount(createElement(Provider, { store } as never, createElement(Board)))
    observe()

    await act(() => {
      store.dispatch({ type: 'notes/added', id: 'n1' })
    })
    consoleError.mockRestore()

    const renders = await storeCausesOf('Board')
    const first = renders[0]?.[0]?.redux
    expect(first?.actions.map((action) => action.type)).toContain('notes/added')
    expect(first?.evidence).toBe('inferred')
    expect(first?.reason).toBe('ordering-ambiguous')
  })

  it('grades a connect() class subscriber through its wrapper', async () => {
    const store = makeStore()
    reduxCollector(store)
    class NotesPanel extends Component<{ count: number }> {
      override render(): ReactNode {
        return createElement('p', null, `panel ${this.props.count}`)
      }
    }
    const ConnectedPanel = connect((state: State) => ({ count: state.notes.length }))(NotesPanel)
    await mount(createElement(Provider, { store } as never, createElement(ConnectedPanel)))
    observe()

    await act(() => {
      store.dispatch({ type: 'notes/added', id: 'n1' })
    })

    const [causes] = await storeCausesOf('Connect(NotesPanel)')
    expect(causes?.[0]?.redux).toMatchObject({
      link: 'connect',
      evidence: 'exact',
      actions: [{ type: 'notes/added' }],
    })
  })

  it('never grades a nested connect() child exact when its parent relayed the change late', async () => {
    type BoardAction = { type: 'board/reset' } | { type: 'board/seen' }
    const store = createStore(
      combineReducers({
        count: (state: number = 0, action: BoardAction) =>
          action.type === 'board/reset' ? state + 1 : state,
        title: (state: string = 'a', action: BoardAction) =>
          action.type === 'board/reset' ? `${state}+` : state,
        seen: (state: number = 0, action: BoardAction) =>
          action.type === 'board/seen' ? state + 1 : state,
      }),
    )
    reduxCollector(store)
    class CountView extends Component<{ count: number }> {
      override render(): ReactNode {
        return createElement('p', null, `count ${this.props.count}`)
      }
    }
    const Count = connect((state: { count: number }) => ({ count: state.count }))(CountView)
    function TitleView({ title }: { title: string }): ReactNode {
      const dispatch = useDispatch()
      useEffect(() => {
        if (title !== 'a') dispatch({ type: 'board/seen' })
      }, [title, dispatch])
      return createElement('section', null, title, createElement(Count))
    }
    const Title = connect((state: { title: string }) => ({ title: state.title }))(TitleView)
    await mount(createElement(Provider, { store } as never, createElement(Title)))
    observe()

    await act(() => {
      store.dispatch({ type: 'board/reset' })
    })

    const [causes] = await storeCausesOf('Connect(CountView)')
    expect(causes?.[0]?.redux?.actions.map((action) => action.type)).toContain('board/reset')
    expect(causes?.[0]?.redux).toMatchObject({
      link: 'connect',
      evidence: 'inferred',
      reason: 'previous-render-unavailable',
    })
  })

  it('bounds the first render in a window by the window start once React was idle', async () => {
    const store = makeStore()
    reduxCollector(store)
    const app = await mount(createElement(Provider, { store } as never, createElement(Shell)))
    await act(() => {
      store.dispatch({ type: 'notes/added', id: 'before-window' })
    })
    // The sibling update clones NoteSummary without rendering it, so its alternate holds no render.
    await click(byText(app.container, 'tick'))
    observe()

    await act(() => {
      store.dispatch({ type: 'notes/added', id: 'in-window' })
    })

    const [causes] = await storeCausesOf('NoteSummary')
    expect(causes?.[0]?.redux).toMatchObject({
      evidence: 'exact',
      reason: 'dispatched-between-renders',
      actions: [{ sequence: 2, type: 'notes/added' }],
    })
  })

  it('keeps the first render inferred when the window opened before React rendered an earlier dispatch', async () => {
    const store = makeStore()
    reduxCollector(store)
    const app = await mount(createElement(Provider, { store } as never, createElement(Shell)))
    await click(byText(app.container, 'tick'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    store.dispatch({ type: 'notes/added', id: 'still-rendering' })
    observe()
    await act(async () => {})
    consoleError.mockRestore()

    const [causes] = await storeCausesOf('NoteSummary')
    expect(causes?.[0]?.redux).toMatchObject({
      evidence: 'inferred',
      reason: 'previous-render-unavailable',
    })
  })

  it('never lists an action from before the window as a candidate', async () => {
    const store = makeStore()
    reduxCollector(store)
    const app = await mount(createElement(Provider, { store } as never, createElement(Shell)))
    await act(() => {
      store.dispatch({ type: 'notes/added', id: 'before-window' })
    })
    observe()

    await click(byText(app.container, 'tick'))
    await act(() => {
      store.dispatch({ type: 'notes/added', id: 'in-window' })
    })

    const [causes] = await storeCausesOf('NoteSummary')
    expect(causes?.[0]?.redux?.reason).toBe('previous-render-unavailable')
    expect(causes?.[0]?.redux?.actions.map((action) => action.sequence)).toEqual([2])
  })

  it('names the action for react-redux 9 hooks', async () => {
    const store = makeStore()
    reduxCollector(store)
    function Count9(): ReactNode {
      const count = useSelector9((state: State) => state.notes.length)
      const dispatch = useDispatch9()
      return createElement(
        'button',
        { type: 'button', onClick: () => dispatch({ type: 'notes/added', id: 'n9' }) },
        `count9 ${count}`,
      )
    }
    const app = await mount(createElement(Provider9, { store } as never, createElement(Count9)))
    observe()

    await click(byText(app.container, 'count9 0'))

    const [causes] = await storeCausesOf('Count9')
    expect(causes?.[0]?.redux).toMatchObject({
      link: 'subscription',
      evidence: 'exact',
      actions: [{ type: 'notes/added' }],
    })
  })

  it('only infers the action when recording began after the previous render', async () => {
    const store = makeStore()
    await mount(createElement(Provider, { store } as never, createElement(NoteCount)))
    reduxCollector(store)
    observe()

    await act(() => {
      store.dispatch({ type: 'notes/added', id: 'n1' })
    })

    const [causes] = await storeCausesOf('NoteCount')
    expect(causes?.[0]?.redux).toMatchObject({
      evidence: 'inferred',
      reason: 'recording-started-after-previous-render',
      actions: [{ type: 'notes/added' }],
    })
  })

  it('marks a change Genie saw without its action as unrecorded, never exact', async () => {
    const store = makeStore()
    const unwrapped = store.dispatch
    reduxCollector(store)
    await mount(createElement(Provider, { store } as never, createElement(NoteCount)))
    observe()

    await act(() => {
      unwrapped({ type: 'notes/added', id: 'held-before-genie' })
    })

    const [causes] = await storeCausesOf('NoteCount')
    expect(causes?.[0]?.redux).toMatchObject({
      evidence: 'inferred',
      reason: 'unrecorded-state-change',
      actions: [{ kind: 'unrecorded-change', type: null }],
    })
  })

  it("keeps every scoped column's store cause an unscoped window finds", async () => {
    const columns = ['backlog', 'todo', 'doing', 'review', 'done', 'archived']
    const store = makeStore()
    reduxCollector(store)
    for (let index = 0; index < 200; index += 1) {
      store.dispatch({ type: 'notes/added', id: `seed-${index}` })
    }
    function Column({ status }: { status: string }): ReactNode {
      const cards = useSelector(
        (state: State) => state.notes.map((note) => ({ ...note, status })),
        { stabilityCheck: 'never' },
      )
      return createElement('ol', null, cards.length)
    }
    await mount(
      createElement(
        Provider,
        { store } as never,
        columns.map((status) => createElement(Column, { key: status, status })),
      ),
    )
    const storeCauseKinds = async (): Promise<string[]> => {
      const { events } = await getRenderCauseEventsReport({ component: 'Column', limit: 50 })
      return events.map((event) => event.causes.map((cause) => cause.kind).join(','))
    }

    observe()
    await act(() => {
      store.dispatch({ type: 'notes/added', id: 'unscoped' })
    })
    const unscoped = await storeCauseKinds()

    clearRenders({
      components: ['Column'],
      budget: { timeLimitMs: 500, targetTimeReserveMs: 500, adaptive: false },
    })
    await act(() => {
      store.dispatch({ type: 'notes/added', id: 'scoped' })
    })

    expect(unscoped).toEqual(columns.map(() => 'external-store'))
    expect(await storeCauseKinds()).toEqual(unscoped)
  })

  it('summarizes the action types on the compact cause', async () => {
    const store = makeStore()
    reduxCollector(store)
    const app = await mount(
      createElement(
        Provider,
        { store } as never,
        createElement(NoteCount),
        createElement(AddButtons),
      ),
    )
    observe()

    await click(byText(app.container, 'add'))

    const genie = startCollector()
    const { events } = await genie.call<{ events: { causes: Array<Record<string, unknown>> }[] }>(
      'react_render_causes',
      { component: 'NoteCount', limit: 5 },
    )
    genie.stop()
    const compact = events.flatMap((event) => event.causes)
    expect(compact.find((cause) => cause.kind === 'external-store')?.redux).toEqual({
      evidence: 'exact',
      actions: ['notes/added'],
    })
  })
})
