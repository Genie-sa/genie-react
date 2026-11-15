// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { act, render } from '@testing-library/react'
import {
  createElement as h,
  startTransition,
  useActionState,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { reactCollectorHarness } from '../../test-support/react-collector'

const { call, start, stop } = reactCollectorHarness()

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  start()
})
afterAll(stop)

interface HookEntry {
  index: number
  kind: string
  hook?: string
  stateful: boolean
  stateIndex?: number
  value?: unknown
}

interface StateCause {
  kind: 'state'
  hook?: { index: number; stateIndex: number | null; kind: string }
}
interface ExternalStoreCause {
  kind: 'external-store'
  hookIndex: number
}
interface UnknownCause {
  kind: 'unknown'
  reason: string
  hookIndex?: number
}
type Cause = StateCause | ExternalStoreCause | UnknownCause | { kind: string }

const store = { value: 0, listeners: new Set<() => void>() }
const subscribe = (listener: () => void) => {
  store.listeners.add(listener)
  return () => store.listeners.delete(listener)
}
function setStore(value: number) {
  store.value = value
  for (const listener of store.listeners) listener()
}

let finishTransition: () => void = () => {}
const triggers: Record<string, () => void> = {}

function EveryHook() {
  const id = useId()
  const [count, setCount] = useState(0)
  const [total, dispatch] = useReducer((value: number, delta: number) => value + delta, 10)
  const ref = useRef<{ focus: () => void }>(null)
  const [isPending, startPending] = useTransition()
  const deferred = useDeferredValue(count)
  const external = useSyncExternalStore(subscribe, () => store.value)
  const [optimistic, addOptimistic] = useOptimistic(total, (value: number, delta: number) => value + delta)
  const [actionState, runAction] = useActionState((state: number) => state + 1, 3)
  const doubled = useMemo(() => count * 2, [count])
  const onClick = useCallback(() => count, [count])
  useImperativeHandle(ref, () => ({ focus() {} }), [])
  useInsertionEffect(() => {}, [count])
  useLayoutEffect(() => {}, [total])
  useEffect(() => {}, [external])
  // The hook inspector re-runs this body with stand-in setters but never runs effects, so the real setters are published from one.
  useLayoutEffect(() => {
    triggers.useState = () => setCount((value) => value + 1)
    triggers.useReducer = () => dispatch(1)
    triggers.useSyncExternalStore = () => setStore(store.value + 1)
    triggers.useActionState = () => startTransition(() => runAction())
    triggers.useOptimistic = () =>
      startTransition(async () => {
        addOptimistic(5)
        await new Promise<void>((resolve) => {
          finishTransition = resolve
        })
      })
    triggers.useTransition = () =>
      startPending(async () => {
        await new Promise<void>((resolve) => {
          finishTransition = resolve
        })
      })
  })
  void onClick
  return h(
    'p',
    null,
    [id, count, total, isPending, deferred, external, optimistic, actionState, doubled].join('|'),
  )
}

let unmount: (() => void) | null = null

afterEach(() => {
  unmount?.()
  unmount = null
})

async function mounted(): Promise<number> {
  unmount = render(h(EveryHook)).unmount
  const found = await call<{ matches: { id: number }[] }>('react_find_components', {
    component: 'EveryHook',
    exact: true,
  })
  const id = found.matches[0]?.id
  if (id === undefined) throw new Error('EveryHook is not mounted')
  return id
}

async function hooksOf(id: number): Promise<HookEntry[]> {
  return (await call<{ hooks: HookEntry[] }>('react_inspect_component', { id })).hooks
}

async function causesAfter(trigger: () => void | Promise<void>): Promise<Cause[]> {
  await call('react_clear_renders', { budget: { timeLimitMs: 500, adaptive: false } })
  await act(async () => {
    await trigger()
  })
  const result = await call<{ events: { componentName: string; causes: Cause[] }[] }>(
    'react_render_causes',
    { component: 'EveryHook', appOnly: false, view: 'full' },
  )
  const { events } = result
  return events.flatMap((event) => event.causes)
}

/** The hook a cause points at, looked up in react_inspect_component by the same index the cause reports. */
function addressedHook(hooks: HookEntry[], cause: Cause): HookEntry | undefined {
  if (cause.kind === 'state' && 'hook' in cause && cause.hook) return hooks[cause.hook.index]
  if (cause.kind === 'external-store' && 'hookIndex' in cause) return hooks[cause.hookIndex]
  if (cause.kind === 'unknown' && 'hookIndex' in cause && cause.hookIndex !== undefined)
    return hooks[cause.hookIndex]
  return undefined
}

describe('hook indexes address the same hook in every tool', () => {
  it.each([
    'useState',
    'useReducer',
    'useSyncExternalStore',
    'useActionState',
    'useTransition',
    'useOptimistic',
  ])('a %s update is reported on the hook react_inspect_component names', async (name) => {
    const id = await mounted()
    const hooks = await hooksOf(id)
    const causes = await causesAfter(() => triggers[name]?.())
    finishTransition()
    await act(async () => {})

    const addressed = causes
      .map((cause) => [cause, addressedHook(hooks, cause)] as const)
      .filter(([, hook]) => hook !== undefined)
    expect(addressed.map(([, hook]) => hook?.hook)).toContain(name)
    for (const [cause, hook] of addressed) {
      if (cause.kind !== 'state' || !('hook' in cause) || !cause.hook) continue
      expect(cause.hook.stateIndex ?? undefined).toBe(hook?.stateIndex)
    }
  })

  it('a stateIndex and its hook index pick the same hook for overrides, or are refused alike', async () => {
    const id = await mounted()
    const hooks = await hooksOf(id)
    const stateful = hooks.filter((hook) => hook.stateful)
    expect(stateful.map((hook) => hook.stateIndex)).toEqual(stateful.map((_, ordinal) => ordinal))

    for (const hook of stateful) {
      const byStateIndex = call('react_override_hook_state', {
        id,
        stateIndex: hook.stateIndex,
        value: 99,
      })
      if (hook.kind === 'state' || hook.kind === 'reducer') {
        await act(async () => {
          await byStateIndex
        })
        expect((await hooksOf(id))[hook.index]?.value).toBe(99)
        await act(async () => {
          await call('react_reset_overrides', {})
        })
        continue
      }
      const refused = await byStateIndex.then(
        () => 'applied',
        (error: Error) => error.message,
      )
      const refusedByIndex = await call('react_override_hook_state', {
        id,
        hookIndex: hook.index,
        value: 99,
      }).then(
        () => 'applied',
        (error: Error) => error.message,
      )
      expect(refused).toContain(`Hook ${hook.index} of EveryHook`)
      expect(refusedByIndex).toBe(refused)
    }
  })

  it('keeps useOptimistic internal after a re-render gives its queue a reducer', async () => {
    const id = await mounted()
    await act(async () => triggers.useState?.())
    const optimistic = (await hooksOf(id)).find((hook) => hook.hook === 'useOptimistic')
    expect(optimistic).toMatchObject({ kind: 'other', stateful: true })

    const refused = await call('react_override_hook_state', {
      id,
      stateIndex: optimistic?.stateIndex,
      value: 1,
    }).then(
      () => 'applied',
      (error: Error) => error.message,
    )
    expect(refused).toContain('internal state of a hook such as useOptimistic')
  })

  it('effect findings count the same effect hooks react_inspect_component lists', async () => {
    const id = await mounted()
    await call('react_clear_renders', { budget: { timeLimitMs: 500, adaptive: false } })
    await act(async () => triggers.useState?.())
    const hooks = await hooksOf(id)
    const audit = await call<{ components: { name: string; effects: { index: number }[] }[] }>(
      'react_effect_audit',
      { component: 'EveryHook', appOnly: false },
    )
    const inspectedEffects = hooks.filter(
      (hook) => hook.kind === 'effect' || hook.kind === 'layout-effect',
    )
    const reported = audit.components.flatMap((component) => component.effects)
    expect(reported.map((effect) => effect.index).sort()).toEqual(
      inspectedEffects.map((_, ordinal) => ordinal),
    )
  })
})
