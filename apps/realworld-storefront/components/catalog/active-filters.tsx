import Link from 'next/link'
import type { ReactNode } from 'react'
import { catalogHref } from '../../lib/catalog-params'
import type { CatalogQuery } from '../../lib/data/types'

export function ActiveFilters({ query }: { query: CatalogQuery }): ReactNode {
  const chips = [
    ...query.colors.map((color) => ({
      label: color,
      href: catalogHref(query, { colors: query.colors.filter((entry) => entry !== color) }),
    })),
    ...query.sizes.map((size) => ({
      label: `Size ${size}`,
      href: catalogHref(query, { sizes: query.sizes.filter((entry) => entry !== size) }),
    })),
    ...(query.maxPriceCents === null
      ? []
      : [
          {
            label: `Up to ${query.maxPriceCents / 100}`,
            href: catalogHref(query, { maxPriceCents: null }),
          },
        ]),
    ...(query.inStockOnly
      ? [{ label: 'In stock', href: catalogHref(query, { inStockOnly: false }) }]
      : []),
  ]
  if (chips.length === 0) return null
  return (
    <ul className="active-filters" aria-label="Active filters">
      {chips.map((chip) => (
        <li key={chip.label}>
          <Link href={chip.href} scroll={false} aria-label={`Remove ${chip.label} filter`}>
            {chip.label} ×
          </Link>
        </li>
      ))}
    </ul>
  )
}
