'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import type { CartLineView } from '../../lib/data/types'
import { useCartDrawer } from '../providers/cart-drawer-context'

const CartDrawer = dynamic(() => import('./cart-drawer').then((module) => module.CartDrawer))

export function CartButton({
  count,
  lines,
  subtotalCents,
}: {
  count: number
  lines: CartLineView[]
  subtotalCents: number
}): ReactNode {
  const drawer = useCartDrawer()
  return (
    <>
      <button
        type="button"
        className="cart-button"
        aria-label={`Cart, ${count} items`}
        aria-expanded={drawer.isOpen}
        onClick={drawer.isOpen ? drawer.close : drawer.open}
      >
        Bag{' '}
        <span className="badge" data-testid="cart-count">
          {count}
        </span>
      </button>
      {drawer.isOpen ? (
        <CartDrawer lines={lines} subtotalCents={subtotalCents} onClose={drawer.close} />
      ) : null}
    </>
  )
}
