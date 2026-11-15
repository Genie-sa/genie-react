import Link from 'next/link'
import type { ReactNode } from 'react'

export default function CheckoutLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <>
      <header className="checkout-header">
        <Link href="/" className="logo">
          Fernhill <span>Supply</span>
        </Link>
        <Link href="/cart">Back to bag</Link>
      </header>
      <main className="page page-narrow">{children}</main>
    </>
  )
}
