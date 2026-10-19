import { isProductionBuild } from '../../production-build'

const REGISTRY_KEY = Symbol.for('genie-react:proxy-registry')

type RegistryHolder = Record<symbol, WeakSet<object> | undefined>

function registry(): WeakSet<object> | undefined {
  return (globalThis as unknown as RegistryHolder)[REGISTRY_KEY]
}

/** Record every Proxy created after this call so app proxies are never reflected on; one install per realm survives HMR and duplicate bundles. */
export function installProxyTagging(): void {
  const holder = globalThis as unknown as RegistryHolder & { Proxy?: ProxyConstructor }
  const NativeProxy = holder.Proxy
  if (isProductionBuild() || registry() || typeof NativeProxy !== 'function') return
  const nativeRevocable = NativeProxy.revocable
  const revocableDescriptor = Object.getOwnPropertyDescriptor(NativeProxy, 'revocable')
  const proxies = new WeakSet<object>()

  // A Proxy over the constructor keeps name, length, the missing prototype, and the non-`new` TypeError native.
  const TaggedProxy = new NativeProxy(NativeProxy, {
    construct(target, args, newTarget) {
      const proxy = Reflect.construct(target, args, newTarget)
      proxies.add(proxy)
      return proxy
    },
  })
  const { revocable } = {
    revocable<T extends object>(target: T, handler: ProxyHandler<T>) {
      const result = nativeRevocable(target, handler)
      proxies.add(result.proxy)
      return result
    },
  }

  try {
    Object.defineProperty(NativeProxy, 'revocable', { ...revocableDescriptor, value: revocable })
    holder.Proxy = TaggedProxy
    holder[REGISTRY_KEY] = proxies
  } catch {
    if (revocableDescriptor) Object.defineProperty(NativeProxy, 'revocable', revocableDescriptor)
  }
}

/** Only proxies created after installProxyTagging are known; earlier ones are indistinguishable from their targets. */
export function isKnownProxy(value: object): boolean {
  return registry()?.has(value) ?? false
}
