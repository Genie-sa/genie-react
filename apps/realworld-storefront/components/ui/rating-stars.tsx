import type { ReactNode } from 'react'

export function RatingStars({ rating, count }: { rating: number; count?: number }): ReactNode {
  const rounded = Math.round(rating)
  return (
    <span className="rating" role="img" aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
      <span aria-hidden="true">
        {'★'.repeat(rounded)}
        {'☆'.repeat(5 - rounded)}
      </span>
      {count === undefined ? null : <span className="rating-count">({count})</span>}
    </span>
  )
}
