'use client'

import type { ReactNode } from 'react'
import { useCatalogNavigation } from './catalog-navigation'

export function CatalogResults({
  total,
  children,
}: {
  total: number
  children: ReactNode
}): ReactNode {
  const { isPending } = useCatalogNavigation()
  return (
    <section
      className="catalog-results"
      aria-busy={isPending}
      data-pending={isPending ? '' : undefined}
      aria-label="Products"
    >
      <p className="results-count" role="status">
        {isPending ? 'Updating…' : `${total} products`}
      </p>
      {children}
    </section>
  )
}
