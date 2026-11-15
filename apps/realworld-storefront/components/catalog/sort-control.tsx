'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { catalogHref, SORT_OPTIONS } from '../../lib/catalog-params'
import type { CatalogQuery, SortOrder } from '../../lib/data/types'

export function SortControl({ query }: { query: CatalogQuery }): ReactNode {
  const router = useRouter()
  return (
    <label className="sort-control">
      Sort by
      <select
        value={query.sort}
        onChange={(event) =>
          router.push(catalogHref(query, { sort: event.target.value as SortOrder }), {
            scroll: false,
          })
        }
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
