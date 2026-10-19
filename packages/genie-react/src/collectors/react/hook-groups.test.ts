// @vitest-environment jsdom

// biome-ignore-all lint/correctness/useHookAtTopLevel: fixtures break the rules of hooks on purpose to probe misaligned hook trees
import 'bippy/install-hook-only'
import { render } from '@testing-library/react'
import { type Fiber, getFiberFromHostInstance } from 'bippy'
import type { HooksNode } from 'bippy/source'
import {
  act,
  createContext,
  createElement,
  type FunctionComponent,
  useActionState,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MAX_HOOKS } from './contracts'
import { inspectFiber } from './fiber'
import { customHookChains } from './hook-groups'

let unmount: (() => void) | undefined

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  unmount?.()
  unmount = undefined
})

async function mountedFiber(component: FunctionComponent): Promise<Fiber> {
  const container = document.createElement('div')
  await act(async () => {
    unmount = render(createElement(component), { container }).unmount
  })
  const fiber = getFiberFromHostInstance(container.firstElementChild)?.return
  if (!fiber) throw new Error('component did not render a host element')
  return fiber
}

const Theme = createContext('light')

function useQuery(key: string): string {
  const [data] = useState(key)
  useEffect(() => {}, [])
  return data
}

function useCart(id: string): number {
  const data = useQuery(id)
  return useMemo(() => data.length, [data])
}

describe('react_inspect_component custom-hook grouping', () => {
  it('attributes each hook slot to its custom-hook chain across multi-slot primitives', async () => {
    function Cart() {
      const [open] = useState(false)
      useContext(Theme)
      const total = useCart('sku')
      useTransition()
      useSyncExternalStore(
        () => () => {},
        () => 1,
      )
      useActionState(async (state: number) => state, 0)
      const [count] = useState(0)
      return createElement('div', null, open, total, count)
    }

    const result = inspectFiber(await mountedFiber(Cart), { depth: 1 })

    expect(result.customHookGrouping).toBe('exact')
    const direct: string[] = []
    expect(result.hooks.map((hook) => hook.customHooks ?? direct)).toEqual([
      direct,
      ['useCart', 'useQuery'],
      ['useCart', 'useQuery'],
      ['useCart'],
      ...Array.from({ length: 2 + 2 + 3 + 1 }, () => direct),
    ])
    expect(result.hooks.slice(0, 4).map(({ kind, stateIndex }) => [kind, stateIndex])).toEqual([
      ['state', 0],
      ['state', 1],
      ['effect', undefined],
      ['memo', undefined],
    ])
  })

  it('reports unavailable and keeps the flat hooks when the hook inspector cannot re-render', async () => {
    let renders = 0
    function Fragile() {
      renders += 1
      if (renders > 1) throw new Error('render side effect')
      const [value] = useState(1)
      return createElement('div', null, value)
    }

    const result = inspectFiber(await mountedFiber(Fragile), { depth: 1 })

    expect(result.customHookGrouping).toBe('unavailable')
    expect(result.hooks).toEqual([expect.objectContaining({ kind: 'state', stateIndex: 0 })])
    expect(result.hooks[0]).not.toHaveProperty('customHooks')
  })

  it('reports partial when the hook inspector hides useEffectEvent', async () => {
    function Editor() {
      useEffectEvent(() => {})
      const total = useCart('draft')
      const [draft] = useState('')
      return createElement('div', null, total, draft)
    }

    const result = inspectFiber(await mountedFiber(Editor), { depth: 1 })

    expect(result.customHookGrouping).toBe('partial')
    expect(result.hooks.map((hook) => hook.customHooks)).toEqual([
      null,
      ['useCart', 'useQuery'],
      ['useCart', 'useQuery'],
      ['useCart'],
      undefined,
    ])
  })

  it('keeps hooks called repeatedly from one callsite direct and names helpers as written', async () => {
    function seedFields(): void {
      useRef(null)
    }
    function Fields() {
      for (let index = 0; index < 3; index++) useState(index)
      seedFields()
      return createElement('div')
    }

    const result = inspectFiber(await mountedFiber(Fields), { depth: 1 })

    expect(result.customHookGrouping).toBe('exact')
    expect(result.hooks.map((hook) => hook.customHooks)).toEqual([
      undefined,
      undefined,
      undefined,
      ['seedFields'],
    ])
  })

  it('reports unavailable when the shadow render takes a different hook path', async () => {
    let renders = 0
    function Conditional() {
      renders += 1
      useState(0)
      if (renders === 1) useRef(0)
      else useMemo(() => 0, [])
      return createElement('div')
    }

    const result = inspectFiber(await mountedFiber(Conditional), { depth: 1 })

    expect(result.customHookGrouping).toBe('unavailable')
  })

  it('groups the inspected prefix of a component past the hook cap', async () => {
    function Wide() {
      useCart('wide')
      for (let index = 0; index < MAX_HOOKS; index++) useState(index)
      return createElement('div')
    }

    const result = inspectFiber(await mountedFiber(Wide), { depth: 1 })

    expect(result.customHookGrouping).toBe('exact')
    expect(result.hooks).toHaveLength(MAX_HOOKS)
    expect(result.hooks[0]?.customHooks).toEqual(['useCart', 'useQuery'])
    expect(result.hooks.at(-1)).not.toHaveProperty('customHooks')
  })

  it('skips the shadow render for a component without hook slots', async () => {
    let renders = 0
    function Static() {
      renders += 1
      useContext(Theme)
      return createElement('div')
    }

    const result = inspectFiber(await mountedFiber(Static), { depth: 1 })

    expect(result.customHookGrouping).toBe('exact')
    expect(result.hooks).toEqual([])
    expect(renders).toBe(1)
  })
})

const primitive = (name: string, id: number | null): HooksNode => ({
  id,
  isStateEditable: false,
  name,
  value: undefined,
  subHooks: [],
  debugInfo: null,
  hookSource: null,
})
const custom = (name: string, subHooks: HooksNode[]): HooksNode => ({
  ...primitive(name, null),
  subHooks,
})

describe('customHookChains', () => {
  it('aligns the two-slot useDeferredValue of early React 18 releases', () => {
    const tree = [custom('Search', [primitive('DeferredValue', 0)]), primitive('State', 1)]

    expect(customHookChains(tree, ['state', 'effect', 'state'], false)).toEqual([
      ['useSearch'],
      ['useSearch'],
      [],
    ])
  })

  it('marks slots the hook tree skips by id as unknown', () => {
    const tree = [custom('Form', [primitive('State', 1)]), primitive('Ref', 2)]

    expect(customHookChains(tree, ['other', 'state', 'ref', 'other'], false)).toEqual([
      null,
      ['useForm'],
      [],
      null,
    ])
  })

  it('refuses to treat a typed slot as a hidden primitive', () => {
    expect(customHookChains([primitive('State', 1)], ['ref', 'state'], false)).toBeNull()
    expect(customHookChains([primitive('State', 0)], ['state', 'ref'], false)).toBeNull()
  })

  it('refuses a multi-slot primitive that overruns a complete hook list', () => {
    const tree = [primitive('State', 0), primitive('Transition', 1)]

    expect(customHookChains(tree, ['state', 'state'], false)).toBeNull()
  })

  it('refuses an alignment whose primitive disagrees with the slot kind', () => {
    const tree = [primitive('State', 0), primitive('Ref', 1)]

    expect(customHookChains(tree, ['ref', 'state'], false)).toBeNull()
  })

  it('aligns the prefix of a hook list truncated at the inspection cap', () => {
    const tree = [primitive('State', 0), primitive('Transition', 1), primitive('Ref', 2)]

    expect(customHookChains(tree, ['state', 'state'], true)).toEqual([[], []])
    expect(customHookChains(tree, ['state', 'state'], false)).toBeNull()
  })
})
