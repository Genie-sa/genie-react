import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'
import type { ProductSummary } from '../../lib/data/types'
import { Price } from '../ui/price'
import { ProductImage } from '../ui/product-image'

function escapeForPattern(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlight(text: string, term: string): ReactNode {
  const words = term.split(/\s+/).filter(Boolean).map(escapeForPattern)
  if (words.length === 0) return text
  const pattern = new RegExp(`(${words.join('|')})`, 'gi')
  return text
    .split(pattern)
    .map((part, index) =>
      index % 2 === 1 ? (
        <mark key={`${part}-${index}`}>{part}</mark>
      ) : (
        <Fragment key={`${part}-${index}`}>{part}</Fragment>
      ),
    )
}

export function SearchResultRow({ item, term }: { item: ProductSummary; term: string }): ReactNode {
  return (
    <li className="search-row">
      <Link href={`/product/${item.slug}`}>
        <ProductImage image={item.image} label={item.name} size="thumb" />
        <span className="search-row-text">
          <strong>{highlight(item.name, term)}</strong>
          <span className="muted">
            {highlight(item.brand, term)} · {item.categorySlug}
          </span>
        </span>
        <Price cents={item.priceCents} compareAtCents={item.compareAtCents} />
      </Link>
    </li>
  )
}
