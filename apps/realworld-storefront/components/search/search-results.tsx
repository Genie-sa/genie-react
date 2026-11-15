'use client'

import type { ReactNode } from 'react'
import type { ProductSummary } from '../../lib/data/types'
import { SearchResultRow } from './search-result-row'

export function SearchResults({
  term,
  items,
}: {
  term: string
  items: ProductSummary[]
}): ReactNode {
  if (items.length === 0) return null
  return (
    <ul className="search-results" data-testid="search-results">
      {items.map((item) => (
        <SearchResultRow key={item.id} item={item} term={term} />
      ))}
    </ul>
  )
}
