'use client'

import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { fetchProductSummaries } from '../../lib/api-client'
import { ProductGrid } from '../catalog/product-grid'
import { useWishlist } from '../providers/wishlist-provider'
import { EmptyState } from '../ui/empty-state'
import { GridSkeleton } from '../ui/skeletons'

export function WishlistView(): ReactNode {
  const { ids, clear } = useWishlist()
  const { data: products, isPending } = useQuery({
    queryKey: ['products', 'summaries', ids],
    queryFn: () => fetchProductSummaries(ids),
    enabled: ids.length > 0,
  })

  if (ids.length === 0) {
    return (
      <EmptyState
        title="Nothing saved yet"
        message="Tap the heart on any product to keep it here."
        action={{ href: '/category/outerwear', label: 'Start browsing' }}
      />
    )
  }
  return (
    <>
      <div className="page-heading">
        <h1>Wishlist</h1>
        <button type="button" className="link-button" onClick={clear}>
          Clear all
        </button>
      </div>
      {isPending || !products ? (
        <GridSkeleton count={ids.length} />
      ) : (
        <ProductGrid products={products} />
      )}
    </>
  )
}
