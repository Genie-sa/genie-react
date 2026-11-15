import type { ReactNode } from 'react'
import { getFeaturedProducts } from '../../lib/data/catalog'
import { ProductRail } from './product-rail'

export async function FeaturedCollection(): Promise<ReactNode> {
  const products = await getFeaturedProducts()
  return <ProductRail title="Featured this week" products={products} testId="featured" />
}
