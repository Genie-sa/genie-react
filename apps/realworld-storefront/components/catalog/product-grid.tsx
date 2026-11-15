'use client'

import type { ReactNode } from 'react'
import type { ProductSummary } from '../../lib/data/types'
import { useWishlist } from '../providers/wishlist-provider'
import { ProductCard } from './product-card'

export function ProductGrid({ products }: { products: ProductSummary[] }): ReactNode {
  const wishlist = useWishlist()
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          isSaved={wishlist.has(product.id)}
          onToggleSaved={() => wishlist.toggle(product.id)}
        />
      ))}
    </div>
  )
}
