import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { Price } from '../../../../../components/ui/price'
import { findPlacedOrder } from '../../../../../lib/data/checkout'

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}): Promise<ReactNode> {
  const order = findPlacedOrder((await params).orderId)
  if (!order) notFound()
  return (
    <section className="confirmation">
      <h1>Thank you</h1>
      <p>
        Order <strong>{order.id}</strong> is confirmed. We will email you when it ships.
      </p>
      <p>
        {order.itemCount} items · <Price cents={order.totalCents} />
      </p>
      <Link className="button" href="/">
        Continue shopping
      </Link>
    </section>
  )
}
