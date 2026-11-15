import Link from 'next/link'
import type { ReactNode } from 'react'
import { listCategories } from '../../lib/data/catalog'

export function CategoryNav(): ReactNode {
  return (
    <nav className="category-nav" aria-label="Categories">
      {listCategories().map((category) => (
        <Link key={category.slug} href={`/category/${category.slug}`}>
          {category.name}
        </Link>
      ))}
      <Link href="/search">Search</Link>
    </nav>
  )
}
