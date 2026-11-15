'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { type ReactNode, useDeferredValue, useEffect, useState } from 'react'
import { fetchSearch } from '../../lib/api-client'
import type { ProductSummary } from '../../lib/data/types'
import { SearchResults } from './search-results'

const MIN_TERM_LENGTH = 2
const NO_RESULTS: ProductSummary[] = []

export function SearchExperience({ initialTerm }: { initialTerm: string }): ReactNode {
  const [term, setTerm] = useState(initialTerm)
  const deferredTerm = useDeferredValue(term)
  const normalizedTerm = deferredTerm.trim().toLowerCase()

  const { data, isFetching, isError } = useQuery({
    queryKey: ['search', normalizedTerm],
    queryFn: ({ signal }) => fetchSearch(normalizedTerm, signal),
    enabled: normalizedTerm.length >= MIN_TERM_LENGTH,
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    const url = normalizedTerm ? `/search?q=${encodeURIComponent(normalizedTerm)}` : '/search'
    window.history.replaceState(window.history.state, '', url)
  }, [normalizedTerm])

  const items = normalizedTerm.length >= MIN_TERM_LENGTH ? (data?.items ?? NO_RESULTS) : NO_RESULTS
  const isStale = term !== deferredTerm || isFetching

  return (
    <div className="search-experience">
      <label className="search-field">
        <span className="visually-hidden">Search the shop</span>
        <input
          type="search"
          value={term}
          placeholder="Try “wool”, “navy boot” or “tote”"
          aria-label="Search the shop"
          onChange={(event) => setTerm(event.target.value)}
        />
      </label>
      <p className="results-count" role="status">
        {isError
          ? 'Search is unavailable right now.'
          : normalizedTerm.length < MIN_TERM_LENGTH
            ? 'Type at least two letters.'
            : isStale
              ? 'Searching…'
              : `${items.length} results for “${normalizedTerm}”`}
      </p>
      <SearchResults term={normalizedTerm} items={items} />
    </div>
  )
}
