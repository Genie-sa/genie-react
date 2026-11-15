'use client'

import { useRouter } from 'next/navigation'
import { createContext, type ReactNode, use, useCallback, useMemo, useTransition } from 'react'

interface CatalogNavigation {
  isPending: boolean
  navigate: (href: string) => void
}

const CatalogNavigationContext = createContext<CatalogNavigation | null>(null)

export function CatalogNavigationProvider({ children }: { children: ReactNode }): ReactNode {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const navigate = useCallback(
    (href: string) => startTransition(() => router.push(href, { scroll: false })),
    [router],
  )

  const value = useMemo(() => ({ isPending, navigate }), [isPending, navigate])
  return <CatalogNavigationContext value={value}>{children}</CatalogNavigationContext>
}

export function useCatalogNavigation(): CatalogNavigation {
  const value = use(CatalogNavigationContext)
  if (!value) throw new Error('useCatalogNavigation must be used inside CatalogNavigationProvider')
  return value
}
