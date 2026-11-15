'use server'

import { redirect } from 'next/navigation'
import { type CheckoutValues, type FieldErrors, fieldErrors, orderSchema } from '../checkout-schema'
import { placeOrder, quoteShipping } from '../data/checkout'
import { SimulatedFailure } from '../data/simulation'
import { currentUser, requireCartId } from '../server/session'

export interface PlaceOrderState {
  formError: string | null
  fieldErrors: FieldErrors<CheckoutValues>
}

export async function submitOrder(
  _previous: PlaceOrderState,
  formData: FormData,
): Promise<PlaceOrderState> {
  const parsed = orderSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { formError: 'Check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) }
  }
  const values = parsed.data
  const quote = (await quoteShipping(values.country, values.postalCode)).find(
    (option) => option.id === values.shippingMethod,
  )
  if (!quote) {
    return {
      formError: null,
      fieldErrors: { shippingMethod: 'That option is not available for this address' },
    }
  }
  let orderId: string
  try {
    const order = await placeOrder({
      cartId: await requireCartId(),
      userId: (await currentUser())?.id ?? null,
      email: values.email,
      shippingCents: quote.priceCents,
    })
    orderId = order.id
  } catch (error) {
    if (error instanceof SimulatedFailure) {
      return { formError: 'Payment could not be processed. Try again.', fieldErrors: {} }
    }
    throw error
  }
  redirect(`/checkout/confirmation/${orderId}`)
}
