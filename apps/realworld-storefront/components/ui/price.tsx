'use client'

import type { ReactNode } from 'react'
import { useLocale } from '../providers/locale-context'

export function Price({
  cents,
  compareAtCents = null,
}: {
  cents: number
  compareAtCents?: number | null
}): ReactNode {
  const { formatPrice } = useLocale()
  return (
    <span className="price">
      <span className={compareAtCents ? 'price-sale' : undefined}>{formatPrice(cents)}</span>
      {compareAtCents ? <s className="price-was">{formatPrice(compareAtCents)}</s> : null}
    </span>
  )
}
