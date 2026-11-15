import Link from 'next/link'
import type { ReactNode } from 'react'
import { findCategory } from '../../lib/data/catalog'
import type { Product } from '../../lib/data/types'

export function Breadcrumbs({ product }: { product: Product }): ReactNode {
  const category = findCategory(product.categorySlug)
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link href="/">Home</Link>
      {category ? <Link href={`/category/${category.slug}`}>{category.name}</Link> : null}
      <span aria-current="page">{product.name}</span>
    </nav>
  )
}
