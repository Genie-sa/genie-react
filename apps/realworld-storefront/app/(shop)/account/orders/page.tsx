import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { OrderHistory } from '../../../../components/account/order-history'

export const metadata: Metadata = { title: 'Orders' }

export default function OrdersPage(): ReactNode {
  return (
    <>
      <h1>Orders</h1>
      <OrderHistory />
    </>
  )
}
