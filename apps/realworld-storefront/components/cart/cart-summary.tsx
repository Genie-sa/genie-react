'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { CartLineView } from '../../lib/data/types'
import { Price } from '../ui/price'
import { PromoCodeForm } from './promo-code-form'

export function CartSummary({
  lines,
  discountCents,
  promoCode,
}: {
  lines: CartLineView[]
  discountCents: number
  promoCode: string | null
}): ReactNode {
  const subtotal = lines.reduce((sum, line) => sum + line.lineCents, 0)
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0)
  return (
    <aside className="cart-summary" aria-label="Order summary">
      <h2>Summary</h2>
      <dl>
        <div>
          <dt>Items</dt>
          <dd data-testid="summary-items">{itemCount}</dd>
        </div>
        <div>
          <dt>Subtotal</dt>
          <dd>
            <Price cents={subtotal} />
          </dd>
        </div>
        {discountCents > 0 ? (
          <div>
            <dt>Discount ({promoCode})</dt>
            <dd>
              −<Price cents={discountCents} />
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Shipping</dt>
          <dd className="muted">Calculated at checkout</dd>
        </div>
      </dl>
      <PromoCodeForm appliedCode={promoCode} />
      <Link
        className="button button-wide"
        href="/checkout"
        aria-disabled={lines.length === 0}
        tabIndex={lines.length === 0 ? -1 : undefined}
      >
        Checkout
      </Link>
    </aside>
  )
}
