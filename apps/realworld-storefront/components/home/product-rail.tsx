import type { ReactNode } from 'react'
import type { ProductSummary } from '../../lib/data/types'
import { ProductTile } from './product-tile'

export function ProductRail({
  title,
  products,
  testId,
  aside,
}: {
  title: string
  products: ProductSummary[]
  testId: string
  aside?: ReactNode
}): ReactNode {
  return (
    <section className="rail" data-testid={testId}>
      <div className="rail-heading">
        <h2 className="section-title">{title}</h2>
        {aside}
      </div>
      <div className="rail-track">
        {products.map((product) => (
          <ProductTile key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
