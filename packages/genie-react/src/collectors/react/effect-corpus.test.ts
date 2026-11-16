// @vitest-environment jsdom

// biome-ignore-all lint/correctness/useExhaustiveDependencies: fixtures declare unstable, missing, and extra dependencies on purpose to probe how React schedules them
import './hook'
import * as React from 'react'
import {
  Component,
  createElement,
  type ReactNode,
  StrictMode,
  Suspense,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { freezeAnalysisClock } from '../../test-support/analysis-clock'
import { act, byText, click, mount, startCollector, unmountAll } from '../../test-support/react-app'

vi.mock('bippy/source', () => ({
  getSource: async () => null,
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
}))

interface ObservedRun {
  status: 'observed'
  outcome: 'completed' | 'threw'
  startedAt: number
  completedAt: number
  trigger: 'commit' | 'strict-mode-replay' | 'reconnect'
}
type Run = ObservedRun | { status: 'unobserved'; reason: string }

interface EffectEvent {
  effectEventId: string
  effectId: string
  componentName: string
  effectIndex: number
  kind: 'effect' | 'layout' | 'insertion'
  phase: 'mount' | 'update'
  event: 'scheduled' | 'reconnected'
  documentCommitId: number
  changedDependencySlots: number[]
  dependencyChanges: { slot: number; change: string }[]
  execution: Run
  cleanupExecution: Run
  consequences: {
    events: Array<
      | { kind: 'react-update'; stage: 'execution' | 'cleanup'; status: string; evidence: string }
      | { kind: 'resulting-commit'; documentCommitId: number; evidence: string; reason: string }
      | { kind: 'notification' }
    >
  }
  timeline: Array<{ stage: string; trigger?: string; outcome?: string }>
}

interface Timeline {
  documentCommitId: number
  events: EffectEvent[]
  evictedEvents: number
  refreshCommitsExcluded: number
  coverage: { complete: boolean }
}

interface AuditEffect {
  index: number
  kind: string
  depsMode: string
  scheduled: number
  updates: number
  lastChangedDep: number | null
  cleanupFunctionObserved: boolean
  hotness: { label: string; basis: string }
  note?: string
  provenance: { ownership: string; reason: string }
}

const hasActivity = 'Activity' in React
const hasActionState = 'useActionState' in React
const hasEffectEvent = 'useEffectEvent' in React

const genie = startCollector()
const log: string[] = []

async function observe(): Promise<void> {
  log.length = 0
  await genie.call('react_clear_renders', { budget: { timeLimitMs: 500, adaptive: false } })
}

/** Oldest first, so assertions read in the same order as the oracle log. */
async function effectEvents(component: string): Promise<EffectEvent[]> {
  const timeline = await genie.call<Timeline>('react_effect_timeline', { component, limit: 500 })
  return timeline.events.filter((event) => event.componentName === component).reverse()
}

async function auditOf(component: string): Promise<AuditEffect[]> {
  const audit = await genie.call<{ components: { name: string; effects: AuditEffect[] }[] }>(
    'react_effect_audit',
    { component, appOnly: false, minUpdates: 1 },
  )
  return audit.components.find((record) => record.name === component)?.effects ?? []
}

function observedRun(run: Run): ObservedRun {
  if (run.status !== 'observed') throw new Error(`expected an observed run, got ${run.reason}`)
  return run
}

function resultingCommits(event: EffectEvent): number[] {
  return event.consequences.events.flatMap((consequence) =>
    consequence.kind === 'resulting-commit' ? [consequence.documentCommitId] : [],
  )
}

function reactUpdates(event: EffectEvent): string[] {
  return event.consequences.events.flatMap((consequence) =>
    consequence.kind === 'react-update' ? [consequence.status] : [],
  )
}

function Rerender({ render }: { render: (tick: number) => ReactNode }): ReactNode {
  const [tick, setTick] = useState(0)
  return createElement(
    'div',
    null,
    createElement('button', { type: 'button', onClick: () => setTick(tick + 1) }, 'rerender'),
    render(tick),
  )
}

beforeEach(async () => {
  freezeAnalysisClock()
  await observe()
})
afterEach(unmountAll)
afterAll(() => genie.stop())

describe('dependencies', () => {
  const stable = { id: 'stable' }

  function Deps({ tick }: { tick: number }): ReactNode {
    useEffect(() => void log.push('stable'), [stable])
    useEffect(() => void log.push('object'), [{ id: 'fresh' }])
    useEffect(() => void log.push('array'), [[tick]])
    useEffect(() => void log.push('function'), [() => tick])
    useEffect(() => void log.push('none'))
    useEffect(() => void log.push('empty'), [])
    useEffect(() => void log.push('primitive'), [tick])
    return null
  }

  it('schedules exactly the effects React re-runs and names the changed slot', async () => {
    const app = await mount(
      createElement(Rerender, { render: (tick: number) => createElement(Deps, { tick }) }),
    )
    await observe()
    await click(byText(app.container, 'rerender'))
    await click(byText(app.container, 'rerender'))

    expect(log).toEqual([
      'object',
      'array',
      'function',
      'none',
      'primitive',
      'object',
      'array',
      'function',
      'none',
      'primitive',
    ])
    const events = await effectEvents('Deps')
    expect(events.map((event) => event.effectIndex)).toEqual([1, 2, 3, 4, 6, 1, 2, 3, 4, 6])
    expect(events.every((event) => observedRun(event.execution).outcome === 'completed')).toBe(true)
    expect(events.map((event) => event.changedDependencySlots)).toEqual([
      [0],
      [0],
      [0],
      [],
      [0],
      [0],
      [0],
      [0],
      [],
      [0],
    ])

    const audit = await auditOf('Deps')
    expect(
      audit.map(({ index, depsMode, scheduled, updates }) => [index, depsMode, scheduled, updates]),
    ).toEqual([
      [0, 'list', 0, 2],
      [1, 'list', 2, 2],
      [2, 'list', 2, 2],
      [3, 'list', 2, 2],
      [4, 'none', 2, 2],
      [5, 'empty', 0, 2],
      [6, 'list', 2, 2],
    ])
    expect(audit.map(({ hotness }) => hotness.basis)).toEqual([
      'not-rescheduled',
      'reference-only-reruns',
      'value-change-reruns',
      'dependency-values-not-compared',
      'no-dependency-array',
      'not-rescheduled',
      'value-change-reruns',
    ])
    expect(audit[1]?.note).toContain('is a new reference with equal contents')
    expect(audit[6]?.note).toBeUndefined()
    expect(events.slice(0, 5).map((event) => event.dependencyChanges)).toEqual([
      [{ slot: 0, change: 'reference-only' }],
      [{ slot: 0, change: 'value' }],
      [{ slot: 0, change: 'undetermined' }],
      [],
      [{ slot: 0, change: 'value' }],
    ])
  })

  function Special({ value }: { value: unknown[] }): ReactNode {
    useEffect(() => void log.push(`ran ${String(value)}`), value)
    return null
  }

  it('compares NaN, -0 and resized dependency arrays the way React does', async () => {
    const app = await mount(createElement(Special, { value: [Number.NaN] }))
    await observe()
    await app.render(createElement(Special, { value: [Number.NaN] }))
    await app.render(createElement(Special, { value: [0] }))
    await app.render(createElement(Special, { value: [-0] }))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await app.render(createElement(Special, { value: [-0, 'appended'] }))
    consoleError.mockRestore()

    expect(log).toEqual(['ran 0', 'ran 0'])
    const events = await effectEvents('Special')
    expect(events).toHaveLength(2)
    expect(events.map((event) => event.changedDependencySlots)).toEqual([[0], [0]])
    expect(events.every((event) => event.execution.status === 'observed')).toBe(true)
  })
})

describe('ordering and kinds', () => {
  function Kinds({ tick }: { tick: number }): ReactNode {
    useInsertionEffect(() => {
      log.push(`insertion ${tick}`)
      return () => void log.push(`insertion cleanup ${tick}`)
    }, [tick])
    useLayoutEffect(() => {
      log.push(`layout ${tick}`)
      return () => void log.push(`layout cleanup ${tick}`)
    }, [tick])
    useEffect(() => {
      log.push(`passive ${tick}`)
      return () => void log.push(`passive cleanup ${tick}`)
    }, [tick])
    return null
  }

  it('labels kinds and never promises an observation Genie cannot make', async () => {
    const app = await mount(
      createElement(Rerender, { render: (tick: number) => createElement(Kinds, { tick }) }),
    )
    await observe()
    await click(byText(app.container, 'rerender'))

    expect(log).toEqual([
      'insertion cleanup 0',
      'insertion 1',
      'layout cleanup 0',
      'layout 1',
      'passive cleanup 0',
      'passive 1',
    ])
    const events = await effectEvents('Kinds')
    expect(events.map((event) => [event.effectIndex, event.kind])).toEqual([
      [0, 'insertion'],
      [1, 'layout'],
      [2, 'effect'],
    ])
    for (const event of events.slice(0, 2)) {
      expect(event.execution).toEqual({ status: 'unobserved', reason: 'unsupported-effect-kind' })
      expect(event.cleanupExecution).toEqual({
        status: 'unobserved',
        reason: 'unsupported-effect-kind',
      })
    }
    expect(observedRun(events[2]?.execution ?? fail()).outcome).toBe('completed')
  })

  function Inserted({ tick }: { tick: number }): ReactNode {
    useInsertionEffect(() => void log.push(`insert ${tick}`))
    return null
  }

  it('names the hook kind in the note for a hot insertion effect', async () => {
    const app = await mount(
      createElement(Rerender, { render: (tick: number) => createElement(Inserted, { tick }) }),
    )
    await observe()
    for (let round = 0; round < 3; round += 1) await click(byText(app.container, 'rerender'))

    expect(log).toEqual(['insert 1', 'insert 2', 'insert 3'])
    const [effect] = await auditOf('Inserted')
    expect(effect).toMatchObject({ kind: 'insertion', depsMode: 'none', scheduled: 3, updates: 3 })
    expect(effect?.note).toContain('useInsertionEffect')
  })

  function Child(): ReactNode {
    useEffect(() => {
      log.push('child')
      return () => void log.push('child cleanup')
    })
    return null
  }
  function Parent(): ReactNode {
    useEffect(() => {
      log.push('parent')
      return () => void log.push('parent cleanup')
    })
    return createElement(Child)
  }

  it('orders child before parent, cleanup before re-run, and records unmount cleanup', async () => {
    const app = await mount(createElement(Parent))
    await app.render(createElement(Parent))
    await app.unmount()

    expect(log).toEqual([
      'child',
      'parent',
      'child cleanup',
      'parent cleanup',
      'child',
      'parent',
      'parent cleanup',
      'child cleanup',
    ])
    const [childMount, childUpdate] = await effectEvents('Child')
    const [parentMount, parentUpdate] = await effectEvents('Parent')
    if (!childMount || !childUpdate || !parentMount || !parentUpdate) throw new Error('missing')
    expect(observedRun(childMount.execution).startedAt).toBeLessThanOrEqual(
      observedRun(parentMount.execution).startedAt,
    )
    expect(observedRun(childMount.cleanupExecution).completedAt).toBeLessThanOrEqual(
      observedRun(childUpdate.execution).startedAt,
    )
    expect(observedRun(childUpdate.cleanupExecution).outcome).toBe('completed')
    expect(observedRun(parentUpdate.cleanupExecution).outcome).toBe('completed')
  })

  function useSubscription(label: string): void {
    useEffect(() => {
      log.push(label)
      return () => void log.push(`${label} cleanup`)
    }, [label])
  }
  function HookOwner(): ReactNode {
    useSubscription('subscription')
    return null
  }

  it('records the cleanup a mount-only effect returned and leaves provenance unknown when the inspector sees no hooks', async () => {
    await mount(createElement(HookOwner))

    const [effect] = await auditOf('HookOwner')
    expect(log).toEqual(['subscription'])
    expect(effect?.cleanupFunctionObserved).toBe(true)
    expect(effect?.provenance).toMatchObject({
      ownership: 'unknown',
      reason: 'hook-count-mismatch',
    })
  })
})

describe('StrictMode development replay', () => {
  function Subscriber(): ReactNode {
    useEffect(() => {
      log.push('subscribe')
      return () => void log.push('unsubscribe')
    }, [])
    return null
  }

  it('labels the replay and keeps the live subscription marked as not cleaned up', async () => {
    const app = await mount(createElement(StrictMode, null, createElement(Subscriber)))

    expect(log).toEqual(['subscribe', 'unsubscribe', 'subscribe'])
    const [event, ...others] = await effectEvents('Subscriber')
    expect(others).toEqual([])
    expect(event?.phase).toBe('mount')
    expect(observedRun(event?.execution ?? fail()).trigger).toBe('strict-mode-replay')
    expect(event?.timeline.map((entry) => [entry.stage, entry.trigger])).toEqual([
      ['schedule', undefined],
      ['execution', 'commit'],
      ['cleanup', 'strict-mode-replay'],
      ['execution', 'strict-mode-replay'],
    ])
    expect(event?.cleanupExecution).toEqual({ status: 'unobserved', reason: 'not-yet-observed' })
    const [audit] = await auditOf('Subscriber')
    expect(audit?.hotness.label).toBe('insufficient-data')
    expect(audit?.note).toBeUndefined()

    await app.unmount()
    expect(log.at(-1)).toBe('unsubscribe')
    const [unmounted] = await effectEvents('Subscriber')
    expect(observedRun(unmounted?.cleanupExecution ?? fail()).outcome).toBe('completed')
  })
})

describe('effects that update state', () => {
  function Converges(): ReactNode {
    const [count, setCount] = useState(0)
    useEffect(() => {
      log.push(`run ${count}`)
      if (count < 3) setCount(count + 1)
    }, [count])
    return createElement('output', null, count)
  }

  it('links each step of a converging cascade to the commit that processed its update', async () => {
    await mount(createElement(Converges))

    expect(log).toEqual(['run 0', 'run 1', 'run 2', 'run 3'])
    const events = await effectEvents('Converges')
    expect(events).toHaveLength(4)
    for (const [index, event] of events.slice(0, 3).entries()) {
      expect(reactUpdates(event)).toEqual(['scheduled'])
      expect(resultingCommits(event)).toEqual([events[index + 1]?.documentCommitId])
    }
    expect(reactUpdates(events[3] ?? fail())).toEqual([])
    expect(resultingCommits(events[3] ?? fail())).toEqual([])
  })

  function Quiet(): ReactNode {
    const [count, setCount] = useState(0)
    useEffect(() => void log.push('quiet'), [])
    return createElement('button', { type: 'button', onClick: () => setCount(count + 1) }, 'add')
  }

  it('does not credit an effect with a later commit caused by user input', async () => {
    const app = await mount(createElement(Quiet))
    await click(byText(app.container, 'add'))

    expect(log).toEqual(['quiet'])
    const [event] = await effectEvents('Quiet')
    expect(reactUpdates(event ?? fail())).toEqual([])
    expect(resultingCommits(event ?? fail())).toEqual([])
  })

  function Unchanged(): ReactNode {
    const [value, setValue] = useState(0)
    useEffect(() => {
      log.push('write same value')
      setValue(0)
    })
    return createElement('output', null, value)
  }

  it('reports no update when React bails out of an identical state write', async () => {
    await mount(createElement(Unchanged))

    expect(log).toEqual(['write same value'])
    const [event] = await effectEvents('Unchanged')
    expect(reactUpdates(event ?? fail())).toEqual([])
    expect(resultingCommits(event ?? fail())).toEqual([])
  })

  function Batched(): ReactNode {
    const [a, setA] = useState(0)
    const [b, setB] = useState(0)
    useEffect(() => {
      log.push('first')
      setA(1)
    }, [])
    useEffect(() => {
      log.push('second')
      setB(1)
    }, [])
    return createElement('output', null, `${a}${b}`)
  }

  it('grades the second of two batched updates as undetermined instead of guessing', async () => {
    const app = await mount(createElement(Batched))

    expect(log).toEqual(['first', 'second'])
    expect(app.container.textContent).toBe('11')
    const [first, second] = await effectEvents('Batched')
    expect(reactUpdates(first ?? fail())).toEqual(['scheduled'])
    expect(resultingCommits(first ?? fail())).toHaveLength(1)
    expect(second?.consequences.events).toEqual([
      expect.objectContaining({
        kind: 'react-update',
        status: 'undetermined',
        evidence: 'unknown',
        reason: 'work-already-pending',
      }),
    ])
  })

  function Measured(): ReactNode {
    const [width, setWidth] = useState(0)
    useLayoutEffect(() => {
      log.push(`layout ${width}`)
      if (width === 0) setWidth(10)
    }, [width])
    return createElement('output', null, width)
  }

  it('makes no execution or consequence claim for a layout effect that sets state', async () => {
    await mount(createElement(Measured))

    expect(log).toEqual(['layout 0', 'layout 10'])
    const events = await effectEvents('Measured')
    expect(events.map((event) => event.phase)).toEqual(['mount', 'update'])
    for (const event of events) {
      expect(event.execution.status).toBe('unobserved')
      expect(event.consequences.events).toEqual([])
    }
  })
})

describe('internal React effects', () => {
  const store = { value: 1, subscribe: () => () => {} }

  function StoreReader({ tick }: { tick: number }): ReactNode {
    const value = useSyncExternalStore(store.subscribe, () => store.value)
    useEffect(() => void log.push(`reader ${tick}`), [tick])
    return createElement('output', null, value)
  }

  it('keeps useSyncExternalStore bookkeeping out of the app effect report', async () => {
    const app = await mount(
      createElement(Rerender, { render: (tick: number) => createElement(StoreReader, { tick }) }),
    )
    await observe()
    await click(byText(app.container, 'rerender'))

    expect(log).toEqual(['reader 1'])
    const audit = await auditOf('StoreReader')
    expect(audit.map(({ index, depsMode }) => [index, depsMode])).toEqual([
      [0, 'list'],
      [1, 'list'],
    ])
    expect(
      audit.some((effect) => effect.hotness.label === 'hot' && effect.depsMode === 'none'),
    ).toBe(false)
    const events = await effectEvents('StoreReader')
    expect(events.map((event) => [event.effectIndex, event.changedDependencySlots])).toEqual([
      [1, [0]],
    ])
  })

  it.skipIf(!hasActionState)(
    'keeps effect identity stable when useActionState adds an effect only on updates',
    async () => {
      const { useActionState } = React as unknown as {
        useActionState: (action: (state: number) => number, initial: number) => [number]
      }
      function Form({ tick }: { tick: number }): ReactNode {
        const [state] = useActionState((previous: number) => previous + tick, 0)
        useEffect(() => void log.push(`form ${tick}`), [tick])
        return createElement('output', null, state)
      }
      const app = await mount(
        createElement(Rerender, { render: (tick: number) => createElement(Form, { tick }) }),
      )
      const [mountEvent] = await effectEvents('Form')
      await click(byText(app.container, 'rerender'))

      expect(log).toEqual(['form 0', 'form 1'])
      const events = await effectEvents('Form')
      expect(events.map((event) => [event.effectId, event.changedDependencySlots])).toEqual([
        [mountEvent?.effectId, []],
        [mountEvent?.effectId, [0]],
      ])
      const audit = await auditOf('Form')
      expect(
        audit.map(({ depsMode, scheduled, updates }) => [depsMode, scheduled, updates]),
      ).toEqual([['list', 1, 1]])
    },
  )
})

describe('concurrency and visibility', () => {
  let resolve: (() => void) | null = null
  let ready = false
  const pending = new Promise<void>((done) => {
    resolve = () => {
      ready = true
      done()
    }
  })

  function Lazy(): ReactNode {
    if (!ready) throw pending
    useEffect(() => {
      log.push('lazy mounted')
      return () => void log.push('lazy cleanup')
    }, [])
    return createElement('span', null, 'lazy')
  }

  it('reports no effect for a suspended render and one execution once it commits', async () => {
    const app = await mount(
      createElement(
        Suspense,
        { fallback: createElement('i', null, 'loading') },
        createElement(Lazy),
      ),
    )
    expect(log).toEqual([])
    expect(await effectEvents('Lazy')).toEqual([])

    await act(async () => {
      resolve?.()
      await pending
    })
    expect(app.container.textContent).toBe('lazy')
    expect(log).toEqual(['lazy mounted'])
    const [event, ...others] = await effectEvents('Lazy')
    expect(others).toEqual([])
    expect(observedRun(event?.execution ?? fail()).trigger).toBe('commit')
  })

  function Transitioned({ value }: { value: number }): ReactNode {
    useEffect(() => void log.push(`transition ${value}`), [value])
    return createElement('output', null, value)
  }

  it('observes an effect committed by a transition', async () => {
    let setValue: ((value: number) => void) | null = null
    function Owner(): ReactNode {
      const [value, set] = useState(0)
      setValue = set
      return createElement(Transitioned, { value })
    }
    await mount(createElement(Owner))
    await observe()
    await act(() => React.startTransition(() => setValue?.(1)))

    expect(log).toEqual(['transition 1'])
    const [event] = await effectEvents('Transitioned')
    expect(event?.phase).toBe('update')
    expect(observedRun(event?.execution ?? fail()).outcome).toBe('completed')
  })

  it('reports nothing for a transition render that suspended and never committed', async () => {
    let resolveDetail: () => void = () => {}
    let detailReady = false
    const detail = new Promise<void>((done) => {
      resolveDetail = () => {
        detailReady = true
        done()
      }
    })
    function Detail({ id }: { id: number }): ReactNode {
      if (id === 1 && !detailReady) throw detail
      useEffect(() => void log.push(`detail ${id}`), [id])
      return createElement('output', null, `detail ${id}`)
    }
    let select: (id: number) => void = () => {}
    function Master(): ReactNode {
      const [id, setId] = useState(0)
      select = setId
      return createElement(
        Suspense,
        { fallback: createElement('i', null, 'loading') },
        createElement(Detail, { id }),
      )
    }
    const app = await mount(createElement(Master))
    await observe()
    await act(() => React.startTransition(() => select(1)))

    expect(app.container.textContent).toBe('detail 0')
    expect(log).toEqual([])
    expect(await effectEvents('Detail')).toEqual([])

    await act(async () => {
      resolveDetail()
      await detail
    })
    expect(log).toEqual(['detail 1'])
    const [event, ...others] = await effectEvents('Detail')
    expect(others).toEqual([])
    expect(event?.changedDependencySlots).toEqual([0])
  })

  it.skipIf(!hasActivity)('labels an effect scheduled while hidden as run on reveal', async () => {
    const { Activity } = React as unknown as {
      Activity: (props: { mode: 'visible' | 'hidden'; children?: ReactNode }) => ReactNode
    }
    function Panel({ value }: { value: number }): ReactNode {
      useEffect(() => {
        log.push(`connect ${value}`)
        return () => void log.push(`disconnect ${value}`)
      }, [value])
      return createElement('i', null, value)
    }
    function Tabs(): ReactNode {
      const [mode, setMode] = useState<'visible' | 'hidden'>('visible')
      const [value, setValue] = useState(0)
      return createElement(
        'div',
        null,
        createElement(
          'button',
          { type: 'button', onClick: () => setMode(mode === 'visible' ? 'hidden' : 'visible') },
          'toggle',
        ),
        createElement('button', { type: 'button', onClick: () => setValue(value + 1) }, 'bump'),
        createElement(Activity, { mode }, createElement(Panel, { value })),
      )
    }
    const app = await mount(createElement(Tabs))
    await click(byText(app.container, 'toggle'))
    await click(byText(app.container, 'bump'))
    const [, hiddenUpdate] = await effectEvents('Panel')
    expect(hiddenUpdate?.execution).toEqual({ status: 'unobserved', reason: 'not-yet-observed' })
    await click(byText(app.container, 'toggle'))

    expect(log).toEqual(['connect 0', 'disconnect 0', 'connect 1'])
    const events = await effectEvents('Panel')
    expect(events.map((event) => [event.event, event.phase])).toEqual([
      ['scheduled', 'mount'],
      ['scheduled', 'update'],
    ])
    expect(observedRun(events[1]?.execution ?? fail()).trigger).toBe('reconnect')
  })

  it.skipIf(!hasActivity)(
    'reports the re-run when an Activity boundary is shown again',
    async () => {
      const { Activity } = React as unknown as {
        Activity: (props: { mode: 'visible' | 'hidden'; children?: ReactNode }) => ReactNode
      }
      function Panel(): ReactNode {
        useEffect(() => {
          log.push('panel connected')
          return () => void log.push('panel disconnected')
        }, [])
        return createElement('i', null, 'panel')
      }
      function Tabs(): ReactNode {
        const [mode, setMode] = useState<'visible' | 'hidden'>('visible')
        return createElement(
          'div',
          null,
          createElement(
            'button',
            { type: 'button', onClick: () => setMode(mode === 'visible' ? 'hidden' : 'visible') },
            'toggle',
          ),
          createElement(Activity, { mode }, createElement(Panel)),
        )
      }
      const app = await mount(createElement(Tabs))
      await click(byText(app.container, 'toggle'))
      await click(byText(app.container, 'toggle'))

      expect(log).toEqual(['panel connected', 'panel disconnected', 'panel connected'])
      const events = await effectEvents('Panel')
      expect(events.map((event) => event.event)).toEqual(['scheduled', 'reconnected'])
      expect(observedRun(events[0]?.cleanupExecution ?? fail()).outcome).toBe('completed')
      expect(observedRun(events[1]?.execution ?? fail()).trigger).toBe('reconnect')
      expect(events[1]?.cleanupExecution).toEqual({
        status: 'unobserved',
        reason: 'not-yet-observed',
      })
      expect(events[1]?.effectId).toBe(events[0]?.effectId)
    },
  )

  it.skipIf(!hasEffectEvent)('does not count useEffectEvent as an effect', async () => {
    const { useEffectEvent } = React as unknown as {
      useEffectEvent: <T extends (...args: never[]) => unknown>(callback: T) => T
    }
    function Logger({ value }: { value: number }): ReactNode {
      const onValue = useEffectEvent(() => log.push(`event ${value}`))
      useEffect(() => {
        onValue()
      }, [])
      return null
    }
    const app = await mount(createElement(Logger, { value: 1 }))
    await app.render(createElement(Logger, { value: 2 }))

    expect(log).toEqual(['event 1'])
    const events = await effectEvents('Logger')
    expect(events.map((event) => [event.effectIndex, event.phase])).toEqual([[0, 'mount']])
  })
})

class Boundary extends Component<{ children: ReactNode }, { caught: unknown }> {
  override state = { caught: undefined as unknown }
  static getDerivedStateFromError(caught: unknown): { caught: unknown } {
    return { caught }
  }
  override render(): ReactNode {
    return this.state.caught === undefined
      ? this.props.children
      : createElement('p', null, 'failed')
  }
}

describe('instrumentation safety', () => {
  it('delivers the exact thrown value to the boundary, even one that cannot be stringified', async () => {
    const thrown = Object.create(null) as object
    let received: unknown
    class Recorder extends Boundary {
      override componentDidCatch(error: unknown): void {
        received = error
      }
    }
    function Throws(): ReactNode {
      useEffect(() => {
        log.push('throwing')
        throw thrown
      }, [])
      return null
    }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = await mount(createElement(Recorder, null, createElement(Throws)))
    consoleError.mockRestore()

    expect(log).toEqual(['throwing'])
    expect(received).toBe(thrown)
    expect(app.container.textContent).toBe('failed')
    const [event] = await effectEvents('Throws')
    expect(observedRun(event?.execution ?? fail()).outcome).toBe('threw')
    expect(event?.cleanupExecution).toEqual({ status: 'unobserved', reason: 'no-cleanup-returned' })
  })

  it('rethrows a cleanup error unchanged and records it', async () => {
    const thrown = new Error('cleanup failed')
    let received: unknown
    class Recorder extends Boundary {
      override componentDidCatch(error: unknown): void {
        received = error
      }
    }
    function Leaky(): ReactNode {
      useEffect(
        () => () => {
          log.push('cleanup')
          throw thrown
        },
        [],
      )
      return null
    }
    function Host(): ReactNode {
      const [shown, setShown] = useState(true)
      return createElement(
        'div',
        null,
        createElement('button', { type: 'button', onClick: () => setShown(false) }, 'hide'),
        shown ? createElement(Leaky) : null,
      )
    }
    const app = await mount(createElement(Recorder, null, createElement(Host)))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await click(byText(app.container, 'hide'))
    consoleError.mockRestore()

    expect(log).toEqual(['cleanup'])
    expect(received).toBe(thrown)
    const [event] = await effectEvents('Leaky')
    expect(event?.cleanupExecution).toMatchObject({
      status: 'observed',
      outcome: 'threw',
      error: 'cleanup failed',
    })
  })
})

describe('limits', () => {
  function Noisy({ tick }: { tick: number }): ReactNode {
    useEffect(() => {}, [tick])
    useEffect(() => {}, [tick])
    useEffect(() => {}, [tick])
    useEffect(() => {}, [tick])
    useEffect(() => {}, [tick])
    return null
  }

  it('marks the timeline incomplete once the event history evicts events', async () => {
    const app = await mount(createElement(Noisy, { tick: 0 }))
    for (let tick = 1; tick <= 210; tick += 1) await app.render(createElement(Noisy, { tick }))

    const timeline = await genie.call<Timeline>('react_effect_timeline', { limit: 500 })
    expect(timeline.evictedEvents).toBeGreaterThan(0)
    expect(timeline.coverage.complete).toBe(false)
  })
})

function fail(): never {
  throw new Error('expected a value')
}
