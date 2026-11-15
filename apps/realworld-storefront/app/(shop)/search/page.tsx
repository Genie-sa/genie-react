import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SearchExperience } from '../../../components/search/search-experience'
import type { SearchParams } from '../../../lib/catalog-params'

export const metadata: Metadata = { title: 'Search' }

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}): Promise<ReactNode> {
  const { q } = await searchParams
  return (
    <>
      <h1>Search</h1>
      <SearchExperience initialTerm={typeof q === 'string' ? q : ''} />
    </>
  )
}
