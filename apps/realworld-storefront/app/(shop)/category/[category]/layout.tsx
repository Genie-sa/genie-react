import type { ReactNode } from 'react'
import { CatalogNavigationProvider } from '../../../../components/catalog/catalog-navigation'

export default function CategoryLayout({
  children,
  modal,
}: {
  children: ReactNode
  modal: ReactNode
}): ReactNode {
  return (
    <CatalogNavigationProvider>
      {children}
      {modal}
    </CatalogNavigationProvider>
  )
}
