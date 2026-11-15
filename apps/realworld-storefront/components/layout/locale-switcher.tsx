'use client'

import type { ReactNode } from 'react'
import { LOCALE_LABELS, LOCALES, resolveLocale } from '../../lib/locale'
import { useLocale } from '../providers/locale-context'

export function LocaleSwitcher(): ReactNode {
  const { locale, setLocale } = useLocale()
  return (
    <select
      className="locale-switcher"
      aria-label="Region and currency"
      value={locale}
      onChange={(event) => setLocale(resolveLocale(event.target.value))}
    >
      {LOCALES.map((option) => (
        <option key={option} value={option}>
          {LOCALE_LABELS[option]}
        </option>
      ))}
    </select>
  )
}
