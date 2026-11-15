import type { ReactNode } from 'react'
import { PageTransition } from '../../components/layout/page-transition'
import { SiteFooter } from '../../components/layout/site-footer'
import { SiteHeader } from '../../components/layout/site-header'

export default function ShopLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <>
      <SiteHeader />
      <main className="page">
        <PageTransition>{children}</PageTransition>
      </main>
      <SiteFooter />
    </>
  )
}
