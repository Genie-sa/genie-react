import Link from 'next/link'
import type { ReactNode } from 'react'
import { listCategories } from '../../lib/data/catalog'

export function CategoryTiles(): ReactNode {
  return (
    <section className="category-tiles" aria-label="Shop by category">
      {listCategories().map((category) => (
        <Link
          key={category.slug}
          href={`/category/${category.slug}`}
          className="category-tile"
          style={{ background: `hsl(${category.accentHue} 40% 88%)` }}
        >
          <strong>{category.name}</strong>
          <span>{category.tagline}</span>
        </Link>
      ))}
    </section>
  )
}
