import type { ReviewPage, ReviewSort } from './data/catalog'
import type { ProductSummary } from './data/types'

export interface SearchResponse {
  term: string
  items: ProductSummary[]
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`${url} failed with ${response.status}`)
  return (await response.json()) as T
}

export async function fetchProductSummaries(ids: readonly string[]): Promise<ProductSummary[]> {
  if (ids.length === 0) return []
  const body = await getJson<{ items: ProductSummary[] }>(
    `/api/products?ids=${ids.map(encodeURIComponent).join(',')}`,
  )
  return body.items
}

export function fetchReviews(productId: string, sort: ReviewSort): Promise<ReviewPage> {
  return getJson(`/api/products/${productId}/reviews?sort=${sort}&limit=6`)
}

export function fetchSearch(term: string, signal: AbortSignal): Promise<SearchResponse> {
  return getJson(`/api/search?q=${encodeURIComponent(term)}`, signal)
}
