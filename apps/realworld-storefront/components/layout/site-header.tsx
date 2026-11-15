import Link from 'next/link'
import type { ReactNode } from 'react'
import { readCart } from '../../lib/data/cart'
import { currentCartId } from '../../lib/server/session'
import { AccountLink } from './account-link'
import { CartButton } from './cart-button'
import { CategoryNav } from './category-nav'
import { HeaderSearch } from './header-search'
import { LocaleSwitcher } from './locale-switcher'
import { ThemeToggle } from './theme-toggle'
import { WishlistLink } from './wishlist-link'

export async function SiteHeader(): Promise<ReactNode> {
  const cart = await readCart(await currentCartId())
  return (
    <header className="site-header">
      <div className="header-row">
        <Link href="/" className="logo">
          Fernhill <span>Supply</span>
        </Link>
        <HeaderSearch />
        <nav className="header-actions" aria-label="Account and cart">
          <LocaleSwitcher />
          <ThemeToggle />
          <WishlistLink />
          <AccountLink />
          <CartButton
            count={cart.itemCount}
            lines={cart.lines}
            subtotalCents={cart.subtotalCents}
          />
        </nav>
      </div>
      <CategoryNav />
    </header>
  )
}
