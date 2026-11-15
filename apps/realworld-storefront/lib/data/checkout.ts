import { emptyCart, readCart } from './cart'
import { simulate } from './simulation'
import { storeState } from './state'
import type { Order, ShippingQuote } from './types'

const REMOTE_REGIONS = new Set(['IS', 'NO'])

export async function quoteShipping(country: string, postalCode: string): Promise<ShippingQuote[]> {
  await simulate('checkout.quote')
  const surcharge = REMOTE_REGIONS.has(country) ? 900 : 0
  const quotes: ShippingQuote[] = [
    { id: 'standard', label: 'Standard', priceCents: 495 + surcharge, businessDays: 5 },
    { id: 'express', label: 'Express', priceCents: 1495 + surcharge, businessDays: 2 },
  ]
  if (postalCode.trim().length >= 4) {
    quotes.push({ id: 'pickup', label: 'Store pickup', priceCents: 0, businessDays: 1 })
  }
  return quotes
}

export interface PlaceOrderInput {
  cartId: string
  userId: string | null
  email: string
  shippingCents: number
}

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  await simulate('checkout.place')
  const cart = await readCart(input.cartId)
  if (cart.lines.length === 0) throw new Error('Cart is empty')
  const { placedOrders } = storeState()
  const order: Order = {
    id: `SF-${String(90_000 + placedOrders.length + 1).padStart(6, '0')}`,
    userId: input.userId ?? `guest:${input.email}`,
    placedAt: new Date().toISOString(),
    status: 'processing',
    totalCents: cart.subtotalCents - cart.discountCents + input.shippingCents,
    itemCount: cart.itemCount,
    items: cart.lines.map((line) => ({ name: line.product.name, quantity: line.quantity })),
  }
  placedOrders.unshift(order)
  emptyCart(input.cartId)
  return order
}

export function findPlacedOrder(orderId: string): Order | null {
  return storeState().placedOrders.find((order) => order.id === orderId) ?? null
}
