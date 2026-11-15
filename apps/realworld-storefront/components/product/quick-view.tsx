import type { ReactNode } from 'react'
import type { Product } from '../../lib/data/types'
import { Price } from '../ui/price'
import { ProductImage } from '../ui/product-image'
import { RatingStars } from '../ui/rating-stars'

export function QuickView({ product }: { product: Product }): ReactNode {
  const [image] = product.images
  return (
    <div className="quick-view" data-testid="quick-view">
      {image ? <ProductImage image={image} label={product.name} size="card" /> : null}
      <div>
        <p className="tile-brand">{product.brand}</p>
        <h2>{product.name}</h2>
        <RatingStars rating={product.rating} count={product.reviewCount} />
        <p>
          <Price cents={product.priceCents} compareAtCents={product.compareAtCents} />
        </p>
        <p>{product.description[0]}</p>
        <p className="muted">Available in {product.colors.map((color) => color.name).join(', ')}</p>
        <a className="button" href={`/product/${product.slug}`}>
          View full details
        </a>
      </div>
    </div>
  )
}
