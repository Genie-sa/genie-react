'use client'

import { type ReactNode, useState } from 'react'
import type { Inventory, Product, RatingSummary } from '../../lib/data/types'
import { ProductGallery } from './product-gallery'
import { ProductInfo } from './product-info'
import { PurchasePanel } from './purchase-panel'

export function ProductDetails({
  product,
  inventory,
  ratings,
}: {
  product: Product
  inventory: Inventory
  ratings: RatingSummary
}): ReactNode {
  const [selectedColor, setSelectedColor] = useState(product.colors[0]?.name ?? '')
  const images = product.images.filter((image) => image.color === selectedColor)

  return (
    <div className="product-layout">
      <ProductGallery images={images} productName={product.name} />
      <div className="product-column">
        <PurchasePanel
          product={product}
          inventory={inventory}
          ratings={ratings}
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
        />
        <ProductInfo product={product} />
      </div>
    </div>
  )
}
