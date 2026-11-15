'use client'

import Link from 'next/link'
import { memo, type ReactNode } from 'react'
import type { ProductSummary } from '../../lib/data/types'
import { Price } from '../ui/price'
import { ProductImage } from '../ui/product-image'
import { RatingStars } from '../ui/rating-stars'
import { WishlistButton } from './wishlist-button'

interface ProductCardProps {
  product: ProductSummary
  isSaved: boolean
  onToggleSaved: () => void
}

export const ProductCard = memo(function ProductCard({
  product,
  isSaved,
  onToggleSaved,
}: ProductCardProps): ReactNode {
  return (
    <article className="product-card" data-product-id={product.id}>
      <Link href={`/product/${product.slug}`} scroll={false} className="card-link">
        <ProductImage image={product.image} label={product.name} />
        <span className="tile-brand">{product.brand}</span>
        <strong>{product.name}</strong>
      </Link>
      <div className="card-meta">
        <RatingStars rating={product.rating} count={product.reviewCount} />
        <Price cents={product.priceCents} compareAtCents={product.compareAtCents} />
        {product.colorCount > 1 ? (
          <span className="muted">{product.colorCount} colours</span>
        ) : null}
      </div>
      <WishlistButton productName={product.name} isSaved={isSaved} onToggle={onToggleSaved} />
    </article>
  )
})
