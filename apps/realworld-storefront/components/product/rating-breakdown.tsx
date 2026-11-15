import type { ReactNode } from 'react'
import type { RatingSummary } from '../../lib/data/types'
import { RatingStars } from '../ui/rating-stars'

const STARS = [5, 4, 3, 2, 1] as const

export function RatingBreakdown({ summary }: { summary: RatingSummary }): ReactNode {
  return (
    <div className="rating-breakdown">
      <p className="rating-average">
        <strong>{summary.average.toFixed(1)}</strong>
        <RatingStars rating={summary.average} count={summary.total} />
      </p>
      <ul>
        {STARS.map((stars) => {
          const share = summary.total === 0 ? 0 : summary.distribution[stars] / summary.total
          return (
            <li key={stars}>
              <span>{stars}★</span>
              <span className="bar" aria-hidden="true">
                <span style={{ width: `${Math.round(share * 100)}%` }} />
              </span>
              <span className="muted">{summary.distribution[stars]}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
