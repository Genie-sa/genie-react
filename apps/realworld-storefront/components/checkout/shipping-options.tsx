'use client'

import { type ReactNode, useEffect, useState } from 'react'
import type { ShippingQuote } from '../../lib/data/types'
import { Price } from '../ui/price'
import { TextSkeleton } from '../ui/skeletons'

export interface Destination {
  country: string
  postalCode: string
}

export function ShippingOptions({
  destination,
  selected,
  error,
  onSelect,
}: {
  destination: Destination
  selected: string
  error?: string
  onSelect: (quote: ShippingQuote) => void
}): ReactNode {
  const [quotes, setQuotes] = useState<ShippingQuote[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({
      country: destination.country,
      postalCode: destination.postalCode,
    })
    setFailed(false)
    fetch(`/api/shipping-quote?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Quote failed with ${response.status}`)
        const body = (await response.json()) as { quotes: ShippingQuote[] }
        setQuotes(body.quotes)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [destination])

  if (failed) return <p role="alert">Delivery options could not be loaded.</p>
  if (!quotes) return <TextSkeleton lines={2} />
  return (
    <div className="shipping-options" role="radiogroup" aria-label="Delivery options">
      {quotes.map((quote) => (
        <label key={quote.id} className="shipping-option">
          <input
            type="radio"
            name="shippingMethod"
            value={quote.id}
            checked={selected === quote.id}
            onChange={() => onSelect(quote)}
          />
          <span className="shipping-option-text">
            <strong>{quote.label}</strong>
            <span className="muted">
              {quote.businessDays} business {quote.businessDays === 1 ? 'day' : 'days'}
            </span>
          </span>
          {quote.priceCents === 0 ? 'Free' : <Price cents={quote.priceCents} />}
        </label>
      ))}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  )
}
