'use client'

import dynamic from 'next/dynamic'
import { type ReactNode, useState } from 'react'
import type { ReviewSort } from '../../lib/data/catalog'
import type { RatingSummary } from '../../lib/data/types'
import { useInView } from '../../lib/use-in-view'
import { SectionBoundary } from '../ui/section-boundary'
import { TextSkeleton } from '../ui/skeletons'
import { RatingBreakdown } from './rating-breakdown'

const ReviewList = dynamic(() => import('./review-list').then((module) => module.ReviewList), {
  loading: () => <TextSkeleton lines={4} />,
})

const SORT_LABELS: Record<ReviewSort, string> = {
  newest: 'Newest',
  highest: 'Highest rated',
  lowest: 'Lowest rated',
  helpful: 'Most helpful',
}

export function ReviewsSection({
  productId,
  summary,
}: {
  productId: string
  summary: RatingSummary
}): ReactNode {
  const [sort, setSort] = useState<ReviewSort>('newest')
  const [ref, isInView] = useInView<HTMLElement>()

  return (
    <section id="reviews" ref={ref} className="reviews" aria-label="Reviews">
      <div className="reviews-header">
        <h2 className="section-title">Reviews</h2>
        <label>
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as ReviewSort)}>
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <RatingBreakdown summary={summary} />
      {isInView ? (
        <SectionBoundary
          fallback={
            <p role="alert" className="notice">
              Reviews are unavailable right now. Refresh the page to try again.
            </p>
          }
        >
          <ReviewList productId={productId} sort={sort} />
        </SectionBoundary>
      ) : (
        <TextSkeleton lines={4} />
      )}
    </section>
  )
}
