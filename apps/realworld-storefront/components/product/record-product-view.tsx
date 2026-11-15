'use client'

import { useEffect } from 'react'
import { recordRecentlyViewed } from '../../lib/recently-viewed'

export function RecordProductView({ productId }: { productId: string }): null {
  useEffect(() => {
    recordRecentlyViewed(productId)
  }, [productId])
  return null
}
