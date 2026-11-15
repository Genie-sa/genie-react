import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { usePreferences } from '../../app/preferences'
import { Card } from '../../components/ui/card'
import { EmptyState } from '../../components/ui/feedback'
import { OrderStatusBadge } from '../orders/order-status'
import { customerOrdersQuery } from './customer-queries'

export function CustomerOrdersPanel({ customerId }: { customerId: string }) {
  const { formatMoney, formatDate } = usePreferences()
  const { data: orders } = useSuspenseQuery(customerOrdersQuery(customerId))
  if (orders.length === 0) {
    return (
      <Card>
        <EmptyState title="No orders yet" />
      </Card>
    )
  }
  return (
    <Card>
      <table aria-label="Recent orders" className="w-full text-sm">
        <thead className="border-b border-slate-100 text-left text-xs text-slate-500 dark:border-slate-800">
          <tr>
            <th className="px-4 py-2 font-medium">Order</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Placed</th>
            <th className="px-4 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="px-4 py-2">
                <Link
                  to="/orders/$orderId"
                  params={{ orderId: order.id }}
                  className="font-medium text-indigo-600 hover:underline"
                >
                  {order.number}
                </Link>
              </td>
              <td className="px-4 py-2">
                <OrderStatusBadge status={order.status} />
              </td>
              <td className="px-4 py-2">{formatDate(order.placedAt)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatMoney(order.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
