import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ProductSummary } from '../../lib/data/types'
import { Price } from '../ui/price'
import { ProductImage } from '../ui/product-image'
import { RatingStars } from '../ui/rating-stars'

export function ProductTile({ product }: { product: ProductSummary }): ReactNode {
  return (
    <Link href={`/product/${product.slug}`} className="product-tile">
      <ProductImage image={product.image} label={product.name} />
      <span className="tile-brand">{product.brand}</span>
      <strong>{product.name}</strong>
      <RatingStars rating={product.rating} count={product.reviewCount} />
      <Price cents={product.priceCents} compareAtCents={product.compareAtCents} />
    </Link>
  )
}
