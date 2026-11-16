// @vitest-environment jsdom
import './hook'
import {
  createContext,
  createElement,
  memo,
  type ReactNode,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { freezeAnalysisClock } from '../../test-support/analysis-clock'
import { act, type MountedApp, mount, unmountAll } from '../../test-support/react-app'
import type { RenderCauseEvent } from './render-causes'
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

/** Ground truth independent of Genie: every DOM change the commit made under the observed nodes. */
function observeDom(...targets: Node[]): () => MutationRecord[] {
  const records: MutationRecord[] = []
  const observer = new MutationObserver((delivered) => records.push(...delivered))
  for (const target of targets) {
    observer.observe(target, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    })
  }
  return () => {
    records.push(...observer.takeRecords())
    observer.disconnect()
    return records
  }
}

async function latestEvent(name: string): Promise<RenderCauseEvent> {
  const { events } = await getRenderCauseEventsReport({ component: name, limit: 100 })
  const event = events.find((candidate) => candidate.componentName === name)
  if (!event) throw new Error(`${name} did not render`)
  return event
}

async function interact(app: MountedApp, action: () => void, ...extra: Node[]) {
  clearRenders({ budget: { timeLimitMs: 500, adaptive: false } })
  const stop = observeDom(app.container, ...extra)
  await act(action)
  return stop()
}

beforeEach(() => {
  freezeAnalysisClock()
  expect(startRenderTracking()).toBe(true)
})

afterEach(async () => {
  await unmountAll()
  disposeRenderTracking()
})

describe('necessity agrees with the DOM the commit changed', () => {
  it('does not call a render necessary when it only replaced event handlers', async () => {
    let bump: () => void = () => {}
    function Button({ onPress }: { onPress: () => void }): ReactNode {
      return createElement('button', { type: 'button', onClick: onPress }, 'Save')
    }
    function Form(): ReactNode {
      const [draft, setDraft] = useState(0)
      bump = () => setDraft((value) => value + 1)
      return createElement('form', null, createElement(Button, { onPress: () => draft }))
    }
    const app = await mount(createElement(Form))

    const records = await interact(app, () => bump())

    expect(records).toHaveLength(0)
    expect(await latestEvent('Button')).toMatchObject({
      necessity: 'unknown',
      necessityReason: 'callbacks-changed',
      assessment: {
        behaviorEvidence: {
          subtreeHostMutations: {
            status: 'none-observed',
            count: 0,
            callbackOnlyUpdates: 1,
            callbacks: ['button.onClick'],
          },
        },
      },
    })
    expect((await latestEvent('Form')).necessity).not.toBe('necessary')
  })

  it('calls a render with equal host props unnecessary even though React flagged every host', async () => {
    let bump: () => void = () => {}
    function Card(): ReactNode {
      const [, setTick] = useState(0)
      bump = () => setTick((value) => value + 1)
      return createElement(
        'section',
        { className: 'card', style: { color: 'red', padding: 4 } },
        createElement('h2', { id: 'title' }, 'Revenue'),
        // biome-ignore lint/security/noDangerouslySetInnerHtml: a constant fixture checks that equal markup is not a write
        createElement('div', { dangerouslySetInnerHTML: { __html: '<b>1</b>' } }),
      )
    }
    const app = await mount(createElement(Card))

    const records = await interact(app, () => bump())

    expect(records).toHaveLength(0)
    expect(await latestEvent('Card')).toMatchObject({
      necessity: 'unnecessary',
      necessityReason: 'output-unchanged',
      assessment: { behaviorEvidence: { subtreeHostMutations: { count: 0, writes: [] } } },
    })
  })

  it('names the attribute, text and style writes that made a render necessary', async () => {
    let bump: () => void = () => {}
    function Badge(): ReactNode {
      const [count, setCount] = useState(1)
      bump = () => setCount((value) => value + 1)
      return createElement(
        'p',
        { className: count % 2 ? 'odd' : 'even', style: { width: count } },
        'Count: ',
        count,
      )
    }
    const app = await mount(createElement(Badge))

    const records = await interact(app, () => bump())

    expect(records.map((record) => record.type).sort()).toEqual(
      expect.arrayContaining(['attributes', 'characterData']),
    )
    const event = await latestEvent('Badge')
    expect(event).toMatchObject({ necessity: 'necessary', necessityReason: 'dom-changed' })
    expect(event.assessment.behaviorEvidence.subtreeHostMutations.writes).toEqual(
      expect.arrayContaining(['p.className', 'p.style', '#text']),
    )
  })

  it('counts a keyed move of bailed-out memo rows as a DOM write', async () => {
    const Row = memo(function Row({ id }: { id: string }): ReactNode {
      return createElement('li', null, id)
    })
    let reverse: () => void = () => {}
    function List(): ReactNode {
      const [ids, setIds] = useState(['a', 'b', 'c'])
      reverse = () => setIds((current) => [...current].reverse())
      return createElement(
        'ul',
        null,
        ids.map((id) => createElement(Row, { key: id, id })),
      )
    }
    const app = await mount(createElement(List))

    const records = await interact(app, () => reverse())

    expect(records.some((record) => record.type === 'childList')).toBe(true)
    expect(await latestEvent('List')).toMatchObject({
      necessity: 'necessary',
      necessityReason: 'dom-changed',
    })
  })

  it('counts an inserted and a removed child component as DOM writes', async () => {
    function Panel(): ReactNode {
      return createElement('aside', null, 'details')
    }
    let toggle: () => void = () => {}
    function Shell(): ReactNode {
      const [open, setOpen] = useState(false)
      toggle = () => setOpen((value) => !value)
      return createElement('div', null, open ? createElement(Panel) : null)
    }
    const app = await mount(createElement(Shell))

    expect((await interact(app, () => toggle())).length).toBeGreaterThan(0)
    expect(await latestEvent('Shell')).toMatchObject({ necessity: 'necessary' })
    expect(
      (await latestEvent('Shell')).assessment.behaviorEvidence.subtreeHostMutations.writes,
    ).toEqual(['Panel:insert'])

    expect((await interact(app, () => toggle())).length).toBeGreaterThan(0)
    expect(await latestEvent('Shell')).toMatchObject({
      necessity: 'necessary',
      necessityReason: 'dom-changed',
    })
  })

  it('counts a controlled input value change as a write', async () => {
    let type: () => void = () => {}
    function Field(): ReactNode {
      const [value, setValue] = useState('a')
      type = () => setValue((current) => `${current}b`)
      return createElement('input', { value, onChange: () => {} })
    }
    const app = await mount(createElement(Field))

    await interact(app, () => type())

    expect(app.container.querySelector('input')?.value).toBe('ab')
    expect(await latestEvent('Field')).toMatchObject({
      necessity: 'necessary',
      assessment: { behaviorEvidence: { subtreeHostMutations: { writes: ['input.value'] } } },
    })
  })

  it('credits writes inside a portal to the component that rendered it', async () => {
    const portalTarget = document.createElement('div')
    document.body.append(portalTarget)
    let bump: () => void = () => {}
    function Toast(): ReactNode {
      const [count, setCount] = useState(0)
      bump = () => setCount((value) => value + 1)
      return createPortal(createElement('output', null, count), portalTarget)
    }
    const app = await mount(createElement(Toast))

    const records = await interact(app, () => bump(), portalTarget)

    expect(records.length).toBeGreaterThan(0)
    expect(await latestEvent('Toast')).toMatchObject({
      necessity: 'necessary',
      necessityReason: 'dom-changed',
    })
    portalTarget.remove()
  })

  it('ignores React own useSyncExternalStore bookkeeping when a whole-store read changed nothing', async () => {
    const listeners = new Set<() => void>()
    let state = { selected: 0, recent: ['Orders'] }
    const subscribe = (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
    function SidebarNav(): ReactNode {
      const { recent } = useSyncExternalStore(subscribe, () => state)
      return createElement('nav', null, recent.join(', '))
    }
    const app = await mount(createElement(SidebarNav))

    const records = await interact(app, () => {
      state = { ...state, selected: 1 }
      for (const listener of listeners) listener()
    })

    expect(records).toHaveLength(0)
    expect(await latestEvent('SidebarNav')).toMatchObject({
      necessity: 'unnecessary',
      necessityReason: 'output-unchanged',
      causes: [{ kind: 'external-store' }],
    })
  })
})

describe('host writes are credited to the render that caused them', () => {
  it('keeps a memo child output that its own update caused out of its parent', async () => {
    let both: () => void = () => {}
    let setChild: (value: number) => void = () => {}
    const Counter = memo(function Counter(): ReactNode {
      const [count, set] = useState(0)
      setChild = set
      return createElement('output', null, count)
    })
    function Page(): ReactNode {
      const [, setHidden] = useState(0)
      both = () => {
        setHidden((value) => value + 1)
        setChild(1)
      }
      return createElement('main', null, createElement(Counter))
    }
    const app = await mount(createElement(Page))

    const records = await interact(app, () => both())

    expect(records.length).toBeGreaterThan(0)
    expect(await latestEvent('Counter')).toMatchObject({ necessity: 'necessary' })
    expect(await latestEvent('Page')).toMatchObject({
      necessity: 'unnecessary',
      necessityReason: 'output-unchanged',
      assessment: { behaviorEvidence: { subtreeHostMutations: { count: 0 } } },
    })
  })

  it('credits a Context consumer write to the provider owner across a memo boundary', async () => {
    const Locale = createContext('en')
    function Label(): ReactNode {
      return createElement('span', null, useContext(Locale))
    }
    const Boundary = memo(function Boundary(): ReactNode {
      return createElement('div', null, createElement(Label))
    })
    let switchLocale: () => void = () => {}
    function LocaleProvider(): ReactNode {
      const [locale, setLocale] = useState('en')
      switchLocale = () => setLocale('fr')
      return createElement(Locale.Provider, { value: locale }, createElement(Boundary))
    }
    const app = await mount(createElement(LocaleProvider))

    const records = await interact(app, () => switchLocale())

    expect(records.length).toBeGreaterThan(0)
    expect(await latestEvent('Label')).toMatchObject({ necessity: 'necessary' })
    expect(await latestEvent('LocaleProvider')).toMatchObject({
      necessity: 'necessary',
      necessityReason: 'dom-changed',
    })
  })

  it('calls a Context render unnecessary when only function identities changed and nothing was written', async () => {
    const Preferences = createContext<{
      currency: string
      setTheme: (theme: string) => void
    } | null>(null)
    const StatCard = memo(function StatCard({ label }: { label: string }): ReactNode {
      const preferences = useContext(Preferences)
      return createElement('p', { className: 'stat' }, label, ' ', preferences?.currency)
    })
    let collapse: () => void = () => {}
    function PreferencesProvider({ children }: { children: ReactNode }): ReactNode {
      const [theme, setThemeState] = useState('light')
      const [, setCollapsed] = useState(false)
      collapse = () => setCollapsed((value) => !value)
      const value = { currency: 'USD', setTheme: (next: string) => setThemeState(next), theme }
      return createElement(Preferences.Provider, { value }, children)
    }
    const cards = createElement(StatCard, { label: 'Revenue' })
    const app = await mount(createElement(PreferencesProvider, null, cards))

    const records = await interact(app, () => collapse())

    expect(records).toHaveLength(0)
    expect(await latestEvent('StatCard')).toMatchObject({
      necessity: 'unnecessary',
      necessityReason: 'output-unchanged',
      causes: [{ kind: 'context', name: 'Context(PreferencesProvider)' }],
    })
    expect(getRenderTrackingCoverage('causal').incompleteBecause).toEqual([
      expect.objectContaining({ reason: 'inputs-truncated', components: ['StatCard'] }),
    ])
  })

  it('gives every consumer of one Context the same name and id', async () => {
    const Theme = createContext('light')
    const Header = memo(function Header(): ReactNode {
      const [count] = useState(0)
      const theme = useContext(Theme)
      return createElement('h1', null, theme, count)
    })
    const Footer = memo(function Footer(): ReactNode {
      const other = useMemo(() => 1, [])
      const theme = useContext(Theme)
      return createElement('footer', null, theme, other)
    })
    let toggle: () => void = () => {}
    function ThemeRoot(): ReactNode {
      const [theme, setTheme] = useState('light')
      toggle = () => setTheme('dark')
      return createElement(
        Theme.Provider,
        { value: theme },
        createElement(Header),
        createElement(Footer),
      )
    }
    const app = await mount(createElement(ThemeRoot))

    await interact(app, () => toggle())

    const header = (await latestEvent('Header')).causes[0]
    const footer = (await latestEvent('Footer')).causes[0]
    expect(header).toMatchObject({ kind: 'context', name: 'Context(ThemeRoot)' })
    expect(footer).toMatchObject({ kind: 'context', name: 'Context(ThemeRoot)' })
    if (header?.kind !== 'context' || footer?.kind !== 'context') throw new Error('no context')
    expect(header.contextId).toBe(footer.contextId)
    expect(header.provider).toEqual(footer.provider)
  })
})
