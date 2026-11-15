// @vitest-environment jsdom

// biome-ignore-all lint/correctness/useExhaustiveDependencies: the app effect depends on a stable value on purpose, so only library effects re-run
import './hook'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { configureStore } from '@reduxjs/toolkit'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { createElement, type ReactNode, useEffect, useState } from 'react'
import { Provider, useSelector } from 'react-redux'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { click, mount, startCollector, unmountAll } from '../../test-support/react-app'

const THIS_FILE = fileURLToPath(import.meta.url)
const lines = readFileSync(THIS_FILE, 'utf8').split('\n')
const lineOf = (snippet: string): number => lines.findIndex((line) => line.includes(snippet)) + 1

interface Effect {
  hookIndex: number
  hook: string | null
  customHooks: string[] | null
  hasCleanup: boolean
  source: { file: string; line: number | null; role?: string } | null
  provenance: { ownership: string; reason: string; packageName: string | null }
}

interface TimelineEvent {
  componentName: string
  hookIndex: number
  phase: string
  sourceOwnership: string
  customHooks: string[] | null
  execution: { status: string }
}

const store = configureStore({ reducer: { user: (state = { name: 'Ava' }) => state } })
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const recent: string[] = []

function Profile(): ReactNode {
  const name = useSelector((state: { user: { name: string } }) => state.user.name)
  const { data } = useQuery({ queryKey: ['profile'], queryFn: async () => 'loaded' })
  const [edits, setEdits] = useState(0)
  useEffect(() => void recent.push(name), [name])
  return createElement(
    'button',
    { type: 'button', onClick: () => setEdits(edits + 1) },
    `edit ${name} ${data ?? ''}`,
  )
}

function App(): ReactNode {
  return createElement(
    Provider,
    { store } as never,
    createElement(QueryClientProvider, { client }, createElement(Profile)),
  )
}

const genie = startCollector()

beforeAll(async () => {
  const app = await mount(createElement(App))
  await genie.call('react_clear_renders', { budget: { timeLimitMs: 500, adaptive: false } })
  for (let edit = 0; edit < 3; edit += 1) await click(app.container.querySelector('button'))
})

afterAll(async () => {
  await unmountAll()
  genie.stop()
})

const audit = (appOnly: boolean) =>
  genie.call<{
    components: { name: string; effects: Effect[] }[]
    filteredNote?: string
  }>('react_effect_audit', { component: 'Profile', appOnly, minUpdates: 1 })

const timeline = (appOnly: boolean) =>
  genie.call<{ events: TimelineEvent[]; libraryEventsHidden: number; filteredNote?: string }>(
    'react_effect_timeline',
    { component: 'Profile', appOnly, limit: 200 },
  )

describe('effects declared inside library hooks', () => {
  it('shows only the app effect by default, located at its own declaration', async () => {
    const report = await audit(true)
    const effects = report.components.flatMap((component) => component.effects)
    expect(effects).toHaveLength(1)
    expect(effects[0]).toMatchObject({
      hook: 'useEffect',
      customHooks: [],
      source: {
        file: THIS_FILE,
        line: lineOf('useEffect(() => void recent.push'),
        role: 'hook-callsite',
      },
      provenance: { ownership: 'app', reason: 'exact-hook-order' },
    })
    expect(report.filteredNote).toMatch(/library effects hidden — set appOnly:false/)
  })

  it('attributes the useSelector and useQuery effects to their libraries, so none reads as a missing app cleanup', async () => {
    const effects = (await audit(false)).components.flatMap((component) => component.effects)
    const library = effects.filter((effect) => effect.provenance.ownership === 'library')
    expect(effects.filter((effect) => effect.provenance.ownership === 'unknown')).toEqual([])
    expect(library.length).toBe(effects.length - 1)
    const selector = library.filter((effect) => effect.customHooks?.[0] === 'useSelector')
    expect(selector.length).toBeGreaterThan(0)
    expect(selector.some((effect) => !effect.hasCleanup)).toBe(true)
    expect(
      library.find((effect) => effect.customHooks?.join('>') === 'useQuery>useBaseQuery'),
    ).toMatchObject({ provenance: { packageName: '@tanstack/react-query' } })
  })

  it('reports no app-owned re-runs when only TanStack Query re-ran its own effect', async () => {
    const all = await timeline(false)
    const rerunsByOwnership = (events: TimelineEvent[]) =>
      events.filter((event) => event.phase === 'update' && event.execution.status === 'observed')
    expect(rerunsByOwnership(all.events).length).toBeGreaterThan(0)
    expect(
      rerunsByOwnership(all.events).every((event) => event.sourceOwnership === 'library'),
    ).toBe(true)

    const appOnly = await timeline(true)
    expect(rerunsByOwnership(appOnly.events)).toEqual([])
    expect(appOnly.libraryEventsHidden).toBe(all.events.length - appOnly.events.length)
    expect(appOnly.filteredNote).toMatch(/library effects hidden/)
  })

  it('gives the same ownership and hook chain for an effect in the audit and the timeline', async () => {
    const audited = new Map(
      (await audit(false)).components
        .flatMap((component) => component.effects)
        .map((effect) => [effect.hookIndex, [effect.provenance.ownership, effect.customHooks]]),
    )
    const events = (await timeline(false)).events
    expect(events.length).toBeGreaterThan(0)
    for (const event of events) {
      expect([event.sourceOwnership, event.customHooks], `hook ${event.hookIndex}`).toEqual(
        audited.get(event.hookIndex),
      )
    }
  })
})

describe('component ownership with real libraries', () => {
  it('classifies providers an app component renders as library, from their own code rather than the JSX that created them', async () => {
    const report = await genie.call<{ records: { name: string; ownership: string }[] }>(
      'react_provenance',
      { appOnly: false, limit: 50 },
    )
    const ownership = Object.fromEntries(
      report.records.map((record) => [record.name, record.ownership]),
    )
    expect(ownership).toMatchObject({
      App: 'app',
      Provider: 'library',
      QueryClientProvider: 'library',
      Profile: 'app',
    })
  })
})

describe('effects of a component that unmounted', () => {
  function Subscription({ topic }: { topic: string }): ReactNode {
    useEffect(() => {
      recent.push(topic)
    }, [topic])
    return createElement('span', null, topic)
  }
  function Untouched({ topic }: { topic: string }): ReactNode {
    useEffect(() => void recent.push(topic), [topic])
    return createElement('span', null, topic)
  }

  const eventsOf = async (component: string) =>
    (
      await genie.call<{ events: TimelineEvent[] }>('react_effect_timeline', {
        component,
        limit: 50,
      })
    ).events

  it('keeps the declaration a mounted instance of the same component resolved', async () => {
    const tab = await mount(createElement(Subscription, { topic: 'order:1' }))
    expect((await eventsOf('Subscription')).map((event) => event.customHooks)).toEqual([[]])
    await tab.unmount()

    const events = await eventsOf('Subscription')
    expect(events.map((event) => [event.customHooks, event.sourceOwnership])).toEqual([[[], 'app']])
  })

  it('leaves an effect unattributed when no instance of its component was read while mounted', async () => {
    const tab = await mount(createElement(Untouched, { topic: 'order:2' }))
    await tab.unmount()

    expect((await eventsOf('Untouched')).map((event) => event.customHooks)).toEqual([null])
  })
})
