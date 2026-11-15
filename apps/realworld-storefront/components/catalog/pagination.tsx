import Link from 'next/link'
import type { ReactNode } from 'react'
import { catalogHref } from '../../lib/catalog-params'
import type { CatalogQuery } from '../../lib/data/types'

export function Pagination({
  query,
  pageCount,
}: {
  query: CatalogQuery
  pageCount: number
}): ReactNode {
  if (pageCount <= 1) return null
  return (
    <nav className="pagination" aria-label="Pages">
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
        <Link
          key={page}
          href={catalogHref(query, { page })}
          aria-current={page === query.page ? 'page' : undefined}
          scroll={false}
        >
          {page}
        </Link>
      ))}
    </nav>
  )
}
