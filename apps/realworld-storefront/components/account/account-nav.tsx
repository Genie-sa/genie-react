'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

const LINKS = [
  { href: '/account', label: 'Overview' },
  { href: '/account/orders', label: 'Orders' },
  { href: '/wishlist', label: 'Wishlist' },
]

export function AccountNav(): ReactNode {
  const pathname = usePathname()
  return (
    <nav className="account-nav" aria-label="Account">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={pathname === link.href ? 'page' : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
