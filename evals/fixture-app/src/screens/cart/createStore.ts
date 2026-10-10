import { useEffect, useLayoutEffect, useReducer, useRef } from 'react'

type Listener = () => void

export function createStore<State extends object>(initialState: State) {
  let state = initialState
  const listeners = new Set<Listener>()

  const store = {
    getState: () => state,
    setState(update: Partial<State>) {
      state = { ...state, ...update }
      for (const listener of listeners) listener()
    },
    subscribe(listener: Listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }

  function useStore<Selected>(selector: (state: State) => Selected): Selected {
    const [, forceRender] = useReducer((version: number) => version + 1, 0)
    const selected = selector(store.getState())
    const selectorRef = useRef(selector)
    const selectedRef = useRef(selected)

    useLayoutEffect(() => {
      selectorRef.current = selector
      selectedRef.current = selected
    })

    useEffect(
      () =>
        store.subscribe(() => {
          const next = selectorRef.current(store.getState())
          if (!Object.is(next, selectedRef.current)) forceRender()
        }),
      [],
    )

    return selected
  }

  return { ...store, useStore }
}
