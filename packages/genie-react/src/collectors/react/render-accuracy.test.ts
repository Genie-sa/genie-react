// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { act, render } from '@testing-library/react'
import {
  Component,
  createContext,
  createElement,
  Fragment,
  memo,
  type ReactNode,
  StrictMode,
  Suspense,
  startTransition,
  use,
  useActionState,
  useContext,
  useDeferredValue,
  useLayoutEffect,
  useReducer,
  useState,
  useSyncExternalStore,
  useTransition,
  version,
} from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectorContext } from '../../client'
import { reactCollector } from './collector'
import { openMeasurementSpan, readMeasurementSpan } from './measurement-spans'
import { reactGetRendersContract } from './render-contract'
import {
  clearRenders,
  disposeRenderTracking,
  getRenderCauseEventsReport,
  getRenders,
  getRenderTrackingCoverage,
  type RenderCause,
  type RenderObservationOptions,
  type RenderReport,
  rendersDiff,
  startRenderTracking,
  takeSnapshot,
} from './render-tracker'

vi.mock('bippy/source', () => ({
  getSource: async () => null,
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
}))

const REACT_19 = Number.parseInt(version, 10) >= 19

/** Ground truth independent of Genie: a dependency-free layout effect runs once per committed render. */
const committedRenders = new Map<string, number>()
function useCommittedRenderOracle(name: string): void {
  useLayoutEffect(() => {
    committedRenders.set(name, (committedRenders.get(name) ?? 0) + 1)
  })
}

let unmountView: (() => void) | null = null

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  expect(startRenderTracking()).toBe(true)
})

afterEach(() => {
  unmountView?.()
  unmountView = null
  disposeRenderTracking()
  vi.restoreAllMocks()
})

function mount(element: ReactNode): void {
  const view = render(element)
  unmountView = view.unmount
}

/** A cold run can exceed the default 8ms commit budget, which would truncate the counts under test. */
function observe(options: RenderObservationOptions = {}): void {
  clearRenders({ budget: { timeLimitMs: 500, adaptive: false }, ...options })
  committedRenders.clear()
}

async function reportFor(name: string): Promise<RenderReport | undefined> {
  const reports = await getRenders({ component: name, sort: 'renders', limit: 100 })
  return reports.find((report) => report.name === name)
}

async function eventsFor(name: string) {
  const { events } = await getRenderCauseEventsReport({ component: name, limit: 100 })
  return events.filter((event) => event.componentName === name).reverse()
}

const kinds = (causes: RenderCause[]) => causes.map((cause) => cause.kind)

const collectorContext: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}

async function callGetRenders(args: Record<string, unknown>) {
  const tool = reactCollector().tools?.find((entry) => entry.contract.name === 'react_get_renders')
  if (!tool) throw new Error('react_get_renders is not registered')
  return reactGetRendersContract.output.parse(
    await tool.handler(
      reactGetRendersContract.input.parse({ appOnly: false, ...args }) as never,
      collectorContext,
    ),
  )
}

describe('render counts match committed renders', () => {
  it('counts each commit of a StrictMode component once, not each invocation', async () => {
    let invocations = 0
    let setCount: (count: number) => void = () => {}
    function Strict(): ReactNode {
      const [count, set] = useState(0)
      setCount = set
      invocations += 1
      return createElement('p', null, count)
    }
    observe()
    mount(createElement(StrictMode, null, createElement(Strict)))
    await act(async () => setCount(1))

    expect(invocations).toBe(4)
    expect(await reportFor('Strict')).toMatchObject({ renders: 2, mounts: 1, updates: 1 })
  })

  it('does not count a render React bailed out of after an update settled on the same state', async () => {
    let invocations = 0
    let setValue: (value: number) => void = () => {}
    function Settles(): ReactNode {
      const [value, set] = useState(0)
      setValue = set
      invocations += 1
      useCommittedRenderOracle('Settles')
      return createElement('p', null, value)
    }
    mount(createElement(Settles))
    observe()
    const invocationsBefore = invocations

    await act(async () => {
      setValue(1)
      setValue(0)
    })

    expect(invocations - invocationsBefore).toBe(1)
    expect(committedRenders.get('Settles')).toBeUndefined()
    expect(await reportFor('Settles')).toBeUndefined()
  })

  it('reports no renders for memo rows a keyed reorder only moved', async () => {
    let setOrder: (order: string[]) => void = () => {}
    const Row = memo(function Row({ id }: { id: string }): ReactNode {
      useCommittedRenderOracle('Row')
      return createElement('li', null, id)
    })
    function List(): ReactNode {
      const [order, set] = useState(['a', 'b', 'c'])
      setOrder = set
      return createElement(
        'ul',
        null,
        order.map((id) => createElement(Row, { key: id, id })),
      )
    }
    mount(createElement(List))
    observe()

    await act(async () => setOrder(['c', 'a', 'b']))

    expect(committedRenders.get('Row')).toBeUndefined()
    expect(await reportFor('Row')).toBeUndefined()
    expect(await reportFor('List')).toMatchObject({ renders: 1 })
  })

  it('reports a key change as a fresh mount, never as an update of the old instance', async () => {
    let setKey: (key: string) => void = () => {}
    function Keyed(): ReactNode {
      useCommittedRenderOracle('Keyed')
      return null
    }
    function Owner(): ReactNode {
      const [key, set] = useState('first')
      setKey = set
      return createElement(Keyed, { key })
    }
    mount(createElement(Owner))
    observe()

    await act(async () => setKey('second'))

    expect(committedRenders.get('Keyed')).toBe(1)
    const reports = (await getRenders({ component: 'Keyed', sort: 'renders', limit: 10 })).filter(
      (report) => report.name === 'Keyed',
    )
    expect(reports).toEqual([expect.objectContaining({ renders: 1, mounts: 1, updates: 0 })])
    expect(reports[0]?.instance.key).toBe('second')
  })

  it('counts a component mounted after its Suspense boundary retried once', async () => {
    let release: () => void = () => {}
    let pending: Promise<void> | null = new Promise<void>((resolve) => {
      release = () => {
        pending = null
        resolve()
      }
    })
    function Lazy(): ReactNode {
      if (pending) throw pending
      useCommittedRenderOracle('Lazy')
      return createElement('span', null, 'ready')
    }
    observe()
    mount(
      createElement(
        Suspense,
        { fallback: createElement('em', null, 'loading') },
        createElement(Lazy),
      ),
    )

    await act(async () => {
      const suspended = pending
      release()
      await suspended
    })

    expect(committedRenders.get('Lazy')).toBe(1)
    expect(await reportFor('Lazy')).toMatchObject({ renders: 1, mounts: 1, updates: 0 })
  })

  it('keeps the renders of a component that unmounted inside the window', async () => {
    let setOpen: (open: boolean) => void = () => {}
    let bump: () => void = () => {}
    function Modal(): ReactNode {
      const [count, setCount] = useState(0)
      bump = () => setCount((value) => value + 1)
      useCommittedRenderOracle('Modal')
      return createElement('dialog', null, count)
    }
    function Page(): ReactNode {
      const [open, set] = useState(false)
      setOpen = set
      return open ? createElement(Modal) : null
    }
    mount(createElement(Page))
    observe()

    await act(async () => setOpen(true))
    await act(async () => bump())
    await act(async () => bump())
    await act(async () => setOpen(false))

    expect(committedRenders.get('Modal')).toBe(3)
    expect(await reportFor('Modal')).toMatchObject({
      renders: 3,
      mounts: 1,
      updates: 2,
      unmounted: true,
    })
    const report = await callGetRenders({ component: 'Modal' })
    if (report.view !== 'summary') throw new Error('expected the default summary view')
    expect(report.summary).toMatchObject({ totalRenders: 3, semantics: 'exact' })
    expect(report.components).toEqual([
      expect.objectContaining({ name: 'Modal', renders: 3, unmounted: true }),
    ])
  })

  it('keeps an unmounted component in a measurement span and marks it unmounted there', async () => {
    let setOpen: (open: boolean) => void = () => {}
    function Panel(): ReactNode {
      useCommittedRenderOracle('Panel')
      return null
    }
    function Host(): ReactNode {
      const [open, set] = useState(false)
      setOpen = set
      return open ? createElement(Panel) : null
    }
    mount(createElement(Host))
    observe()
    const { handle } = openMeasurementSpan('panel')

    await act(async () => setOpen(true))
    await act(async () => setOpen(false))

    const span = await readMeasurementSpan(handle, true, { sort: 'renders', limit: 10 })
    expect(span.components.find((component) => component.name === 'Panel')).toMatchObject({
      renders: 1,
      unmounted: true,
    })
  })

  it('does not list a component that unmounted after the baseline as removed from a render diff', async () => {
    let setOpen: (open: boolean) => void = () => {}
    function Drawer(): ReactNode {
      return null
    }
    function Layout(): ReactNode {
      const [open, set] = useState(false)
      setOpen = set
      return open ? createElement(Drawer) : null
    }
    mount(createElement(Layout))
    observe()
    await act(async () => setOpen(true))
    await takeSnapshot('drawer-open', false)

    await act(async () => setOpen(false))

    const diff = await rendersDiff('drawer-open', 0, false)
    expect(diff.removed).toEqual([])
    expect(diff.improved.map((entry) => entry.name)).not.toContain('Drawer')
  })

  it('reports counts as a lower bound once unmounted records exceed the lifecycle buffer', async () => {
    const bufferLimit = 100
    let setShown: (shown: number) => void = () => {}
    function Item(): ReactNode {
      return null
    }
    function Items(): ReactNode {
      const [shown, set] = useState(0)
      setShown = set
      return createElement(
        Fragment,
        null,
        Array.from({ length: shown }, (_, index) => createElement(Item, { key: index })),
      )
    }
    mount(createElement(Items))
    observe({
      budget: { fiberLimit: 1_000, timeLimitMs: 500, adaptive: false },
      lifecycle: { bufferLimit, targetReserve: 0 },
    })

    await act(async () => setShown(bufferLimit + 1))
    await act(async () => setShown(1))
    expect(getRenderTrackingCoverage('measurement').complete).toBe(true)
    await act(async () => setShown(0))

    const items = (await getRenders({ component: 'Item', sort: 'renders', limit: 200 })).filter(
      (report) => report.name === 'Item',
    )
    expect(items).toHaveLength(bufferLimit)
    expect(items.every((item) => item.unmounted)).toBe(true)
    const coverage = getRenderTrackingCoverage('measurement')
    expect(coverage).toMatchObject({ complete: false, semantics: 'lower-bound' })
    expect(coverage.droppedUnmountFibers).toBe(1)
  })

  it('excludes renders committed before react_clear_renders', async () => {
    let setCount: (count: number) => void = () => {}
    function Counter(): ReactNode {
      const [count, set] = useState(0)
      setCount = set
      return createElement('output', null, count)
    }
    mount(createElement(Counter))
    await act(async () => setCount(1))
    await act(async () => setCount(2))
    observe()
    const observationId = (await callGetRenders({})).observation?.id

    await act(async () => setCount(3))

    expect(await reportFor('Counter')).toMatchObject({ renders: 1, updates: 1 })
    const events = await eventsFor('Counter')
    expect(events).toHaveLength(1)
    expect(events[0]?.observationId).toBe(observationId)
  })
})

describe('render causes match the update that triggered them', () => {
  it('attributes a plain child to its rendering parent without claiming a changed input', async () => {
    let setCount: (count: number) => void = () => {}
    function Child(): ReactNode {
      useCommittedRenderOracle('Child')
      return null
    }
    function Parent(): ReactNode {
      const [count, set] = useState(0)
      setCount = set
      return createElement('div', { 'data-count': count }, createElement(Child))
    }
    mount(createElement(Parent))
    observe()

    await act(async () => setCount(1))

    expect(committedRenders.get('Child')).toBe(1)
    const child = await reportFor('Child')
    expect(child?.causes).toEqual([
      expect.objectContaining({ kind: 'parent', parentName: 'Parent' }),
    ])
    expect(child).toMatchObject({ necessity: 'unknown', noObservedInputChange: 1 })
  })

  it('attributes a memo consumer to the Context that crossed its memo boundary', async () => {
    const Theme = createContext('light')
    let setTheme: (theme: string) => void = () => {}
    const Consumer = memo(function Consumer(): ReactNode {
      const theme = useContext(Theme)
      useCommittedRenderOracle('Consumer')
      return createElement('span', null, theme)
    })
    const Bystander = memo(function Bystander(): ReactNode {
      useCommittedRenderOracle('Bystander')
      return null
    })
    function Provider(): ReactNode {
      const [theme, set] = useState('light')
      setTheme = set
      return createElement(
        Theme.Provider,
        { value: theme },
        createElement(Consumer),
        createElement(Bystander),
      )
    }
    mount(createElement(Provider))
    observe()

    await act(async () => setTheme('dark'))

    expect(committedRenders.get('Consumer')).toBe(1)
    expect(committedRenders.get('Bystander')).toBeUndefined()
    expect(await reportFor('Bystander')).toBeUndefined()
    const consumer = await reportFor('Consumer')
    expect(consumer?.causes).toEqual([
      expect.objectContaining({
        kind: 'context',
        evidence: 'exact',
        before: 'light',
        after: 'dark',
      }),
    ])
    expect(consumer?.necessity).toBe('necessary')
  })

  it('grades a Context value replaced by an equal object as avoidable', async () => {
    const Settings = createContext({ mode: 'dark' })
    let rerender: () => void = () => {}
    const Reader = memo(function Reader(): ReactNode {
      const settings = useContext(Settings)
      return createElement('span', null, settings.mode)
    })
    function Root(): ReactNode {
      const [tick, setTick] = useState(0)
      rerender = () => setTick(tick + 1)
      return createElement(Settings.Provider, { value: { mode: 'dark' } }, createElement(Reader))
    }
    mount(createElement(Root))
    observe()

    await act(async () => rerender())

    expect(await reportFor('Reader')).toMatchObject({
      necessity: 'unnecessary',
      noObservedInputChange: 1,
      causes: [{ kind: 'context', deepDiff: { changes: [{ kind: 'reference-only', path: '' }] } }],
    })
  })

  it('names a reducer dispatch as reducer state on its hook', async () => {
    let dispatch: () => void = () => {}
    function Tally(): ReactNode {
      const [count, increment] = useReducer((value: number) => value + 1, 0)
      dispatch = increment
      return createElement('output', null, count)
    }
    mount(createElement(Tally))
    observe()

    await act(async () => dispatch())

    expect((await reportFor('Tally'))?.causes).toEqual([
      expect.objectContaining({
        kind: 'state',
        evidence: 'exact',
        before: 0,
        after: 1,
        hook: { index: 0, stateIndex: 0, kind: 'reducer' },
      }),
    ])
  })

  it('attributes a useSyncExternalStore update to the store snapshot', async () => {
    const listeners = new Set<() => void>()
    let snapshot = 0
    const subscribe = (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
    function StoreReader(): ReactNode {
      const value = useSyncExternalStore(subscribe, () => snapshot)
      useCommittedRenderOracle('StoreReader')
      return createElement('output', null, value)
    }
    mount(createElement(StoreReader))
    observe()

    await act(async () => {
      snapshot = 1
      for (const listener of listeners) listener()
    })

    expect(committedRenders.get('StoreReader')).toBe(1)
    expect(await reportFor('StoreReader')).toMatchObject({
      necessity: 'necessary',
      causes: [{ kind: 'external-store', before: 0, after: 1 }],
    })
  })

  it('does not grade the deferred pass of useDeferredValue as unnecessary', async () => {
    let setText: (text: string) => void = () => {}
    const Results = memo(function Results({ query }: { query: string }): ReactNode {
      const deferred = useDeferredValue(query)
      useCommittedRenderOracle('Results')
      return createElement('span', null, deferred)
    })
    function Search(): ReactNode {
      const [text, set] = useState('a')
      setText = set
      return createElement(Results, { query: text })
    }
    mount(createElement(Search))
    observe()

    await act(async () => setText('b'))

    expect(committedRenders.get('Results')).toBe(2)
    const [urgent, deferred] = await eventsFor('Results')
    expect(kinds(urgent?.causes ?? [])).toEqual(['props'])
    expect(deferred).toMatchObject({
      necessity: 'unknown',
      causes: [{ kind: 'unknown', reason: 'unclassified-hook-changed', hookIndex: 0 }],
      assessment: { inputEvidence: 'changed' },
    })
    expect(await reportFor('Results')).toMatchObject({ renders: 2, noObservedInputChange: 0 })
  })

  it.skipIf(!REACT_19)(
    'attributes the pending render of useTransition to its isPending state',
    async () => {
      let start: () => void = () => {}
      function Tabs(): ReactNode {
        const [isPending, startTabTransition] = useTransition()
        const [tab, setTab] = useState(0)
        start = () => startTabTransition(() => setTab((value) => value + 1))
        useCommittedRenderOracle('Tabs')
        return createElement('output', null, `${isPending}:${tab}`)
      }
      mount(createElement(Tabs))
      observe()

      await act(async () => start())

      expect(committedRenders.get('Tabs')).toBe(2)
      const [pending, settled] = await eventsFor('Tabs')
      expect(pending?.causes).toEqual([
        expect.objectContaining({
          kind: 'state',
          before: false,
          after: true,
          hook: { index: 0, stateIndex: 0, kind: 'state' },
        }),
      ])
      expect(pending?.necessity).toBe('necessary')
      expect(kinds(settled?.causes ?? [])).toEqual(['state', 'state'])
      expect(await reportFor('Tabs')).toMatchObject({ noObservedInputChange: 0 })
    },
  )

  it.skipIf(!REACT_19)(
    'attributes the pending render of useActionState to its pending state',
    async () => {
      let submit: () => void = () => {}
      let finish: () => void = () => {}
      function Form(): ReactNode {
        const [saved, dispatch, isPending] = useActionState(async (previous: number) => {
          await new Promise<void>((resolve) => {
            finish = resolve
          })
          return previous + 1
        }, 0)
        submit = () => startTransition(() => dispatch())
        useCommittedRenderOracle('Form')
        return createElement('output', null, `${saved}:${isPending}`)
      }
      mount(createElement(Form))
      observe()

      await act(async () => submit())
      await act(async () => finish())

      expect(committedRenders.get('Form')).toBe(2)
      const events = await eventsFor('Form')
      expect(events).toHaveLength(2)
      for (const event of events) {
        expect(event.necessity).toBe('necessary')
        expect(kinds(event.causes)).not.toContain('unknown')
      }
      expect(await reportFor('Form')).toMatchObject({ noObservedInputChange: 0 })
    },
  )

  it('does not grade a class forceUpdate as unnecessary', async () => {
    let instance: Ticker | null = null
    class Ticker extends Component {
      override componentDidMount(): void {
        instance = this
      }
      override render(): ReactNode {
        return createElement('time', null, Date.now())
      }
    }
    mount(createElement(Ticker))
    observe()

    await act(async () => instance?.forceUpdate())

    expect(await reportFor('Ticker')).toMatchObject({
      renders: 1,
      necessity: 'unknown',
      noObservedInputChange: 0,
      causes: [{ kind: 'unknown', reason: 'no-observable-fiber-input-change' }],
    })
  })

  it.skipIf(!REACT_19)(
    'pairs Context reads by identity after a conditional use() reorders them',
    async () => {
      const Locale = createContext('en')
      const Currency = createContext('usd')
      let setLocale: (locale: string) => void = () => {}
      const Price = memo(function Price({ localeFirst }: { localeFirst: boolean }): ReactNode {
        const first = localeFirst ? use(Locale) : use(Currency)
        const second = localeFirst ? use(Currency) : use(Locale)
        return createElement('span', null, `${first}:${second}`)
      })
      function Shop(): ReactNode {
        const [locale, set] = useState('en')
        setLocale = set
        return createElement(
          Locale.Provider,
          { value: locale },
          createElement(
            Currency.Provider,
            { value: 'usd' },
            createElement(Price, { localeFirst: locale !== 'en' }),
          ),
        )
      }
      mount(createElement(Shop))
      observe()

      await act(async () => setLocale('fr'))

      const price = await reportFor('Price')
      expect(price?.causes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'props', name: 'localeFirst' }),
          expect.objectContaining({ kind: 'context', before: 'en', after: 'fr', contextIndex: 0 }),
        ]),
      )
      expect(price?.inputCoverage.complete).toBe(true)
      expect(price?.assessment.inputEvidence).toBe('changed')
    },
  )

  it('leaves input coverage incomplete when a render stops reading a Context', async () => {
    const Flag = createContext('off')
    let update: () => void = () => {}
    function Reader({ reads }: { reads: boolean }): ReactNode {
      // biome-ignore lint/correctness/useHookAtTopLevel: a Context read takes no hook slot, and this render must skip one; React 18 has no use().
      return createElement('span', null, reads ? useContext(Flag) : 'unread')
    }
    function Root(): ReactNode {
      const [flag, setFlag] = useState('off')
      const [reads, setReads] = useState(true)
      update = () => {
        setFlag('on')
        setReads(false)
      }
      return createElement(Flag.Provider, { value: flag }, createElement(Reader, { reads }))
    }
    mount(createElement(Root))
    observe()

    await act(async () => update())

    const reader = await reportFor('Reader')
    expect(reader?.inputCoverage).toMatchObject({ complete: false, scanTruncated: true })
    expect(reader?.necessity).toBe('unknown')
    expect(reader?.noObservedInputChange).toBe(0)
  })

  it('attributes a targeted child to its parent when the budget skipped that parent', async () => {
    let setCount: (count: number) => void = () => {}
    function Filler(_: { count: number }): ReactNode {
      return null
    }
    function Target(): ReactNode {
      return null
    }
    function Middle(_: { count: number }): ReactNode {
      return createElement(Target)
    }
    function Page(): ReactNode {
      const [count, set] = useState(0)
      setCount = set
      return createElement(
        Fragment,
        null,
        Array.from({ length: 1_200 }, (_, index) => createElement(Filler, { key: index, count })),
        createElement(Middle, { count }),
      )
    }
    mount(createElement(Page))
    clearRenders({
      components: ['Target'],
      budget: {
        operationLimit: 1_000,
        timeLimitMs: 500,
        targetTimeReserveMs: 250,
        adaptive: false,
      },
    })

    await act(async () => setCount(1))

    expect(getRenderTrackingCoverage('measurement').skippedCommitFibers).toBeGreaterThan(0)
    expect(await reportFor('Middle')).toBeUndefined()
    expect(await reportFor('Target')).toMatchObject({
      necessity: 'unknown',
      causes: [{ kind: 'parent', parentName: 'Middle' }],
    })
  })

  it('reports an unmounted store reader as unmounted rather than resolving its hooks', async () => {
    const listeners = new Set<() => void>()
    let snapshot = 0
    const subscribe = (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
    let setShown: (shown: boolean) => void = () => {}
    function Ticker(): ReactNode {
      return createElement(
        'output',
        null,
        useSyncExternalStore(subscribe, () => snapshot),
      )
    }
    function Shell(): ReactNode {
      const [shown, set] = useState(true)
      setShown = set
      return shown ? createElement(Ticker) : null
    }
    mount(createElement(Shell))
    observe()

    await act(async () => {
      snapshot = 1
      for (const listener of listeners) listener()
    })
    await act(async () => setShown(false))

    const [cause] = (await reportFor('Ticker'))?.causes ?? []
    expect(cause).toMatchObject({
      kind: 'external-store',
      hookProvenance: { status: 'unavailable', reason: 'component-unmounted' },
    })
  })
})
