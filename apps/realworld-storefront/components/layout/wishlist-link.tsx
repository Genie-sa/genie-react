'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useWishlist } from '../providers/wishlist-provider'

export function WishlistLink(): ReactNode {
  const { count } = useWishlist()
  return (
    <Link href="/wishlist" className="icon-button" aria-label={`Wishlist, ${count} items`}>
      ♡{count > 0 ? <span className="badge">{count}</span> : null}
    </Link>
  )
}
