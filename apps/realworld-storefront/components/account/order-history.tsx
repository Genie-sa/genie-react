'use client'

import { type ReactNode, useEffect, useState } from 'react'
import type { OrderFilter } from '../../lib/data/accounts'
import type { Order } from '../../lib/data/types'
import { formatDate } from '../../lib/locale'
import { useLocale } from '../providers/locale-context'
import { Price } from '../ui/price'
import { TextSkeleton } from '../ui/skeletons'

const FILTERS: readonly { value: OrderFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
]

export function OrderHistory(): ReactNode {
  const { locale } = useLocale()
  const [filter, setFilter] = useState<OrderFilter>('all')
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    fetch(`/api/orders?status=${filter}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Orders failed with ${response.status}`)
        const body = (await response.json()) as { orders: Order[] }
        setOrders(body.orders)
      })
      .catch(() => setFailed(true))
  }, [filter])

  return (
    <section aria-label="Order history">
      <div className="tabs" role="tablist" aria-label="Filter orders">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={option.value === filter}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {failed ? <p role="alert">Orders could not be loaded.</p> : null}
      {orders === null ? (
        <TextSkeleton lines={5} />
      ) : orders.length === 0 ? (
        <p className="muted">No orders here yet.</p>
      ) : (
        <table className="orders-table">
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Placed</th>
              <th scope="col">Status</th>
              <th scope="col">Items</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} data-status={order.status}>
                <th scope="row">{order.id}</th>
                <td>{formatDate(order.placedAt, locale)}</td>
                <td>
                  <span className={`status status-${order.status}`}>{order.status}</span>
                </td>
                <td>{order.itemCount}</td>
                <td>
                  <Price cents={order.totalCents} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
