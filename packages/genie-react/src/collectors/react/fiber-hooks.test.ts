import { ClassComponentTag, type Fiber, FunctionComponentTag, type MemoizedState } from 'bippy'
import { describe, expect, it } from 'vitest'
import { classifyHook, type HookKind, inspectFiber, isStatefulHook } from './fiber'

// Fake fibers/hooks are structural stand-ins; one cast at the seam mirrors the existing collector tests' asFiber pattern.
const asHook = (shape: unknown): MemoizedState => shape as MemoizedState
const asFiber = (shape: unknown): Fiber => shape as Fiber

// Hook memoizedState shapes captured from a real React 19 render: state/reducer carry queue.dispatch (reducer name tells them apart); effect/layout carry {create,deps,tag}; memo/callback are [value,deps]; ref is {current}.
function basicStateReducer(): void {}
function userReducer(): void {}

type HookNode = { memoizedState: unknown; queue?: unknown; next: HookNode | null }

const stateHook = (value: unknown): HookNode => ({
  memoizedState: value,
  queue: { dispatch: () => {}, lastRenderedReducer: basicStateReducer },
  next: null,
})
const reducerHook = (value: unknown): HookNode => ({
  memoizedState: value,
  queue: { dispatch: () => {}, lastRenderedReducer: userReducer },
  next: null,
})
const effectHook = (): HookNode => ({
  memoizedState: { create: () => {}, deps: [], tag: 0b1001, inst: {} },
  next: null,
})
const layoutHook = (): HookNode => ({
  memoizedState: { create: () => {}, deps: [], tag: 0b0101, inst: {} },
  next: null,
})
const memoHook = (): HookNode => ({ memoizedState: [{ a: 1 }, []], next: null })
const callbackHook = (): HookNode => ({ memoizedState: [() => {}, []], next: null })
const refHook = (): HookNode => ({ memoizedState: { current: 7 }, next: null })
const otherHook = (value: unknown): HookNode => ({ memoizedState: value, next: null })

describe('classifyHook', () => {
  const kindOf = (node: HookNode): HookKind => classifyHook(asHook(node))

  it('distinguishes useState from useReducer by lastRenderedReducer name', () => {
    expect(kindOf(stateHook(0))).toBe('state')
    expect(kindOf(reducerHook({ step: 1 }))).toBe('reducer')
  })

  it('distinguishes useEffect from useLayoutEffect by the effect tag bit', () => {
    expect(kindOf(effectHook())).toBe('effect')
    expect(kindOf(layoutHook())).toBe('layout-effect')
  })

  it('distinguishes useMemo from useCallback by whether the memoized value is a function', () => {
    expect(kindOf(memoHook())).toBe('memo')
    expect(kindOf(callbackHook())).toBe('callback')
  })

  it('recognizes a single-key {current} ref, and falls back to other', () => {
    expect(kindOf(refHook())).toBe('ref')
    expect(kindOf(otherHook(null))).toBe('other')
    expect(kindOf(otherHook('a string'))).toBe('other')
    expect(kindOf(otherHook(42))).toBe('other')
  })

  it('never treats a memo/callback array as a ref (array checked before {current})', () => {
    expect(kindOf({ memoizedState: [{ current: 1 }, []], next: null })).toBe('memo')
  })
})

describe('isStatefulHook', () => {
  const predicate = (node: HookNode): boolean => isStatefulHook(asHook(node))

  it('is true only for hooks carrying a dispatch queue', () => {
    expect(predicate(stateHook(0))).toBe(true)
    expect(predicate(reducerHook(0))).toBe(true)
    expect(predicate(effectHook())).toBe(false)
    expect(predicate(memoHook())).toBe(false)
    expect(predicate(refHook())).toBe(false)
  })
})

const chain = (nodes: HookNode[]): HookNode | null => {
  for (let i = 0; i < nodes.length - 1; i++) {
    const node = nodes[i]
    if (node) node.next = nodes[i + 1] ?? null
  }
  return nodes[0] ?? null
}

const functionFiber = (head: HookNode | null): Fiber => {
  const type = (): null => null
  Object.defineProperty(type, 'name', { value: 'Widget' })
  return asFiber({ tag: FunctionComponentTag, type, memoizedState: head, memoizedProps: {} })
}

describe('inspectFiber hook entries', () => {
  it('labels every hook and numbers stateful hooks by their own ordinal', () => {
    const fiber = functionFiber(
      chain([stateHook(false), effectHook(), reducerHook({ step: 1 }), refHook()]),
    )
    const { hooks } = inspectFiber(fiber, { depth: 2 })
    expect(hooks.map((h) => h.kind)).toEqual(['state', 'effect', 'reducer', 'ref'])
    expect(hooks.map((h) => h.stateful)).toEqual([true, false, true, false])
    expect(hooks.map((h) => h.stateIndex)).toEqual([0, undefined, 1, undefined])
  })

  it('surfaces deps (not internals) for effect hooks and value for stateful hooks', () => {
    const fiber = functionFiber(chain([stateHook(5), effectHook()]))
    const { hooks } = inspectFiber(fiber, { depth: 2 })
    expect(hooks[0]).toMatchObject({
      index: 0,
      kind: 'state',
      stateful: true,
      stateIndex: 0,
      value: 5,
    })
    expect(hooks[1]).toMatchObject({ index: 1, kind: 'effect', stateful: false })
    expect(hooks[1]).toHaveProperty('deps')
    expect(hooks[1]).not.toHaveProperty('value')
  })

  it('reports no hooks for a class component', () => {
    const fiber = asFiber({
      tag: ClassComponentTag,
      type: function Classy() {},
      memoizedProps: {},
      stateNode: { state: { a: 1 } },
    })
    expect(inspectFiber(fiber, { depth: 2 }).hooks).toEqual([])
  })
})
