'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, startTransition, useCallback, useMemo, useState } from 'react'
import { saveLocale } from '../../lib/actions/locale'
import { createPriceFormatter, currencyFor, type Locale } from '../../lib/locale'
import { getQueryClient } from '../../lib/query-client'
import { CartDrawerContext, type CartDrawerState } from './cart-drawer-context'
import { LocaleContext } from './locale-context'
import { WishlistProvider } from './wishlist-provider'

export function ShopProviders({
  initialLocale,
  children,
}: {
  initialLocale: Locale
  children: ReactNode
}): ReactNode {
  const queryClient = getQueryClient()
  const [locale, setLocaleState] = useState(initialLocale)
  const [isCartOpen, setCartOpen] = useState(false)

  const formatPrice = useMemo(() => createPriceFormatter(locale), [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    startTransition(() => saveLocale(next))
  }, [])

  const drawer = useMemo<CartDrawerState>(
    () => ({ isOpen: isCartOpen, open: () => setCartOpen(true), close: () => setCartOpen(false) }),
    [isCartOpen],
  )

  return (
    <QueryClientProvider client={queryClient}>
      <LocaleContext value={{ locale, currency: currencyFor(locale), formatPrice, setLocale }}>
        <WishlistProvider>
          <CartDrawerContext value={drawer}>{children}</CartDrawerContext>
        </WishlistProvider>
      </LocaleContext>
    </QueryClientProvider>
  )
}
