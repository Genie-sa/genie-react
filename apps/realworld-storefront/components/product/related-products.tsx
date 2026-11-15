import type { ReactNode } from 'react'
import { getRelatedProducts } from '../../lib/data/catalog'
import type { Product } from '../../lib/data/types'
import { ProductRail } from '../home/product-rail'

export async function RelatedProducts({ product }: { product: Product }): Promise<ReactNode> {
  const related = await getRelatedProducts(product)
  if (related.length === 0) return null
  return <ProductRail title="You may also like" products={related} testId="related" />
}
