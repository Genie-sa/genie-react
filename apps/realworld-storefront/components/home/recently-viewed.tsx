'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'
import { fetchProductSummaries } from '../../lib/api-client'
import { readRecentlyViewed } from '../../lib/recently-viewed'
import { ProductImage } from '../ui/product-image'

export function RecentlyViewed(): ReactNode {
  const [ids, setIds] = useState<string[]>([])

  useEffect(() => {
    setIds(readRecentlyViewed())
  }, [])

  const { data: products = [] } = useQuery({
    queryKey: ['products', 'summaries', ids],
    queryFn: () => fetchProductSummaries(ids),
    enabled: ids.length > 0,
  })

  if (products.length === 0) return null
  return (
    <section className="rail" data-testid="recently-viewed">
      <h2 className="section-title">Recently viewed</h2>
      <div className="rail-track rail-compact">
        {products.map((product) => (
          <Link key={product.id} href={`/product/${product.slug}`} className="recent-tile">
            <ProductImage image={product.image} label={product.name} size="thumb" />
            <span>{product.name}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
