import Link from 'next/link'
import type { ReactNode } from 'react'

export function SiteFooter(): ReactNode {
  return (
    <footer className="site-footer">
      <div>
        <strong>Fernhill Supply</strong>
        <p className="muted">Fewer, better things. Repaired for free for two years.</p>
      </div>
      <nav aria-label="Help">
        <Link href="/account/orders">Order status</Link>
        <Link href="/search">Search the shop</Link>
        <Link href="/wishlist">Wishlist</Link>
      </nav>
    </footer>
  )
}
