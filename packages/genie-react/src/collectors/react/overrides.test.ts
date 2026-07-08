import { ClassComponentTag, type Fiber, FunctionComponentTag, SuspenseComponentTag } from 'bippy'
import { beforeEach, describe, expect, it } from 'vitest'
import { hookChain, isStatefulHook } from './fiber'
import {
  applyContextOverride,
  applyErrorOverride,
  applyHookStateOverride,
  applySuspenseOverride,
  type DevRenderer,
  findErrorBoundary,
  findSuspenseBoundary,
  isErrorBoundaryFiber,
  listOverrides,
  overrideFiberProps,
  pruneUnmountedOverrides,
  resetOverrides,
  resolveContextProvider,
} from './overrides'

const CONTEXT_PROVIDER_TAG = 10

const fiber = (over: Record<string, unknown> = {}): Fiber =>
  ({
    tag: FunctionComponentTag,
    type: function Component() {},
    return: null,
    alternate: null,
    memoizedState: null,
    dependencies: null,
    stateNode: null,
    ...over,
  }) as unknown as Fiber

function fakeRenderer() {
  const scheduled: Fiber[] = []
  const hookCalls: Array<[Fiber, string, string[], unknown]> = []
  const propsCalls: Array<[Fiber, string[], unknown]> = []
  let suspenseHandler: ((instance: unknown) => boolean) | null = null
  let errorHandler: ((f: Fiber) => boolean) | null = null
  const renderer: DevRenderer = {
    scheduleUpdate: (f) => void scheduled.push(f),
    setSuspenseHandler: (h) => {
      suspenseHandler = h
    },
    setErrorHandler: (h) => {
      errorHandler = h
    },
    overrideHookState: (f, id, path, value) => void hookCalls.push([f, id, path, value]),
    overrideProps: (f, path, value) => void propsCalls.push([f, path, value]),
  }
  return {
    renderer,
    scheduled,
    hookCalls,
    propsCalls,
    suspense: (instance: unknown) => suspenseHandler?.(instance),
    error: (f: Fiber) => errorHandler?.(f),
  }
}

describe('findSuspenseBoundary / findErrorBoundary', () => {
  it('walks up to the nearest Suspense fiber, or null', () => {
    const boundary = fiber({ tag: SuspenseComponentTag, type: undefined })
    const child = fiber({ return: boundary })
    expect(findSuspenseBoundary(child)).toBe(boundary)
    expect(findSuspenseBoundary(boundary)).toBe(boundary)
    expect(findSuspenseBoundary(fiber())).toBeNull()
  })

  it('recognizes error boundaries by static getDerivedStateFromError or componentDidCatch', () => {
    const viaStatic = fiber({
      tag: ClassComponentTag,
      type: Object.assign(function Boundary() {}, { getDerivedStateFromError: () => ({}) }),
    })
    const viaInstance = fiber({
      tag: ClassComponentTag,
      type: function Catcher() {},
      stateNode: { componentDidCatch: () => {} },
    })
    const plainClass = fiber({ tag: ClassComponentTag, type: function Plain() {} })
    expect(isErrorBoundaryFiber(viaStatic)).toBe(true)
    expect(isErrorBoundaryFiber(viaInstance)).toBe(true)
    expect(isErrorBoundaryFiber(plainClass)).toBe(false)
    expect(isErrorBoundaryFiber(fiber())).toBe(false)

    const child = fiber({ return: viaStatic })
    expect(findErrorBoundary(child)).toBe(viaStatic)
    expect(findErrorBoundary(fiber())).toBeNull()
  })
})

describe('applySuspenseOverride', () => {
  it('throws with an actionable message when no boundary exists', () => {
    const { renderer } = fakeRenderer()
    expect(() => applySuspenseOverride(fiber(), true, renderer)).toThrow(/No <Suspense> boundary/)
  })

  it('forces and releases a boundary, matching both fiber buffers', () => {
    const harness = fakeRenderer()
    const alternate = fiber({ tag: SuspenseComponentTag, type: undefined })
    const boundary = fiber({ tag: SuspenseComponentTag, type: undefined, alternate })
    Object.assign(alternate, { alternate: boundary })
    const inside = fiber({ return: boundary })

    const forced = applySuspenseOverride(inside, true, harness.renderer)
    expect(forced.boundary).toBe(boundary)
    expect(forced.active).toBe(1)
    expect(harness.scheduled).toContain(boundary)
    expect(harness.suspense(boundary)).toBe(true)
    expect(harness.suspense(alternate)).toBe(true)
    expect(harness.suspense(fiber({ tag: SuspenseComponentTag, type: undefined }))).toBe(false)

    // Idempotent: forcing again does not double-count the boundary.
    expect(applySuspenseOverride(boundary, true, harness.renderer).active).toBe(1)

    const released = applySuspenseOverride(alternate, false, harness.renderer)
    expect(released.active).toBe(0)
    expect(harness.suspense(boundary)).toBe(false)
  })

  it('releasing a boundary that was never forced is a no-op (no re-render)', () => {
    const harness = fakeRenderer()
    const boundary = fiber({ tag: SuspenseComponentTag, type: undefined })
    const before = harness.scheduled.length
    const result = applySuspenseOverride(boundary, false, harness.renderer)
    expect(harness.scheduled.length).toBe(before)
    expect(result.boundary).toBe(boundary)
  })
})

describe('applyErrorOverride', () => {
  const boundaryFiber = () =>
    fiber({
      tag: ClassComponentTag,
      type: Object.assign(function Boundary() {}, { getDerivedStateFromError: () => ({}) }),
    })

  it('throws with an actionable message when no boundary exists', () => {
    const { renderer } = fakeRenderer()
    expect(() => applyErrorOverride(fiber(), true, renderer)).toThrow(/No error boundary/)
  })

  it('forces, then releases with a one-shot false that self-clears', () => {
    const harness = fakeRenderer()
    const boundary = boundaryFiber()
    const inside = fiber({ return: boundary })

    const forced = applyErrorOverride(inside, true, harness.renderer)
    expect(forced.boundary).toBe(boundary)
    expect(forced.active).toBe(1)
    expect(harness.error(boundary)).toBe(true)
    expect(harness.error(boundaryFiber())).toBeNull()

    const released = applyErrorOverride(boundary, false, harness.renderer)
    expect(released.active).toBe(0)
    expect(harness.error(boundary)).toBe(false)
    expect(harness.error(boundary)).toBeNull()
  })

  it('releasing a boundary that was never forced is a no-op (no reset re-render)', () => {
    const harness = fakeRenderer()
    const boundary = boundaryFiber()
    const before = harness.scheduled.length
    applyErrorOverride(boundary, false, harness.renderer)
    expect(harness.scheduled.length).toBe(before)
    expect(harness.error(boundary)).toBeNull()
  })
})

describe('applyHookStateOverride', () => {
  // React names useState's internal reducer basicStateReducer; classifyHook keys 'state' vs 'reducer' off that name.
  function basicStateReducer(): void {}
  const stateHook = (value: unknown, next: unknown = null) => ({
    memoizedState: value,
    queue: { dispatch: () => {}, lastRenderedReducer: basicStateReducer },
    next,
  })
  const effectHook = (next: unknown = null) => ({
    memoizedState: { create: () => {}, deps: [], tag: 0b1001 },
    queue: null,
    next,
  })

  it('validates the component kind, hook index, and hook kind', () => {
    const { renderer } = fakeRenderer()
    const classFiber = fiber({ tag: ClassComponentTag, type: function Classy() {} })
    expect(() => applyHookStateOverride(classFiber, { hookIndex: 0 }, [], 1, renderer)).toThrow(
      /class component/,
    )

    const hookless = fiber()
    expect(() => applyHookStateOverride(hookless, { hookIndex: 0 }, [], 1, renderer)).toThrow(
      /has no hooks/,
    )

    const oneHook = fiber({ memoizedState: stateHook(0) })
    expect(() => applyHookStateOverride(oneHook, { hookIndex: 3 }, [], 1, renderer)).toThrow(
      /hook 3 does not exist/,
    )

    const withEffect = fiber({ memoizedState: stateHook(0, effectHook()) })
    expect(() => applyHookStateOverride(withEffect, { hookIndex: 1 }, [], 1, renderer)).toThrow(
      /not a stateful hook/,
    )
  })

  it('forwards to the renderer with a string hook id and string path (by hookIndex)', () => {
    const harness = fakeRenderer()
    const target = fiber({ memoizedState: stateHook(0, stateHook({ page: 1 })) })
    const resolved = applyHookStateOverride(
      target,
      { hookIndex: 1 },
      ['filters', 0],
      'dark',
      harness.renderer,
    )
    expect(resolved).toEqual({ flatIndex: 1, stateIndex: 1 })
    expect(harness.hookCalls).toEqual([[target, '1', ['filters', '0'], 'dark']])
  })

  it('resolves a stateIndex to its flat hook index, skipping non-stateful hooks', () => {
    const harness = fakeRenderer()
    const target = fiber({ memoizedState: stateHook(0, effectHook(stateHook('x'))) })
    const resolved = applyHookStateOverride(target, { stateIndex: 1 }, [], 'y', harness.renderer)
    expect(resolved).toEqual({ flatIndex: 2, stateIndex: 1 })
    expect(harness.hookCalls).toEqual([[target, '2', [], 'y']])
  })

  it('enumerates the stateful hooks (flat index, stateIndex, kind, value) in every error', () => {
    const { renderer } = fakeRenderer()
    const target = fiber({ memoizedState: stateHook(false, effectHook(stateHook({ step: 1 }))) })
    expect(() => applyHookStateOverride(target, { stateIndex: 9 }, [], 1, renderer)).toThrow(
      /\[0\] state stateIndex 0 value=false.*\[2\] .* stateIndex 1 value=\{step:1\}/,
    )
  })

  it('hookChain and isStatefulHook classify the memoizedState list', () => {
    const chainHead = stateHook(0, effectHook(stateHook('x')))
    const target = fiber({ memoizedState: chainHead })
    const hooks = hookChain(target)
    expect(hooks).toHaveLength(3)
    expect(hooks.map((hook) => isStatefulHook(hook))).toEqual([true, false, true])
  })
})

describe('overrideFiberProps / applyContextOverride', () => {
  it('applies a multi-key partial in one renderer call, merged over current props', () => {
    const harness = fakeRenderer()
    const target = fiber({ memoizedProps: { a: 1, b: 2, children: 'kids' } })
    overrideFiberProps(target, { b: 3, c: 4 }, harness.renderer)
    expect(harness.propsCalls).toEqual([[target, [], { a: 1, b: 3, c: 4, children: 'kids' }]])
  })

  it('shallow-merges a plain-object context value and replaces any other value', () => {
    const themeContext = { displayName: 'Theme' }
    const providerOf = () =>
      fiber({
        tag: CONTEXT_PROVIDER_TAG,
        type: { _context: themeContext },
        memoizedProps: { value: { theme: 'light', locale: 'en' }, children: 'kids' },
      })

    const merged = fakeRenderer()
    const provider = providerOf()
    applyContextOverride(provider, undefined, { theme: 'dark' }, merged.renderer)
    expect(merged.propsCalls).toEqual([
      [provider, [], { value: { theme: 'dark', locale: 'en' }, children: 'kids' }],
    ])

    const replaced = fakeRenderer()
    const provider2 = providerOf()
    applyContextOverride(provider2, undefined, 'dark', replaced.renderer)
    expect(replaced.propsCalls).toEqual([[provider2, [], { value: 'dark', children: 'kids' }]])
  })
})

describe('resolveContextProvider', () => {
  const themeContext = { displayName: 'Theme' }
  const localeContext = { displayName: 'Locale' }

  const consumerOf = (contexts: unknown[], parent: Fiber | null = null): Fiber => {
    let firstContext: unknown = null
    for (let i = contexts.length - 1; i >= 0; i--) {
      firstContext = { context: contexts[i], memoizedValue: null, next: firstContext }
    }
    return fiber({ type: function Consumer() {}, dependencies: { firstContext }, return: parent })
  }

  it('resolves the nearest matching provider for React ≤18 (type._context) and 19 (type is the context)', () => {
    const legacyProvider = fiber({ tag: CONTEXT_PROVIDER_TAG, type: { _context: themeContext } })
    const legacyConsumer = consumerOf([themeContext], legacyProvider)
    expect(resolveContextProvider(legacyConsumer).provider).toBe(legacyProvider)
    expect(resolveContextProvider(legacyConsumer).contextName).toBe('Theme')

    const modernProvider = fiber({ tag: CONTEXT_PROVIDER_TAG, type: themeContext })
    const modernConsumer = consumerOf([themeContext], modernProvider)
    expect(resolveContextProvider(modernConsumer).provider).toBe(modernProvider)
  })

  it('uses a provider fiber directly when one is passed', () => {
    const provider = fiber({ tag: CONTEXT_PROVIDER_TAG, type: { _context: localeContext } })
    const match = resolveContextProvider(provider)
    expect(match.provider).toBe(provider)
    expect(match.contextName).toBe('Locale')
  })

  it('demands a context name when several are consumed, and validates it', () => {
    const provider = fiber({ tag: CONTEXT_PROVIDER_TAG, type: { _context: localeContext } })
    const consumer = consumerOf([themeContext, localeContext], provider)
    expect(() => resolveContextProvider(consumer)).toThrow(/pass `context` to pick one/)
    expect(() => resolveContextProvider(consumer, 'Nope')).toThrow(/does not consume a context/)
    expect(resolveContextProvider(consumer, 'Locale').provider).toBe(provider)
  })

  it('explains default-value contexts and context-free components', () => {
    expect(() => resolveContextProvider(consumerOf([themeContext]))).toThrow(
      /running on its default value/,
    )
    expect(() => resolveContextProvider(fiber({ type: function Bare() {} }))).toThrow(
      /consumes no contexts/,
    )
  })
})

describe('override registry (list / reset)', () => {
  function basicStateReducer(): void {}
  const stateHook = (value: unknown, next: unknown = null) => ({
    memoizedState: value,
    queue: { dispatch: () => {}, lastRenderedReducer: basicStateReducer },
    next,
  })
  const errorBoundary = () =>
    fiber({
      tag: ClassComponentTag,
      type: Object.assign(function Boundary() {}, { getDerivedStateFromError: () => ({}) }),
    })

  // Registry + forced sets are module state; clear them before every test (no DOM here, so nothing is "mounted").
  beforeEach(() => resetOverrides(fakeRenderer().renderer))

  it('records a props override with its overridden keys and prior values', () => {
    const harness = fakeRenderer()
    overrideFiberProps(
      fiber({ type: function Panel() {}, memoizedProps: { title: 'Activities', open: false } }),
      { title: 'GENIE OVERRIDE' },
      harness.renderer,
    )
    const { overrides, total } = listOverrides()
    expect(total).toBe(1)
    expect(overrides[0]?.kind).toBe('props')
    expect(overrides[0]?.detail).toContain('title="GENIE OVERRIDE"')
    expect(overrides[0]?.detail).toContain('was "Activities"')
    expect(overrides[0]?.mounted).toBe(false)
    expect(overrides[0]?.componentId).toBeNull()
  })

  it('keeps the FIRST captured original when the same prop is overridden twice', () => {
    const harness = fakeRenderer()
    const target = fiber({ type: function Panel() {}, memoizedProps: { title: 'A' } })
    overrideFiberProps(target, { title: 'B' }, harness.renderer)
    Object.assign(target, { memoizedProps: { title: 'B' } })
    overrideFiberProps(target, { title: 'C' }, harness.renderer)
    const { overrides, total } = listOverrides()
    expect(total).toBe(1)
    expect(overrides[0]?.detail).toContain('title="C"')
    expect(overrides[0]?.detail).toContain('was "A"')
  })

  it('keeps the FIRST context original across re-overrides and shows the new value', () => {
    const harness = fakeRenderer()
    const context = { displayName: 'Theme' }
    const provider = fiber({
      tag: CONTEXT_PROVIDER_TAG,
      type: context,
      memoizedProps: { value: 'light' },
    })
    applyContextOverride(provider, undefined, 'dark', harness.renderer)
    Object.assign(provider, { memoizedProps: { value: 'dark' } })
    applyContextOverride(provider, undefined, 'dusk', harness.renderer)
    const { overrides, total } = listOverrides()
    expect(total).toBe(1)
    expect(overrides[0]?.detail).toBe('Theme value ← "dusk" (was "light")')
  })

  it('releases the fiber and restore of a pruned entry but keeps it listed until reset', () => {
    const harness = fakeRenderer()
    const target = fiber({ type: function Gone() {}, memoizedProps: { x: 1 } })
    overrideFiberProps(target, { x: 2 }, harness.renderer)
    pruneUnmountedOverrides(target)
    const { overrides, total } = listOverrides()
    expect(total).toBe(1)
    expect(overrides[0]?.mounted).toBe(false)
    const { cleared, remaining } = resetOverrides(harness.renderer)
    expect(cleared[0]?.outcome).toBe('skipped-unmounted')
    expect(remaining).toBe(0)
  })

  it('records a hook override and re-uses one entry per (kind, fiber)', () => {
    const harness = fakeRenderer()
    const target = fiber({ type: function Wizard() {}, memoizedState: stateHook(false) })
    applyHookStateOverride(target, { hookIndex: 0 }, [], true, harness.renderer)
    applyHookStateOverride(target, { hookIndex: 0 }, [], false, harness.renderer)
    const { overrides } = listOverrides()
    expect(overrides.filter((o) => o.kind === 'hook')).toHaveLength(1)
    expect(overrides[0]?.detail).toBe('hook 0 ← false')
  })

  it('lists forced suspense / error and drops them on a release-shaped apply', () => {
    const harness = fakeRenderer()
    const suspense = fiber({ tag: SuspenseComponentTag, type: undefined })
    const errorB = errorBoundary()
    applySuspenseOverride(fiber({ return: suspense }), true, harness.renderer)
    applyErrorOverride(fiber({ return: errorB }), true, harness.renderer)
    expect(
      listOverrides()
        .overrides.map((o) => o.kind)
        .sort(),
    ).toEqual(['error', 'suspense'])

    applySuspenseOverride(suspense, false, harness.renderer)
    expect(listOverrides().overrides.map((o) => o.kind)).toEqual(['error'])
    applyErrorOverride(errorB, false, harness.renderer)
    expect(listOverrides().total).toBe(0)
  })

  it('reset clears everything, reporting an outcome per override and remaining 0', () => {
    const harness = fakeRenderer()
    overrideFiberProps(
      fiber({ type: function A() {}, memoizedProps: { x: 1 } }),
      { x: 2 },
      harness.renderer,
    )
    applyHookStateOverride(
      fiber({ type: function B() {}, memoizedState: stateHook(0) }),
      { hookIndex: 0 },
      [],
      9,
      harness.renderer,
    )
    applySuspenseOverride(
      fiber({ return: fiber({ tag: SuspenseComponentTag, type: undefined }) }),
      true,
      harness.renderer,
    )

    const result = resetOverrides(harness.renderer)
    expect(result.ok).toBe(true)
    expect(result.remaining).toBe(0)
    expect(listOverrides().total).toBe(0)
    const outcomes = Object.fromEntries(result.cleared.map((c) => [c.kind, c.outcome]))
    // No DOM ⇒ props target is unmounted (skipped); hook is always released; a forced suspense boundary releases from module state.
    expect(outcomes.props).toBe('skipped-unmounted')
    expect(outcomes.hook).toBe('released')
    expect(outcomes.suspense).toBe('released')
  })

  it('releases a forced error boundary from module state even when its id no longer resolves (stuck-case recovery)', () => {
    const harness = fakeRenderer()
    const boundary = errorBoundary()
    applyErrorOverride(fiber({ return: boundary }), true, harness.renderer)
    expect(harness.error(boundary)).toBe(true)

    const result = resetOverrides(harness.renderer)
    expect(result.cleared.map((c) => c.kind)).toEqual(['error'])
    // The self-clearing false was written, so the next handler read resets then reverts to "no override".
    expect(harness.error(boundary)).toBe(false)
    expect(harness.error(boundary)).toBeNull()
    expect(listOverrides().total).toBe(0)
  })
})
