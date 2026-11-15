// @vitest-environment jsdom
import './hook'
import { createElement, type ReactNode, useEffect, useState } from 'react'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, byText, click, mount, startCollector, unmountAll } from '../../test-support/react-app'
import { refreshRuntime } from '../../test-support/react-refresh-runtime'

vi.mock('bippy/source', () => ({
  getSource: async () => null,
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
}))

interface RefreshEvents {
  events: {
    updatedComponents: string[]
    remountedComponents: string[]
    preservedState: { name: string }[]
    remounted: { name: string }[]
  }[]
  latestSequence: number
}

const genie = startCollector()
const log: string[] = []

function counterVersion(version: string) {
  return function Counter(): ReactNode {
    const [count, setCount] = useState(0)
    useEffect(() => {
      log.push(`${version} effect ${count}`)
      return () => void log.push(`${version} cleanup ${count}`)
    }, [count])
    return createElement(
      'button',
      { type: 'button', onClick: () => setCount(count + 1) },
      `${version}:${count}`,
    )
  }
}

function shellVersion(version: string, Child: () => ReactNode) {
  const Shell = function Shell(): ReactNode {
    return createElement('section', { 'data-version': version }, createElement(Child))
  }
  refreshRuntime.register(Shell, 'Shell')
  refreshRuntime.setSignature(Shell, version)
  return Shell
}

function edit(type: unknown, id: string): void {
  refreshRuntime.register(type, id)
}

async function refresh(): Promise<void> {
  await act(() => {
    refreshRuntime.performReactRefresh()
  })
}

async function latestRefresh(after: number) {
  const report = await genie.call<RefreshEvents>('react_refresh_events', {
    afterSequence: after,
    includeSource: false,
    appOnly: false,
  })
  expect(report.events).toHaveLength(1)
  const [event] = report.events
  return {
    preserved: event?.preservedState.map(({ name }) => name) ?? [],
    remounted: event?.remounted.map(({ name }) => name) ?? [],
    preservedTypes: event?.updatedComponents ?? [],
    remountedTypes: event?.remountedComponents ?? [],
  }
}

async function sequence(): Promise<number> {
  return (await genie.call<RefreshEvents>('react_refresh_events', { includeSource: false }))
    .latestSequence
}

beforeEach(async () => {
  log.length = 0
  await genie.call('react_clear_renders', {})
})
afterEach(unmountAll)
afterAll(() => genie.stop())

describe('Fast Refresh evidence', () => {
  it('reports an edit that keeps state as preserved', async () => {
    const CounterV1 = counterVersion('v1')
    edit(CounterV1, 'PreservedCounter')
    const app = await mount(createElement(CounterV1))
    await click(byText(app.container, 'v1:0'))
    const before = await sequence()

    edit(counterVersion('v2'), 'PreservedCounter')
    await refresh()

    expect(app.container.textContent).toBe('v2:1')
    expect(await latestRefresh(before)).toEqual({
      preserved: ['Counter'],
      remounted: [],
      preservedTypes: ['Counter'],
      remountedTypes: [],
    })
  })

  it('reports a child whose parent remounted as remounted, not preserved', async () => {
    const CounterV1 = counterVersion('v1')
    edit(CounterV1, 'NestedCounter')
    const app = await mount(createElement(shellVersion('first', CounterV1)))
    await click(byText(app.container, 'v1:0'))
    const before = await sequence()

    const CounterV2 = counterVersion('v2')
    edit(CounterV2, 'NestedCounter')
    shellVersion('second', CounterV2)
    await refresh()

    expect(app.container.textContent).toBe('v2:0')
    expect(await latestRefresh(before)).toEqual({
      preserved: [],
      remounted: ['Shell', 'Counter'],
      preservedTypes: [],
      remountedTypes: ['Shell', 'Counter'],
    })
  })

  it('marks the effect timeline incomplete once a refresh re-runs effects unobserved', async () => {
    const CounterV1 = counterVersion('v1')
    edit(CounterV1, 'EffectCounter')
    await mount(createElement(CounterV1))
    await genie.call('react_clear_renders', {})
    log.length = 0

    edit(counterVersion('v2'), 'EffectCounter')
    await refresh()

    expect(log).toEqual(['v1 cleanup 0', 'v2 effect 0'])
    const timeline = await genie.call<{
      refreshCommitsExcluded: number
      coverage: { complete: boolean }
    }>('react_effect_timeline', {})
    expect(timeline.refreshCommitsExcluded).toBeGreaterThan(0)
    expect(timeline.coverage.complete).toBe(false)
  })
})
