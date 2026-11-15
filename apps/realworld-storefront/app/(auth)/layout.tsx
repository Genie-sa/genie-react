import Link from 'next/link'
import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <main className="page page-narrow auth">
      <Link href="/" className="logo">
        Fernhill <span>Supply</span>
      </Link>
      {children}
    </main>
  )
}
