'use client'

import { createContext, use } from 'react'
import type { Locale } from '../../lib/locale'

export interface LocaleContextValue {
  locale: Locale
  currency: string
  formatPrice: (cents: number) => string
  setLocale: (locale: Locale) => void
}

export const LocaleContext = createContext<LocaleContextValue | null>(null)

export function useLocale(): LocaleContextValue {
  const value = use(LocaleContext)
  if (!value) throw new Error('useLocale must be used inside ShopProviders')
  return value
}
