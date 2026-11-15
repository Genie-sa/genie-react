export interface Category {
  slug: string
  name: string
  tagline: string
  accentHue: number
}

export interface ColorOption {
  name: string
  hex: string
}

export type ImageAngle = 'front' | 'back' | 'detail' | 'lifestyle'

export interface ProductImage {
  id: string
  color: string
  angle: ImageAngle
  hue: number
  pattern: 'stripes' | 'dots' | 'grid' | 'waves'
}

export interface Variant {
  id: string
  color: string
  size: string
  stock: number
}

export interface Specification {
  label: string
  value: string
}

export interface Product {
  id: string
  slug: string
  name: string
  brand: string
  categorySlug: string
  description: string[]
  priceCents: number
  compareAtCents: number | null
  rating: number
  reviewCount: number
  colors: ColorOption[]
  sizes: string[]
  variants: Variant[]
  images: ProductImage[]
  specifications: Specification[]
  care: string[]
  tags: string[]
  addedAt: string
  relatedIds: string[]
}

export type ProductSummary = Pick<
  Product,
  | 'id'
  | 'slug'
  | 'name'
  | 'brand'
  | 'categorySlug'
  | 'priceCents'
  | 'compareAtCents'
  | 'rating'
  | 'reviewCount'
  | 'addedAt'
> & { image: ProductImage; colorCount: number }

export interface Review {
  id: string
  productId: string
  author: string
  rating: number
  title: string
  body: string
  createdAt: string
  helpfulCount: number
}

export interface RatingSummary {
  average: number
  total: number
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

export interface Inventory {
  productId: string
  byVariant: Record<string, number>
  totalStock: number
}

export interface CartLine {
  variantId: string
  productId: string
  quantity: number
}

export interface CartLineView {
  variantId: string
  product: ProductSummary
  color: string
  size: string
  quantity: number
  stock: number
  unitCents: number
  lineCents: number
}

export interface CartView {
  lines: CartLineView[]
  itemCount: number
  subtotalCents: number
  discountCents: number
  promoCode: string | null
}

export interface User {
  id: string
  email: string
  name: string
  memberSince: string
  tier: 'standard' | 'plus'
}

export type OrderStatus = 'processing' | 'shipped' | 'delivered' | 'cancelled'

export interface Order {
  id: string
  userId: string
  placedAt: string
  status: OrderStatus
  totalCents: number
  itemCount: number
  items: { name: string; quantity: number }[]
}

export interface ShippingQuote {
  id: 'standard' | 'express' | 'pickup'
  label: string
  priceCents: number
  businessDays: number
}

export type SortOrder = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'rating'

export interface CatalogQuery {
  categorySlug: string
  colors: string[]
  sizes: string[]
  maxPriceCents: number | null
  inStockOnly: boolean
  sort: SortOrder
  page: number
}

export interface CatalogPage {
  products: ProductSummary[]
  total: number
  page: number
  pageCount: number
  availableColors: ColorOption[]
  availableSizes: string[]
}
