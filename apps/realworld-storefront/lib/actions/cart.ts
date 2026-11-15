'use server'

import { revalidatePath } from 'next/cache'
import {
  addCartLine,
  applyPromoCode,
  type CartChangeResult,
  setCartLineQuantity,
} from '../data/cart'
import { requireCartId } from '../server/session'

export async function addToCart(variantId: string, quantity: number): Promise<CartChangeResult> {
  const cartId = await requireCartId()
  return addCartLine(cartId, variantId, quantity)
}

export async function updateLineQuantity(
  variantId: string,
  quantity: number,
): Promise<CartChangeResult> {
  const cartId = await requireCartId()
  const result = await setCartLineQuantity(cartId, variantId, quantity)
  if (result.ok) revalidatePath('/', 'layout')
  return result
}

export interface PromoFormState {
  status: 'idle' | 'applied' | 'rejected'
  message: string
}

export async function applyPromo(
  _previous: PromoFormState,
  formData: FormData,
): Promise<PromoFormState> {
  const code = String(formData.get('code') ?? '')
  if (!code.trim()) return { status: 'rejected', message: 'Enter a code.' }
  const result = await applyPromoCode(await requireCartId(), code)
  if (result.ok) revalidatePath('/', 'layout')
  return { status: result.ok ? 'applied' : 'rejected', message: result.message }
}
