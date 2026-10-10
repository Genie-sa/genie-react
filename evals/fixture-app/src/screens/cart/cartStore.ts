import { createStore } from './createStore'

export interface CartItem {
  sku: string
  name: string
  price: number
}

interface CartState {
  items: CartItem[]
  notes: string
}

export const cartStore = createStore<CartState>({
  items: [
    { sku: 'kb-01', name: 'Mechanical keyboard', price: 129 },
    { sku: 'ms-02', name: 'Wireless mouse', price: 49 },
  ],
  notes: '',
})

export const useCartStore = cartStore.useStore
