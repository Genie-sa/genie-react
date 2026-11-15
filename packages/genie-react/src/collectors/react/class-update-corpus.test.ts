// @vitest-environment jsdom
import './hook'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  Component,
  createRef,
  createElement as h,
  type ReactNode,
  startTransition,
  useEffect,
  useState,
} from 'react'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, click, mount, startCollector, unmountAll } from '../../test-support/react-app'
import { disposeRenderTracking } from './render-tracker'

const THIS_FILE = fileURLToPath(import.meta.url)
const lines = readFileSync(THIS_FILE, 'utf8').split('\n')
const lineOf = (snippet: string): number => lines.findIndex((line) => line.includes(snippet)) + 1

const originalSetState = Component.prototype.setState
const originalForceUpdate = Component.prototype.forceUpdate
const genie = startCollector()

interface ClassUpdate {
  method: string
  phase: string
  evidence: string
  lifecycle?: string
  component?: string
  eventType?: string
  fields: string[] | null
  caller: { functionName: string | null; file: string | null; line: number | null } | null
}

interface Cause {
  kind: string
  name?: string
  reason?: string
  classUpdates?: ClassUpdate[]
}

interface CauseEvent {
  componentName: string
  documentCommitId: number
  causes: Cause[]
}

/** Every render of `component` in the window, oldest first, with the class updates each one applied. */
async function rendersOf(component: string): Promise<CauseEvent[]> {
  const report = await genie.call<{ events: CauseEvent[] }>('react_render_causes', {
    component,
    appOnly: false,
    view: 'full',
    limit: 500,
  })
  return [...report.events].reverse()
}

const updatesOf = (events: CauseEvent[]): ClassUpdate[] =>
  events.flatMap((event) => event.causes.flatMap((cause) => cause.classUpdates ?? []))

// A frozen clock keeps the analysis time limit from skipping a render on a loaded machine, so every join is observed.
beforeEach(async () => {
  vi.spyOn(performance, 'now').mockReturnValue(0)
  await genie.call('react_clear_renders')
})

afterEach(unmountAll)

afterAll(() => {
  genie.stop()
})

interface Issue {
  title: string
}

let refetch: () => void = () => {}

class DraftEditor extends Component<{ issue: Issue }, { draft: string }> {
  override state = { draft: this.props.issue.title }

  override componentDidUpdate(previous: { issue: Issue }) {
    if (previous.issue !== this.props.issue) {
      this.setState({ draft: this.props.issue.title })
    }
  }

  edit = () => this.setState({ draft: 'renamed by the user' })

  override render(): ReactNode {
    return h(
      'div',
      null,
      h('button', { type: 'button', onClick: this.edit }, 'edit'),
      this.state.draft,
    )
  }
}

const draftEditorDidUpdate = DraftEditor.prototype.componentDidUpdate

function IssuePage(): ReactNode {
  const [issue, setIssue] = useState<Issue>({ title: 'Original title' })
  refetch = () => setIssue({ title: 'Original title' })
  return h(DraftEditor, { issue })
}

describe('class updates name where setState was called', () => {
  it('grades a reset from componentDidUpdate exact and names the method, while the user edit is an inferred event', async () => {
    const app = await mount(h(IssuePage))
    await genie.call('react_clear_renders')

    await click(app.container.querySelector('button'))
    await act(() => refetch())

    const updates = updatesOf(await rendersOf('DraftEditor'))
    expect(updates).toEqual([
      expect.objectContaining({
        method: 'setState',
        phase: 'event',
        evidence: 'inferred',
        eventType: 'click',
        fields: ['draft'],
      }),
      expect.objectContaining({
        method: 'setState',
        phase: 'lifecycle',
        evidence: 'exact',
        lifecycle: 'componentDidUpdate',
        component: 'DraftEditor',
        fields: ['draft'],
      }),
    ])
    expect(updates[1]?.caller).toMatchObject({
      functionName: expect.stringContaining('componentDidUpdate'),
      file: THIS_FILE,
      line: lineOf('this.setState({ draft: this.props.issue.title })'),
    })
    expect(app.container.textContent).toContain('Original title')
  })

  it('joins each call to the render that applied it, not to the prop render before it', async () => {
    await mount(h(IssuePage))
    await genie.call('react_clear_renders')

    await act(() => refetch())

    const renders = await rendersOf('DraftEditor')
    expect(renders.map((event) => event.causes.map((cause) => cause.name ?? cause.kind))).toEqual([
      ['parent', 'issue'],
      ['this.state'],
    ])
    expect(renders[0]?.causes.some((cause) => cause.classUpdates)).toBe(false)
    expect(updatesOf(renders.slice(1))).toHaveLength(1)
  })

  it('credits the class whose lifecycle ran when it updates another instance through a ref', async () => {
    const child = createRef<Counter>()
    let bump: () => void = () => {}
    class Parent extends Component<{ tick: number }> {
      override componentDidUpdate() {
        child.current?.setState((state) => ({ count: state.count + 1 }))
      }
      override render(): ReactNode {
        return h(Counter, { ref: child })
      }
    }
    function Host(): ReactNode {
      const [tick, setTick] = useState(0)
      bump = () => setTick((value) => value + 1)
      return h(Parent, { tick })
    }
    await mount(h(Host))
    await genie.call('react_clear_renders')

    await act(() => bump())

    expect(updatesOf(await rendersOf('Counter'))).toEqual([
      expect.objectContaining({
        phase: 'lifecycle',
        evidence: 'exact',
        lifecycle: 'componentDidUpdate',
        component: 'Parent',
        fields: null,
      }),
    ])
  })

  it('says a function component effect is React work it did not wrap, never a lifecycle', async () => {
    const counter = createRef<Counter>()
    let bump: () => void = () => {}
    function Effectful(): ReactNode {
      const [tick, setTick] = useState(0)
      bump = () => setTick((value) => value + 1)
      useEffect(() => {
        if (tick > 0) counter.current?.setState({ count: tick })
      }, [tick])
      return h(Counter, { ref: counter })
    }
    await mount(h(Effectful))
    await genie.call('react_clear_renders')

    await act(() => bump())

    expect(updatesOf(await rendersOf('Counter'))).toEqual([
      expect.objectContaining({ phase: 'react-work', evidence: 'inferred', fields: ['count'] }),
    ])
  })

  it('grades a timer and a promise callback unknown and still names the caller', async () => {
    const counter = createRef<Counter>()
    await mount(h(Counter, { ref: counter }))
    await genie.call('react_clear_renders')

    await act(
      () =>
        new Promise<void>((resolve) =>
          setTimeout(function fromTimer() {
            counter.current?.setState({ count: 1 })
            resolve()
          }, 0),
        ),
    )
    await act(() =>
      Promise.resolve().then(function fromPromise() {
        counter.current?.setState({ count: 2 })
      }),
    )

    const updates = updatesOf(await rendersOf('Counter'))
    expect(updates.map(({ phase, evidence }) => [phase, evidence])).toEqual([
      ['callback', 'unknown'],
      ['callback', 'unknown'],
    ])
    expect(updates.map((update) => update.caller?.functionName)).toEqual([
      expect.stringContaining('fromTimer'),
      expect.stringContaining('fromPromise'),
    ])
  })

  it('attaches forceUpdate to the render it caused, which has no state change', async () => {
    const counter = createRef<Counter>()
    await mount(h(Counter, { ref: counter }))
    await genie.call('react_clear_renders')

    await act(() => counter.current?.forceUpdate())

    const [render] = await rendersOf('Counter')
    expect(render?.causes).toEqual([
      expect.objectContaining({
        kind: 'unknown',
        reason: 'no-observable-fiber-input-change',
        classUpdates: [expect.objectContaining({ method: 'forceUpdate', fields: null })],
      }),
    ])
  })

  it('does not credit a render with a call shouldComponentUpdate already absorbed', async () => {
    const gate = createRef<Gate>()
    await mount(h(Gate, { ref: gate }))
    await genie.call('react_clear_renders')

    await act(() => gate.current?.setState({ hidden: 1 }))
    await act(() => gate.current?.setState({ shown: 1 }))

    const renders = await rendersOf('Gate')
    expect(renders).toHaveLength(1)
    expect(updatesOf(renders).map((update) => update.fields)).toEqual([['shown']])
  })

  it('does not credit a sync render with a transition update React skipped', async () => {
    const counter = createRef<Counter>()
    await mount(h(Counter, { ref: counter }))
    await genie.call('react_clear_renders')

    await act(() => {
      startTransition(() => counter.current?.setState({ slow: 1 }))
      counter.current?.setState({ count: 1 })
    })

    const renders = await rendersOf('Counter')
    const claimed = renders.flatMap((event) =>
      updatesOf([event]).flatMap((update) => update.fields ?? []),
    )
    expect(claimed.filter((field) => field === 'count')).toEqual(['count'])
    for (const event of renders) {
      const fields = updatesOf([event]).flatMap((update) => update.fields ?? [])
      if (fields.includes('slow')) expect(event.causes[0]?.name).toContain('slow')
    }
  })
})

class Counter extends Component<object, { count: number; slow?: number }> {
  override state = { count: 0 }
  override render(): ReactNode {
    return h('output', null, String(this.state.count))
  }
}

class Gate extends Component<object, { hidden: number; shown: number }> {
  override state = { hidden: 0, shown: 0 }
  override shouldComponentUpdate(_props: object, next: { hidden: number; shown: number }) {
    return next.shown !== this.state.shown
  }
  override render(): ReactNode {
    return h('output', null, String(this.state.shown))
  }
}

describe('the recorder leaves the app as it was', () => {
  it('passes lifecycle arguments and results through, keeps setState callbacks in order, and keeps method names', async () => {
    const order: string[] = []
    const instance = createRef<Snapshotting>()
    class Snapshotting extends Component<object, { value: number }> {
      override state = { value: 0 }
      override getSnapshotBeforeUpdate(): string {
        return 'snapshot'
      }
      override componentDidUpdate(_props: object, _state: unknown, snapshot: unknown) {
        order.push(`didUpdate:${String(snapshot)}:${this.state.value}`)
      }
      override render(): ReactNode {
        return String(this.state.value)
      }
    }
    await mount(h(Snapshotting, { ref: instance }))

    await act(() => {
      instance.current?.setState({ value: 1 }, () => order.push('first callback'))
      instance.current?.setState({ value: 2 }, () => order.push('second callback'))
    })

    expect(order).toEqual(['didUpdate:snapshot:2', 'first callback', 'second callback'])
    expect(Snapshotting.prototype.componentDidUpdate.name).toBe('componentDidUpdate')
    expect(Snapshotting.prototype.componentDidUpdate.length).toBe(3)
    expect(Component.prototype.setState.name).toBe(originalSetState.name)
  })

  it('keeps flags React reads off a lifecycle method', async () => {
    const legacy = createRef<Legacy>()
    class Legacy extends Component<{ step: number }> {
      override UNSAFE_componentWillReceiveProps() {}
      override render(): ReactNode {
        return String(this.props.step)
      }
    }
    Object.assign(Legacy.prototype.UNSAFE_componentWillReceiveProps, {
      __suppressDeprecationWarning: true,
    })
    const app = await mount(h(Legacy, { ref: legacy, step: 0 }))
    await app.render(h(Legacy, { ref: legacy, step: 1 }))

    expect(
      (Legacy.prototype.UNSAFE_componentWillReceiveProps as { __suppressDeprecationWarning?: true })
        .__suppressDeprecationWarning,
    ).toBe(true)
  })

  it('throws React’s own error for an invalid setState and records nothing for it', async () => {
    const counter = createRef<Counter>()
    await mount(h(Counter, { ref: counter }))
    await genie.call('react_clear_renders')
    const invalid = 'not state' as unknown as object
    let instrumented: unknown
    let unwrapped: unknown
    try {
      counter.current?.setState(invalid)
    } catch (error) {
      instrumented = error
    }
    try {
      originalSetState.call(counter.current, invalid)
    } catch (error) {
      unwrapped = error
    }

    await act(() => counter.current?.setState({ count: 3 }))

    expect(instrumented).toBeInstanceOf(Error)
    expect((instrumented as Error).message).toBe((unwrapped as Error).message)
    expect(updatesOf(await rendersOf('Counter')).map((update) => update.fields)).toEqual([
      ['count'],
    ])
  })

  it('leaves no lifecycle open after one throws, so the next update is not credited to it', async () => {
    const counter = createRef<Throwing>()
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
      override state = { failed: false }
      static getDerivedStateFromError() {
        return { failed: true }
      }
      override render(): ReactNode {
        return this.state.failed ? 'failed' : this.props.children
      }
    }
    class Throwing extends Component<object, { count: number }> {
      override state = { count: 0 }
      override componentDidUpdate() {
        if (this.state.count === 1) throw new Error('lifecycle failed')
      }
      override render(): ReactNode {
        return String(this.state.count)
      }
    }
    const other = createRef<Counter>()
    await mount(
      h('div', null, h(Boundary, null, h(Throwing, { ref: counter })), h(Counter, { ref: other })),
    )
    await genie.call('react_clear_renders')
    await act(() => counter.current?.setState({ count: 1 }))
    await act(
      () =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            other.current?.setState({ count: 5 })
            resolve()
          }, 0),
        ),
    )

    expect(updatesOf(await rendersOf('Counter'))).toEqual([
      expect.objectContaining({ phase: 'callback', fields: ['count'] }),
    ])
  })

  it('keeps the app frame and drops the wrapper frame from an error thrown in a wrapped lifecycle', async () => {
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
      override state = { failed: false }
      static getDerivedStateFromError() {
        return { failed: true }
      }
      override render(): ReactNode {
        return this.state.failed ? 'failed' : this.props.children
      }
    }
    class Rejecting extends Component<{ step: number }> {
      override UNSAFE_componentWillReceiveProps() {
        throw new Error('props rejected')
      }
      override render(): ReactNode {
        return String(this.props.step)
      }
    }
    const app = await mount(h(Boundary, null, h(Rejecting, { step: 0 })))
    await app.render(h(Boundary, null, h(Rejecting, { step: 1 })))

    const { caughtErrors } = await genie.call<{
      caughtErrors: {
        message: string | null
        stackFrames: { functionName: string | null; file: string | null }[]
      }[]
    }>('react_error_state', { appOnly: false, includeSource: true })
    const [failure] = caughtErrors.filter((entry) => entry.message === 'props rejected')
    const frames = failure?.stackFrames ?? []
    expect(failure).toBeDefined()
    expect(frames.filter((frame) => frame.file?.endsWith('/class-updates.ts'))).toEqual([])
    const methodFiles = frames
      .filter((frame) => frame.functionName?.includes('UNSAFE_componentWillReceiveProps'))
      .map((frame) => frame.file)
    expect(methodFiles.every((file) => file === THIS_FILE)).toBe(true)
  })

  it('leaves render unwrapped, so the owner stacks React records for elements carry no Genie frame', async () => {
    const counter = createRef<Counter>()
    const originalRender = Counter.prototype.render
    const app = await mount(h(Counter, { ref: counter }))
    await act(() => counter.current?.setState({ count: 4 }))

    const output = app.container.querySelector('output')
    const fiberKey = output
      ? Object.keys(output).find((key) => key.startsWith('__reactFiber'))
      : null
    const debugStack: unknown = fiberKey
      ? Reflect.get(Reflect.get(output as object, fiberKey) as object, '_debugStack')
      : undefined
    expect(Counter.prototype.render).toBe(originalRender)
    expect(String((debugStack as Error | undefined)?.stack ?? '')).not.toContain('genieLifecycle')
  })

  it('never fetches a source map from another origin for a caller, as Genie’s own client on a standalone hub is', async () => {
    const counter = createRef<Counter>()
    await mount(h(Counter, { ref: counter }))
    await genie.call('react_clear_renders')
    const fetches: string[] = []
    const realFetch = globalThis.fetch
    globalThis.fetch = (input, init) => {
      fetches.push(String(input instanceof Request ? input.url : input))
      return realFetch(input, init)
    }
    const fromHub = new Function(
      'counter',
      'counter.setState({ count: 9 })\n//# sourceURL=http://hub.invalid:4100/__genie/client.js',
    ) as (counter: Counter | null) => void
    try {
      await act(() => fromHub(counter.current))
      const updates = updatesOf(await rendersOf('Counter'))

      expect(updates).toEqual([
        expect.objectContaining({
          caller: expect.objectContaining({ file: '/__genie/client.js' }),
        }),
      ])
      expect(fetches.filter((url) => url.includes('hub.invalid'))).toEqual([])
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('puts back the methods it wrapped when tracking is disposed', () => {
    disposeRenderTracking()

    expect(Component.prototype.setState).toBe(originalSetState)
    expect(Component.prototype.forceUpdate).toBe(originalForceUpdate)
    expect(
      Object.getOwnPropertyDescriptor(DraftEditor.prototype, 'componentDidUpdate')?.value,
    ).toBe(draftEditorDidUpdate)
  })
})
