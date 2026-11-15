import type { CartPreset } from '../dev-contract'
import { findProductById } from './catalog'
import type { CartLine } from './types'

const STARTER_PRODUCTS = ['outerwear-002', 'knitwear-005', 'home-003']

function firstInStockVariant(productId: string): CartLine | null {
  const product = findProductById(productId)
  const variant = product?.variants.find((candidate) => candidate.stock >= 2)
  return product && variant ? { productId, variantId: variant.id, quantity: 1 } : null
}

function lowStockLine(): CartLine | null {
  for (const productId of STARTER_PRODUCTS) {
    const variant = findProductById(productId)?.variants.find((candidate) => candidate.stock === 2)
    if (variant) return { productId, variantId: variant.id, quantity: 2 }
  }
  return null
}

export function presetLines(preset: CartPreset): CartLine[] {
  const lines = preset === 'starter' ? STARTER_PRODUCTS.map(firstInStockVariant) : [lowStockLine()]
  return lines.filter((line): line is CartLine => line !== null)
}
