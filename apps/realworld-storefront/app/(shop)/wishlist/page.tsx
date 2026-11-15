import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { WishlistView } from '../../../components/wishlist/wishlist-view'

export const metadata: Metadata = { title: 'Wishlist' }

export default function WishlistPage(): ReactNode {
  return <WishlistView />
}
