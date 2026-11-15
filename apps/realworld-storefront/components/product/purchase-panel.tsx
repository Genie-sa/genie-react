'use client'

import dynamic from 'next/dynamic'
import { type ReactNode, useState } from 'react'
import type { Inventory, Product, RatingSummary } from '../../lib/data/types'
import { Price } from '../ui/price'
import { RatingStars } from '../ui/rating-stars'
import { AddToCartButton } from './add-to-cart-button'
import { DeliveryEstimate } from './delivery-estimate'
import { StockStatus } from './stock-status'
import { ColorOptions, SizeOptions } from './variant-options'

const SizeGuide = dynamic(() => import('./size-guide').then((module) => module.SizeGuide))

const STANDARD_DELIVERY_DAYS = 3

export function PurchasePanel({
  product,
  inventory,
  ratings,
  selectedColor,
  onSelectColor,
}: {
  product: Product
  inventory: Inventory
  ratings: RatingSummary
  selectedColor: string
  onSelectColor: (color: string) => void
}): ReactNode {
  const singleSize = product.sizes.length === 1 ? (product.sizes[0] ?? null) : null
  const [selectedSize, setSelectedSize] = useState<string | null>(singleSize)
  const [showSizeGuide, setShowSizeGuide] = useState(false)
  const colorVariants = product.variants.filter((variant) => variant.color === selectedColor)
  const variant = colorVariants.find((candidate) => candidate.size === selectedSize) ?? null
  const stock = variant ? (inventory.byVariant[variant.id] ?? 0) : null

  return (
    <div className="purchase-panel">
      <p className="tile-brand">{product.brand}</p>
      <h1>{product.name}</h1>
      <a href="#reviews" className="rating-link">
        <RatingStars rating={ratings.average} count={ratings.total} />
      </a>
      <p className="purchase-price">
        <Price cents={product.priceCents} compareAtCents={product.compareAtCents} />
      </p>
      <ColorOptions colors={product.colors} selected={selectedColor} onSelect={onSelectColor} />
      <SizeOptions variants={colorVariants} selected={selectedSize} onSelect={setSelectedSize} />
      {singleSize ? null : (
        <button type="button" className="link-button" onClick={() => setShowSizeGuide(true)}>
          Size guide
        </button>
      )}
      {showSizeGuide ? <SizeGuide onClose={() => setShowSizeGuide(false)} /> : null}
      <StockStatus stock={stock} />
      <AddToCartButton variantId={variant?.id ?? null} disabled={stock === 0} />
      <DeliveryEstimate businessDays={STANDARD_DELIVERY_DAYS} />
    </div>
  )
}
