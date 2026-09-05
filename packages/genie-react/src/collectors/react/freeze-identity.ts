const registryKey = Symbol.for('genie-react:react-freeze-identities')

function registry(): WeakSet<object> | undefined {
  return (globalThis as Record<symbol, WeakSet<object> | undefined>)[registryKey]
}

/** Register the actual react-freeze export, including a separately resolved package copy. */
export function registerReactFreeze(component: object): void {
  const holder = globalThis as Record<symbol, WeakSet<object> | undefined>
  holder[registryKey] ??= new WeakSet()
  holder[registryKey].add(component)
}

export function isReactFreeze(component: unknown): boolean {
  return (
    (typeof component === 'function' || (typeof component === 'object' && component !== null)) &&
    (registry()?.has(component) ?? false)
  )
}

export function hasReactFreezeAdapter(): boolean {
  return registry() !== undefined
}
