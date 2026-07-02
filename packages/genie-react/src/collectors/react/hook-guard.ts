type CommitHandler = (...args: unknown[]) => void

/** Traps later assignments to onCommitFiberRoot ONLY (the handler Next's embedded react-devtools backend assigns over); other handlers stay plain properties so bippy wrappers that self-check `hook[key] === wrapper` keep firing. */
export function guardCommitStream(): void {
  const hook = (globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown })
    .__REACT_DEVTOOLS_GLOBAL_HOOK__
  if (typeof hook !== 'object' || hook === null) return
  trapHandler(hook as Record<string, unknown>, 'onCommitFiberRoot')
}

export function trapHandler(hook: Record<string, unknown>, key: string): void {
  const upstream = hook[key]
  if (typeof upstream !== 'function') return
  let downstream: unknown
  let running = false
  const chained: CommitHandler = (...args) => {
    // Re-entrancy guard: a writer that wraps-and-calls the previous handler would otherwise recurse forever.
    if (running) return
    running = true
    try {
      ;(upstream as CommitHandler)(...args)
      if (typeof downstream === 'function') (downstream as CommitHandler)(...args)
    } finally {
      running = false
    }
  }
  try {
    Object.defineProperty(hook, key, {
      configurable: true,
      get: () => chained,
      set: (value) => {
        downstream = value
      },
    })
  } catch {
    // property not configurable — leave the original handler in place
  }
}
