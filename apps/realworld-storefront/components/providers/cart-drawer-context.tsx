'use client'

import { createContext, use } from 'react'

export interface CartDrawerState {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const CartDrawerContext = createContext<CartDrawerState | null>(null)

export function useCartDrawer(): CartDrawerState {
  const value = use(CartDrawerContext)
  if (!value) throw new Error('useCartDrawer must be used inside ShopProviders')
  return value
}
