import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { CartLines } from '../../../components/cart/cart-lines'
import { EmptyState } from '../../../components/ui/empty-state'
import { readCart } from '../../../lib/data/cart'
import { currentCartId } from '../../../lib/server/session'

export const metadata: Metadata = { title: 'Your bag' }

export default async function CartPage(): Promise<ReactNode> {
  const cart = await readCart(await currentCartId())
  if (cart.lines.length === 0) {
    return (
      <EmptyState
        title="Your bag is empty"
        message="Everything you add will wait here until checkout."
        action={{ href: '/', label: 'Start shopping' }}
      />
    )
  }
  return (
    <>
      <h1>Your bag</h1>
      <CartLines cart={cart} />
    </>
  )
}
