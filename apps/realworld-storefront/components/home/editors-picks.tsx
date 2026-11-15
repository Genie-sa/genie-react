import type { ReactNode } from 'react'
import { getEditorsPicks } from '../../lib/data/catalog'
import { ProductRail } from './product-rail'

export async function EditorsPicks(): Promise<ReactNode> {
  const products = await getEditorsPicks()
  return <ProductRail title="Picked for you" products={products} testId="picks" />
}
