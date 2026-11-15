'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { CartLineView } from '../../lib/data/types'
import { Price } from '../ui/price'
import { ProductImage } from '../ui/product-image'

export function CartDrawer({
  lines,
  subtotalCents,
  onClose,
}: {
  lines: CartLineView[]
  subtotalCents: number
  onClose: () => void
}): ReactNode {
  return (
    <aside className="cart-drawer" aria-label="Bag preview">
      <header>
        <h2>Your bag</h2>
        <button type="button" className="icon-button" aria-label="Close bag" onClick={onClose}>
          ×
        </button>
      </header>
      {lines.length === 0 ? (
        <p className="muted">Your bag is empty.</p>
      ) : (
        <ul className="drawer-lines">
          {lines.map((line) => (
            <li key={line.variantId}>
              <ProductImage image={line.product.image} label={line.product.name} size="thumb" />
              <div>
                <strong>{line.product.name}</strong>
                <span className="muted">
                  {line.color} · {line.size} · ×{line.quantity}
                </span>
              </div>
              <Price cents={line.lineCents} />
            </li>
          ))}
        </ul>
      )}
      <footer>
        <span>Subtotal</span>
        <Price cents={subtotalCents} />
        <Link className="button" href="/cart" onClick={onClose}>
          View bag
        </Link>
      </footer>
    </aside>
  )
}
