import type { FaultRule, Operation } from './simulation'
import type { CartLine, Order, Review } from './types'

export interface StoredCart {
  lines: CartLine[]
  promoCode: string | null
}

interface StoreState {
  carts: Map<string, StoredCart>
  sessions: Map<string, string>
  faults: Map<Operation, FaultRule>
  submittedReviews: Map<string, Review[]>
  placedOrders: Order[]
  subscribers: Set<string>
}

const STATE_KEY = Symbol.for('realworld-storefront.state')

function createState(): StoreState {
  return {
    carts: new Map(),
    sessions: new Map(),
    faults: new Map(),
    submittedReviews: new Map(),
    placedOrders: [],
    subscribers: new Set(),
  }
}

export function storeState(): StoreState {
  const holder = globalThis as typeof globalThis & { [STATE_KEY]?: StoreState }
  holder[STATE_KEY] ??= createState()
  return holder[STATE_KEY]
}

export function resetStoreState(): void {
  const holder = globalThis as typeof globalThis & { [STATE_KEY]?: StoreState }
  holder[STATE_KEY] = createState()
}
