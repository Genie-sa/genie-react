import type { ReactNode } from 'react'
import { getNewArrivals } from '../../lib/data/catalog'
import { ProductRail } from './product-rail'

export async function NewArrivals(): Promise<ReactNode> {
  const products = await getNewArrivals()
  return <ProductRail title="New arrivals" products={products} testId="arrivals" />
}
