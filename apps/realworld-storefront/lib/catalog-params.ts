import type { CatalogQuery, SortOrder } from './data/types'

export type SearchParams = Record<string, string | string[] | undefined>

export const SORT_OPTIONS: readonly { value: SortOrder; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
]

function list(value: string | string[] | undefined): string[] {
  if (value === undefined) return []
  return (Array.isArray(value) ? value : value.split(',')).filter(Boolean)
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parseCatalogQuery(categorySlug: string, params: SearchParams): CatalogQuery {
  const sort = SORT_OPTIONS.find((option) => option.value === single(params.sort))?.value
  const maxPrice = Number(single(params.maxPrice))
  const page = Number(single(params.page))
  return {
    categorySlug,
    colors: list(params.color),
    sizes: list(params.size),
    maxPriceCents: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice * 100 : null,
    inStockOnly: single(params.inStock) === '1',
    sort: sort ?? 'featured',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

export function catalogHref(query: CatalogQuery, changes: Partial<CatalogQuery> = {}): string {
  const next = { ...query, page: 1, ...changes }
  const params = new URLSearchParams()
  if (next.colors.length > 0) params.set('color', next.colors.join(','))
  if (next.sizes.length > 0) params.set('size', next.sizes.join(','))
  if (next.maxPriceCents !== null) params.set('maxPrice', String(next.maxPriceCents / 100))
  if (next.inStockOnly) params.set('inStock', '1')
  if (next.sort !== 'featured') params.set('sort', next.sort)
  if (next.page > 1) params.set('page', String(next.page))
  const search = params.toString()
  return `/category/${next.categorySlug}${search ? `?${search}` : ''}`
}

export function toggleValue(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]
}
