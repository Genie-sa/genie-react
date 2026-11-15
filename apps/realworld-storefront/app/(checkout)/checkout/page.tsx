import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { CheckoutFlow } from '../../../components/checkout/checkout-flow'
import { readCart } from '../../../lib/data/cart'
import { currentCartId, currentUser } from '../../../lib/server/session'

export const metadata: Metadata = { title: 'Checkout' }

export default async function CheckoutPage(): Promise<ReactNode> {
  const [cart, user] = await Promise.all([currentCartId().then(readCart), currentUser()])
  if (cart.lines.length === 0) redirect('/cart')
  return (
    <>
      <h1>Checkout</h1>
      <CheckoutFlow cart={cart} email={user?.email ?? ''} />
    </>
  )
}
