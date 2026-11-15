// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { act, render } from '@testing-library/react'
import {
  createContext,
  createElement as h,
  Suspense,
  use,
  useActionState,
  useContext,
  useState,
} from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { reactCollectorHarness } from '../../test-support/react-collector'

const { call, start, stop } = reactCollectorHarness()

interface Cleared {
  cleared: { kind: string; componentName: string; outcome: string }[]
}
interface Listed {
  overrides: { kind: string; componentName: string; detail: string; mounted: boolean }[]
}

const text = (id: string) => document.getElementById(id)?.textContent ?? null

async function idOf(component: string): Promise<number> {
  const found = await call<{ matches: { id: number }[] }>('react_find_components', {
    component,
    exact: true,
  })
  const [match] = found.matches
  if (!match) throw new Error(`${component} is not mounted`)
  return match.id
}

const apply = (tool: string, input: Record<string, unknown>) =>
  act(async () => {
    await call(tool, input)
  })

async function reset(): Promise<Cleared['cleared']> {
  let cleared: Cleared['cleared'] = []
  await act(async () => {
    cleared = (await call<Cleared>('react_reset_overrides', {})).cleared
  })
  return cleared
}

let increment: () => void = () => {}
let setParentLabel: (label: string) => void = () => {}
let setShowCounter: (show: boolean) => void = () => {}

function Counter() {
  const [count, setCount] = useState(0)
  const [label] = useState('real')
  increment = () => setCount((value) => value + 1)
  return h('output', { id: 'counter' }, `${count}|${label}`)
}

function Badge(props: { tone: string }) {
  const [size] = useState('small')
  return h('em', { id: 'badge' }, `${props.tone}|${size}`)
}

function Shelf() {
  return h('section', null, h(Badge, { tone: 'calm' }))
}

function Title(props: { label: string; extra?: string }) {
  return h('h1', { id: 'title' }, `${props.label}|${'extra' in props ? 'has-extra' : 'no-extra'}`)
}

const Mode = createContext('default-mode')
Mode.displayName = 'Mode'
function ModeReader() {
  return h('b', { id: 'mode' }, useContext(Mode))
}

function Form() {
  const [state] = useActionState(async (previous: string) => `${previous}!`, 'idle')
  return h('p', { id: 'form' }, state)
}

let resolveData: (value: string) => void = () => {}
const data = new Promise<string>((resolve) => {
  resolveData = resolve
})
function Data() {
  return h('p', { id: 'data' }, use(data))
}

function Parent() {
  const [label, setLabel] = useState('L0')
  const [showCounter, setShow] = useState(true)
  setParentLabel = setLabel
  setShowCounter = setShow
  return h(
    'div',
    null,
    h(Title, { label }),
    h(Shelf),
    h(Mode.Provider, { value: label }, h(ModeReader)),
    showCounter ? h(Counter) : null,
    h(Form),
    h(Suspense, { fallback: h('i', { id: 'fallback' }, 'loading') }, h(Data)),
  )
}

let unmount: (() => void) | undefined

beforeAll(async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  start()
  const container = document.createElement('div')
  container.id = 'root'
  document.body.append(container)
  await act(async () => {
    unmount = render(h(Parent), { container }).unmount
  })
  await act(async () => {
    resolveData('loaded')
    await data
  })
})

afterEach(async () => {
  await reset()
  await act(async () => {
    setParentLabel('L0')
    setShowCounter(true)
  })
})

afterAll(() => {
  unmount?.()
  stop()
})

describe('hook state overrides', () => {
  it('restores both hooks when two hooks of one component were overridden', async () => {
    const id = await idOf('Counter')
    await apply('react_override_hook_state', { id, stateIndex: 0, value: 5 })
    await apply('react_override_hook_state', { id, stateIndex: 1, value: 'forced' })
    expect(text('counter')).toBe('5|forced')
    expect(
      (await call<Listed>('react_list_overrides', {})).overrides.map((entry) => entry.detail),
    ).toEqual(['hook 0 ← 5', 'hook 1 ← "forced"'])

    expect((await reset()).map((entry) => entry.outcome)).toEqual(['restored', 'restored'])
    expect(text('counter')).toBe('0|real')
  })

  it('leaves state alone once the component has set it again', async () => {
    const id = await idOf('Counter')
    await apply('react_override_hook_state', { id, stateIndex: 0, value: 50 })
    await act(async () => increment())
    expect(text('counter')).toBe('51|real')

    expect((await reset()).map((entry) => entry.outcome)).toEqual(['superseded'])
    expect(text('counter')).toBe('51|real')
  })

  it('refuses the action slot of useActionState, which holds the app action', async () => {
    const id = await idOf('Form')
    await expect(
      call('react_override_hook_state', { id, stateIndex: 1, value: null }),
    ).rejects.toThrow(/cannot be overridden/)
    await apply('react_override_hook_state', { id, stateIndex: 0, value: 'forced' })
    expect(text('form')).toBe('forced')
  })

  it('keeps the row of an unmounted target until reset, without touching the remount', async () => {
    const id = await idOf('Counter')
    await apply('react_override_hook_state', { id, stateIndex: 0, value: 9 })
    await act(async () => setShowCounter(false))
    expect((await call<Listed>('react_list_overrides', {})).overrides).toEqual([
      expect.objectContaining({ kind: 'hook', componentName: 'Counter', mounted: false }),
    ])
    await act(async () => setShowCounter(true))
    expect(text('counter')).toBe('0|real')
    expect((await reset()).map((entry) => entry.outcome)).toEqual(['released'])
    expect(text('counter')).toBe('0|real')
  })
})

describe('props overrides', () => {
  it('restores the exact props, removing a key the parent never passed', async () => {
    const id = await idOf('Title')
    await apply('react_override_props', { id, props: { label: 'FORCED', extra: 'x' } })
    expect(text('title')).toBe('FORCED|has-extra')

    expect((await reset()).map((entry) => entry.outcome)).toEqual(['restored'])
    expect(text('title')).toBe('L0|no-extra')
  })

  it('does not write stale props back after the parent re-rendered', async () => {
    const id = await idOf('Title')
    await apply('react_override_props', { id, props: { label: 'FORCED' } })
    await act(async () => setParentLabel('L1'))
    expect(text('title')).toBe('L1|no-extra')

    expect((await reset()).map((entry) => entry.outcome)).toEqual(['superseded'])
    expect(text('title')).toBe('L1|no-extra')
  })
})

describe('overrides on a component that bailed out of later commits', () => {
  it('restores a props override after an unrelated commit left its return path on the old buffer', async () => {
    const id = await idOf('Badge')
    await apply('react_override_props', { id, props: { tone: 'loud' } })
    await act(async () => increment())
    expect(text('badge')).toBe('loud|small')
    expect((await call<Listed>('react_list_overrides', {})).overrides).toEqual([
      expect.objectContaining({ kind: 'props', componentName: 'Badge', mounted: true }),
    ])

    expect((await reset()).map((entry) => entry.outcome)).toEqual(['restored'])
    expect(text('badge')).toBe('calm|small')
    expect((await call<Listed>('react_list_overrides', {})).overrides).toEqual([])
  })

  it('restores a hook override after an unrelated commit left its return path on the old buffer', async () => {
    const id = await idOf('Badge')
    await apply('react_override_hook_state', { id, stateIndex: 0, value: 'large' })
    await act(async () => increment())
    expect(text('badge')).toBe('calm|large')

    expect((await reset()).map((entry) => entry.outcome)).toEqual(['restored'])
    expect(text('badge')).toBe('calm|small')
  })

  it('still reports a props override as skipped once its component is really gone', async () => {
    const id = await idOf('Counter')
    await apply('react_override_props', { id, props: { tone: 'gone' } })
    await act(async () => setShowCounter(false))
    expect((await call<Listed>('react_list_overrides', {})).overrides).toEqual([
      expect.objectContaining({ kind: 'props', componentName: 'Counter', mounted: false }),
    ])
    expect((await reset()).map((entry) => entry.outcome)).toEqual(['skipped-unmounted'])
  })
})

describe('context overrides', () => {
  it('restores the Provider value', async () => {
    await apply('react_override_context', { id: await idOf('ModeReader'), value: 'forced' })
    expect(text('mode')).toBe('forced')
    expect((await reset()).map((entry) => entry.outcome)).toEqual(['restored'])
    expect(text('mode')).toBe('L0')
  })

  it('does not write a stale value back after the Provider re-rendered', async () => {
    await apply('react_override_context', { id: await idOf('ModeReader'), value: 'forced' })
    await act(async () => setParentLabel('L2'))
    expect((await reset()).map((entry) => entry.outcome)).toEqual(['superseded'])
    expect(text('mode')).toBe('L2')
    expect(text('title')).toBe('L2|no-extra')
  })
})

describe('react_toggle_suspense_fallback', () => {
  it('names the boundary and restores the resolved content', async () => {
    await apply('react_toggle_suspense_fallback', { id: await idOf('Data') })
    expect(text('fallback')).toBe('loading')
    expect((await call<Listed>('react_list_overrides', {})).overrides).toEqual([
      expect.objectContaining({ kind: 'suspense', componentName: 'Suspense', mounted: true }),
    ])

    expect(await reset()).toEqual([
      { kind: 'suspense', componentName: 'Suspense', outcome: 'released' },
    ])
    expect(text('fallback')).toBeNull()
    expect(text('data')).toBe('loaded')
    expect(document.getElementById('data')?.style.display).toBe('')
  })
})
