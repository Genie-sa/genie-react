'use client'

import type { ReactNode } from 'react'
import { type CheckoutValues, COUNTRIES } from '../../lib/checkout-schema'
import type { CartView, ShippingQuote } from '../../lib/data/types'
import { Price } from '../ui/price'

export function ReviewStep({
  values,
  cart,
  quote,
}: {
  values: CheckoutValues
  cart: CartView
  quote: ShippingQuote | null
}): ReactNode {
  const country = COUNTRIES.find((candidate) => candidate.code === values.country)?.name
  const shippingCents = quote?.priceCents ?? 0
  return (
    <section className="checkout-step" aria-label="Review your order">
      <h2>Review</h2>
      <dl className="review-details">
        <div>
          <dt>Contact</dt>
          <dd>{values.email}</dd>
        </div>
        <div>
          <dt>Ship to</dt>
          <dd>
            {values.fullName}, {values.street}, {values.postalCode} {values.city}, {country}
          </dd>
        </div>
        <div>
          <dt>Delivery</dt>
          <dd>{quote?.label ?? values.shippingMethod}</dd>
        </div>
        <div>
          <dt>Card</dt>
          <dd>•••• {values.cardNumber.replace(/\s+/g, '').slice(-4)}</dd>
        </div>
      </dl>
      <p className="review-total">
        Total <Price cents={cart.subtotalCents - cart.discountCents + shippingCents} />
      </p>
    </section>
  )
}
