import { CATEGORIES, seedCatalog, seedReviews } from './catalog-seed'
import { simulate } from './simulation'
import { storeState } from './state'
import type {
  CatalogPage,
  CatalogQuery,
  Category,
  ColorOption,
  Inventory,
  Product,
  ProductSummary,
  RatingSummary,
  Review,
} from './types'

export const CATALOG_PAGE_SIZE = 12

const { products: PRODUCTS } = seedCatalog()
const PRODUCTS_BY_ID = new Map(PRODUCTS.map((product) => [product.id, product]))
const PRODUCTS_BY_SLUG = new Map(PRODUCTS.map((product) => [product.slug, product]))

export class UnknownProductError extends Error {
  constructor(readonly productId: string) {
    super(`Unknown product ${productId}`)
    this.name = 'UnknownProductError'
  }
}

export function toSummary(product: Product): ProductSummary {
  const [image] = product.images
  if (!image) throw new Error(`${product.id} has no images`)
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    categorySlug: product.categorySlug,
    priceCents: product.priceCents,
    compareAtCents: product.compareAtCents,
    rating: product.rating,
    reviewCount: product.reviewCount,
    addedAt: product.addedAt,
    image,
    colorCount: product.colors.length,
  }
}

export function listCategories(): readonly Category[] {
  return CATEGORIES
}

export function findCategory(slug: string): Category | null {
  return CATEGORIES.find((category) => category.slug === slug) ?? null
}

export function findProductById(id: string): Product | null {
  return PRODUCTS_BY_ID.get(id) ?? null
}

export function findProductBySlug(slug: string): Product | null {
  return PRODUCTS_BY_SLUG.get(slug) ?? null
}

export function requireProducts(ids: readonly string[]): Product[] {
  return ids.map((id) => {
    const product = PRODUCTS_BY_ID.get(id)
    if (!product) throw new UnknownProductError(id)
    return product
  })
}

function byNewest(a: Product, b: Product): number {
  return b.addedAt.localeCompare(a.addedAt)
}

export async function getFeaturedProducts(): Promise<ProductSummary[]> {
  await simulate('home.featured')
  return PRODUCTS.filter((product) => product.tags.includes('bestseller'))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 8)
    .map(toSummary)
}

export async function getEditorsPicks(): Promise<ProductSummary[]> {
  await simulate('home.picks')
  return PRODUCTS.filter((product) => product.tags.includes('repairable'))
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, 4)
    .map(toSummary)
}

export async function getNewArrivals(): Promise<ProductSummary[]> {
  await simulate('home.arrivals')
  return [...PRODUCTS].sort(byNewest).slice(0, 8).map(toSummary)
}

export interface DealSet {
  products: ProductSummary[]
  endsAt: string
}

export async function getDeals(now: Date): Promise<DealSet> {
  await simulate('home.deals')
  const endsAt = new Date(now)
  endsAt.setUTCHours(23, 59, 59, 0)
  return {
    products: PRODUCTS.filter((product) => product.compareAtCents !== null)
      .slice(0, 6)
      .map(toSummary),
    endsAt: endsAt.toISOString(),
  }
}

const SORTERS: Record<CatalogQuery['sort'], (a: Product, b: Product) => number> = {
  featured: (a, b) => b.reviewCount * b.rating - a.reviewCount * a.rating,
  newest: byNewest,
  'price-asc': (a, b) => a.priceCents - b.priceCents,
  'price-desc': (a, b) => b.priceCents - a.priceCents,
  rating: (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
}

function uniqueColors(products: readonly Product[]): ColorOption[] {
  const colors = new Map<string, ColorOption>()
  for (const product of products) {
    for (const color of product.colors) colors.set(color.name, color)
  }
  return [...colors.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export async function listCatalog(query: CatalogQuery): Promise<CatalogPage> {
  await simulate('catalog.list')
  const inCategory = PRODUCTS.filter((product) => product.categorySlug === query.categorySlug)
  const matching = inCategory.filter(
    (product) =>
      (query.colors.length === 0 ||
        product.colors.some((color) => query.colors.includes(color.name))) &&
      (query.sizes.length === 0 || product.sizes.some((size) => query.sizes.includes(size))) &&
      (query.maxPriceCents === null || product.priceCents <= query.maxPriceCents) &&
      (!query.inStockOnly || product.variants.some((variant) => variant.stock > 0)),
  )
  const sorted = [...matching].sort(SORTERS[query.sort])
  const pageCount = Math.max(1, Math.ceil(sorted.length / CATALOG_PAGE_SIZE))
  const page = Math.min(Math.max(1, query.page), pageCount)
  return {
    products: sorted.slice((page - 1) * CATALOG_PAGE_SIZE, page * CATALOG_PAGE_SIZE).map(toSummary),
    total: sorted.length,
    page,
    pageCount,
    availableColors: uniqueColors(inCategory),
    availableSizes: [...new Set(inCategory.flatMap((product) => product.sizes))],
  }
}

export async function getProduct(slug: string): Promise<Product | null> {
  await simulate('product.detail')
  return findProductBySlug(slug)
}

export async function getInventory(productId: string): Promise<Inventory> {
  await simulate('product.inventory')
  const product = findProductById(productId)
  const byVariant = Object.fromEntries(
    (product?.variants ?? []).map((variant) => [variant.id, variant.stock]),
  )
  return {
    productId,
    byVariant,
    totalStock: Object.values(byVariant).reduce((sum, stock) => sum + stock, 0),
  }
}

function reviewsFor(product: Product): Review[] {
  return [...(storeState().submittedReviews.get(product.id) ?? []), ...seedReviews(product)]
}

export async function getRatingSummary(productId: string): Promise<RatingSummary> {
  await simulate('product.ratings')
  const product = findProductById(productId)
  const reviews = product ? reviewsFor(product) : []
  const distribution: RatingSummary['distribution'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const review of reviews) distribution[review.rating as 1 | 2 | 3 | 4 | 5] += 1
  const total = reviews.length
  const average = total === 0 ? 0 : reviews.reduce((sum, review) => sum + review.rating, 0) / total
  return { average: Math.round(average * 10) / 10, total, distribution }
}

export async function getRelatedProducts(product: Product): Promise<ProductSummary[]> {
  await simulate('product.related')
  return requireProducts(product.relatedIds).map(toSummary)
}

export type ReviewSort = 'newest' | 'highest' | 'lowest' | 'helpful'

const REVIEW_SORTERS: Record<ReviewSort, (a: Review, b: Review) => number> = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  highest: (a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt),
  lowest: (a, b) => a.rating - b.rating || b.createdAt.localeCompare(a.createdAt),
  helpful: (a, b) => b.helpfulCount - a.helpfulCount,
}

export interface ReviewPage {
  reviews: Review[]
  total: number
  sort: ReviewSort
}

export async function listReviews(
  productId: string,
  sort: ReviewSort,
  limit: number,
): Promise<ReviewPage> {
  await simulate('reviews.list')
  const product = findProductById(productId)
  if (!product) throw new UnknownProductError(productId)
  const reviews = reviewsFor(product).sort(REVIEW_SORTERS[sort])
  return { reviews: reviews.slice(0, limit), total: reviews.length, sort }
}

export async function searchProducts(term: string, limit: number): Promise<ProductSummary[]> {
  await simulate('search')
  const words = term.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  return PRODUCTS.filter((product) => {
    const haystack =
      `${product.name} ${product.brand} ${product.categorySlug} ${product.colors.map((color) => color.name).join(' ')}`.toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
    .slice(0, limit)
    .map(toSummary)
}

export function productSummaries(ids: readonly string[]): ProductSummary[] {
  return ids.flatMap((id) => {
    const product = findProductById(id)
    return product ? [toSummary(product)] : []
  })
}
