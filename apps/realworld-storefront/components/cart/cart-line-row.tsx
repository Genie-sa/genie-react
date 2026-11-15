'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { CartLineView } from '../../lib/data/types'
import { Price } from '../ui/price'
import { ProductImage } from '../ui/product-image'
import { QuantityStepper } from '../ui/quantity-stepper'

const MAX_PER_LINE = 10

export function CartLineRow({
  line,
  onChangeQuantity,
}: {
  line: CartLineView
  onChangeQuantity: (variantId: string, quantity: number) => void
}): ReactNode {
  return (
    <li className="cart-line" data-variant-id={line.variantId}>
      <ProductImage image={line.product.image} label={line.product.name} size="thumb" />
      <div className="cart-line-info">
        <Link href={`/product/${line.product.slug}`}>{line.product.name}</Link>
        <span className="muted">
          {line.color} · {line.size}
        </span>
        <button
          type="button"
          className="link-button"
          onClick={() => onChangeQuantity(line.variantId, 0)}
        >
          Remove
        </button>
      </div>
      <QuantityStepper
        label={line.product.name}
        value={line.quantity}
        max={MAX_PER_LINE}
        onChange={(quantity) => onChangeQuantity(line.variantId, quantity)}
      />
      <Price cents={line.lineCents} />
    </li>
  )
}
