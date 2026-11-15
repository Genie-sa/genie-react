export const OPERATION_LATENCY_MS = {
  'home.featured': 150,
  'home.picks': 1600,
  'home.arrivals': 300,
  'home.deals': 250,
  'catalog.list': 700,
  'product.detail': 120,
  'product.inventory': 350,
  'product.ratings': 350,
  'product.related': 250,
  'reviews.list': 300,
  search: 180,
  'cart.read': 20,
  'cart.mutate': 250,
  'checkout.quote': 220,
  'checkout.place': 500,
  'orders.list': 100,
  'account.profile': 80,
} as const

export type Operation = keyof typeof OPERATION_LATENCY_MS

export const OPERATIONS = Object.keys(OPERATION_LATENCY_MS) as Operation[]

export const CART_PRESETS = ['starter', 'low-stock'] as const

export type CartPreset = (typeof CART_PRESETS)[number]
