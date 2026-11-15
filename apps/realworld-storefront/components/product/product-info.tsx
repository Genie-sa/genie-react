import type { ReactNode } from 'react'
import type { Product } from '../../lib/data/types'
import { CareInstructions } from './care-instructions'
import { ProductDescription } from './product-description'
import { SpecificationTable } from './specification-table'

export function ProductInfo({ product }: { product: Product }): ReactNode {
  return (
    <div className="product-info">
      <ProductDescription paragraphs={product.description} />
      <SpecificationTable specifications={product.specifications} />
      <CareInstructions care={product.care} />
    </div>
  )
}
