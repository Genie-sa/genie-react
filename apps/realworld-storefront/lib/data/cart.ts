import { findProductById, toSummary } from './catalog'
import { simulate } from './simulation'
import { type StoredCart, storeState } from './state'
import type { CartLine, CartView, Variant } from './types'

const PROMO_CODES: Record<string, number> = { WELCOME10: 0.1, WINTER15: 0.15 }

export type CartChangeResult =
  | { ok: true; cart: CartView }
  | { ok: false; reason: 'out-of-stock' | 'unknown-variant'; message: string; cart: CartView }

function storedCart(cartId: string): StoredCart {
  const { carts } = storeState()
  const existing = carts.get(cartId)
  if (existing) return existing
  const created: StoredCart = { lines: [], promoCode: null }
  carts.set(cartId, created)
  return created
}

export function findVariant(variantId: string) {
  const productId = variantId.split('-').slice(0, 2).join('-')
  const product = findProductById(productId)
  const variant = product?.variants.find((candidate) => candidate.id === variantId)
  return product && variant ? { product, variant } : null
}

function rejection(
  cart: StoredCart,
  reason: 'out-of-stock' | 'unknown-variant',
  message: string,
): CartChangeResult {
  return { ok: false, reason, message, cart: toCartView(cart) }
}

function outOfStockMessage({ stock, color, size }: Variant): string {
  return `Only ${stock} left in ${color}, ${size}.`
}

export function toCartView(cart: StoredCart): CartView {
  const lines = cart.lines.flatMap((line) => {
    const match = findVariant(line.variantId)
    if (!match) return []
    return [
      {
        variantId: line.variantId,
        product: toSummary(match.product),
        color: match.variant.color,
        size: match.variant.size,
        quantity: line.quantity,
        stock: match.variant.stock,
        unitCents: match.product.priceCents,
        lineCents: match.product.priceCents * line.quantity,
      },
    ]
  })
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineCents, 0)
  const rate = cart.promoCode ? (PROMO_CODES[cart.promoCode] ?? 0) : 0
  return {
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalCents,
    discountCents: Math.round(subtotalCents * rate),
    promoCode: cart.promoCode,
  }
}

export async function readCart(cartId: string | null): Promise<CartView> {
  await simulate('cart.read')
  if (!cartId) return toCartView({ lines: [], promoCode: null })
  return toCartView(storedCart(cartId))
}

export async function addCartLine(
  cartId: string,
  variantId: string,
  quantity: number,
): Promise<CartChangeResult> {
  await simulate('cart.mutate')
  const cart = storedCart(cartId)
  const match = findVariant(variantId)
  if (!match) return rejection(cart, 'unknown-variant', 'That option is no longer available.')
  const existing = cart.lines.find((line) => line.variantId === variantId)
  const nextQuantity = (existing?.quantity ?? 0) + quantity
  if (nextQuantity > match.variant.stock) {
    return rejection(cart, 'out-of-stock', outOfStockMessage(match.variant))
  }
  if (existing) existing.quantity = nextQuantity
  else cart.lines.push({ variantId, productId: match.product.id, quantity })
  return { ok: true, cart: toCartView(cart) }
}

export async function setCartLineQuantity(
  cartId: string,
  variantId: string,
  quantity: number,
): Promise<CartChangeResult> {
  await simulate('cart.mutate')
  const cart = storedCart(cartId)
  const match = findVariant(variantId)
  if (!match) return rejection(cart, 'unknown-variant', 'That option is no longer available.')
  if (quantity > match.variant.stock) {
    return rejection(cart, 'out-of-stock', outOfStockMessage(match.variant))
  }
  cart.lines =
    quantity <= 0
      ? cart.lines.filter((line) => line.variantId !== variantId)
      : cart.lines.map((line) => (line.variantId === variantId ? { ...line, quantity } : line))
  return { ok: true, cart: toCartView(cart) }
}

export async function applyPromoCode(
  cartId: string,
  code: string,
): Promise<{ ok: boolean; message: string }> {
  await simulate('cart.mutate')
  const normalized = code.trim().toUpperCase()
  if (!(normalized in PROMO_CODES)) return { ok: false, message: `${code} is not a valid code.` }
  storedCart(cartId).promoCode = normalized
  return { ok: true, message: `${normalized} applied.` }
}

export function replaceCart(cartId: string, lines: CartLine[]): CartView {
  const cart: StoredCart = { lines, promoCode: null }
  storeState().carts.set(cartId, cart)
  return toCartView(cart)
}

export function emptyCart(cartId: string): void {
  storeState().carts.delete(cartId)
}
