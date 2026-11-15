'use client'

import type { ReactNode } from 'react'

function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from)
  let remaining = days
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1)
    const weekday = result.getUTCDay()
    if (weekday !== 0 && weekday !== 6) remaining -= 1
  }
  return result
}

export function DeliveryEstimate({ businessDays }: { businessDays: number }): ReactNode {
  const arrival = addBusinessDays(new Date(), businessDays)
  return (
    <p className="delivery-estimate">
      Order today and it arrives by{' '}
      <strong>
        {arrival.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </strong>
    </p>
  )
}
