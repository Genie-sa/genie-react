import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { api } from '../../api/endpoints'
import type { Order } from '../../api/types'
import { usePreferences } from '../../app/preferences'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { Skeleton } from '../../components/ui/feedback'
import { customerQuery } from '../customers/customer-queries'

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}

export function OrderOverviewTab({ order }: { order: Order }) {
  const { formatMoney, formatDateTime } = usePreferences()
  const customer = useQuery(customerQuery(order.customerId))
  const warehouses = useQuery({
    queryKey: ['reference', 'warehouses'],
    queryFn: ({ signal }) => api.warehouses(signal),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const warehouse = warehouses.data?.find((entry) => entry.id === order.warehouseId)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Fulfillment" />
        <CardBody>
          <dl className="divide-y divide-slate-100 dark:divide-slate-800">
            <DetailRow label="Warehouse" value={warehouse?.name ?? order.warehouseId} />
            <DetailRow label="Ship to" value={order.shippingAddress} />
            <DetailRow label="Units" value={order.itemCount} />
            <DetailRow label="Order total" value={formatMoney(order.total)} />
            <DetailRow label="Last updated" value={formatDateTime(order.updatedAt)} />
          </dl>
          {order.notes && (
            <p className="mt-3 rounded bg-slate-50 p-3 text-sm dark:bg-slate-800">{order.notes}</p>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Customer" />
        <CardBody>
          {!customer.data ? (
            <Skeleton className="h-28" />
          ) : (
            <dl className="divide-y divide-slate-100 dark:divide-slate-800">
              <DetailRow
                label="Account"
                value={
                  <Link
                    to="/customers/$customerId"
                    params={{ customerId: customer.data.id }}
                    className="text-indigo-600 hover:underline"
                  >
                    {customer.data.name}
                  </Link>
                }
              />
              <DetailRow label="Contact" value={customer.data.contactName} />
              <DetailRow label="Email" value={customer.data.email} />
              <DetailRow label="Tier" value={customer.data.tier} />
              <DetailRow label="Lifetime value" value={formatMoney(customer.data.lifetimeValue)} />
            </dl>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
