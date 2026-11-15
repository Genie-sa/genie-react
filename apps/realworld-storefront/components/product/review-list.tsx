'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { fetchReviews } from '../../lib/api-client'
import type { ReviewSort } from '../../lib/data/catalog'
import { formatDate } from '../../lib/locale'
import { useLocale } from '../providers/locale-context'
import { RatingStars } from '../ui/rating-stars'
import { TextSkeleton } from '../ui/skeletons'

export function ReviewList({
  productId,
  sort,
}: {
  productId: string
  sort: ReviewSort
}): ReactNode {
  const { locale } = useLocale()
  const { data, isPlaceholderData } = useQuery({
    queryKey: ['reviews', productId, sort],
    queryFn: () => fetchReviews(productId, sort),
    placeholderData: keepPreviousData,
    throwOnError: true,
  })

  if (!data) return <TextSkeleton lines={4} />
  return (
    <ol className="review-list" aria-busy={isPlaceholderData} data-testid="review-list">
      {data.reviews.map((review) => (
        <li key={review.id}>
          <RatingStars rating={review.rating} />
          <h3>{review.title}</h3>
          <p>{review.body}</p>
          <p className="muted">
            {review.author} · {formatDate(review.createdAt, locale)} · {review.helpfulCount} found
            this helpful
          </p>
        </li>
      ))}
    </ol>
  )
}
