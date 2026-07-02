const COMMIT_KEYS = ['onCommitFiberRoot', 'onCommitFiberUnmount', 'onPostCommitFiberRoot'] as const

type CommitHandler = (...args: unknown[]) => void

/** Traps later assignments to the hook's commit handlers (e.g. Next.js dev embeds the react-devtools backend, which ASSIGNS over them) so they chain after the installed instrumentation instead of silencing it. */
export function guardCommitStream(): void {
  const hook = (globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown })
    .__REACT_DEVTOOLS_GLOBAL_HOOK__
  if (typeof hook !== 'object' || hook === null) return
  for (const key of COMMIT_KEYS) trapHandler(hook as Record<string, unknown>, key)
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
