import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PermissionGate } from '../../app/permissions'
import { usePreferences } from '../../app/preferences'
import { Button } from '../../components/ui/button'
import { Tabs } from '../../components/ui/tabs'
import { usePageView } from '../../lib/telemetry'
import { useWorkspaceStore } from '../../stores/workspace'
import { OrderActivityTab } from './order-activity-tab'
import { ORDER_DETAIL_TABS, type OrderDetailTab } from './order-detail-search'
import { OrderEditDrawer } from './order-edit-drawer'
import { OrderItemsTab } from './order-items-tab'
import { OrderOverviewTab } from './order-overview-tab'
import { orderQuery, orderShipmentsQuery } from './order-queries'
import { OrderShipmentsTab } from './order-shipments-tab'
import { OrderStatusBadge, PriorityBadge } from './order-status'

export function OrderDetailPage() {
  const { orderId } = useParams({ from: '/_app/orders/$orderId' })
  const { tab } = useSearch({ from: '/_app/orders/$orderId' })
  const navigate = useNavigate({ from: '/orders/$orderId' })
  const { data: order } = useSuspenseQuery(orderQuery(orderId))
  const { data: shipments } = useSuspenseQuery(orderShipmentsQuery(orderId))
  const { formatMoney, formatDateTime } = usePreferences()
  const pushRecent = useWorkspaceStore((state) => state.pushRecent)
  const [editing, setEditing] = useState(false)

  usePageView('order_detail', { orderId, tab })

  useEffect(() => {
    pushRecent({ id: order.id, label: order.number, kind: 'order' })
  }, [order.id, order.number, pushRecent])

  const tabs = ORDER_DETAIL_TABS.map((entry) => ({
    ...entry,
    count:
      entry.id === 'items'
        ? order.lines.length
        : entry.id === 'shipments'
          ? shipments.length
          : undefined,
  }))
  const selectTab = (next: OrderDetailTab) =>
    void navigate({ search: { tab: next }, replace: true })

  return (
    <div className="space-y-6 p-6">
      <Link
        to="/orders"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" />
        All orders
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{order.number}</h1>
            <OrderStatusBadge status={order.status} />
            <PriorityBadge priority={order.priority} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <Link
              to="/customers/$customerId"
              params={{ customerId: order.customerId }}
              className="font-medium text-indigo-600 hover:underline"
            >
              {order.customerName}
            </Link>{' '}
            · Placed {formatDateTime(order.placedAt)} · {formatMoney(order.total)}
          </p>
        </div>
        <PermissionGate permission="orders.edit">
          <Button onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            Edit order
          </Button>
        </PermissionGate>
      </header>
      <Tabs label="Order sections" items={tabs} value={tab} onChange={selectTab} />
      {tab === 'overview' && <OrderOverviewTab order={order} />}
      {tab === 'items' && <OrderItemsTab order={order} />}
      {tab === 'shipments' && <OrderShipmentsTab shipments={shipments} />}
      {tab === 'activity' && <OrderActivityTab orderId={order.id} />}
      <OrderEditDrawer
        key={order.id}
        order={order}
        open={editing}
        onClose={() => setEditing(false)}
      />
    </div>
  )
}
