import { Link } from '@tanstack/react-router'
import { memo } from 'react'
import type { OrderStatus, OrderSummary } from '../../api/types'
import { usePreferences } from '../../app/preferences'
import { Checkbox } from '../../components/ui/form-controls'
import { ActionMenu, type MenuItem } from '../../components/ui/menu'
import { cn } from '../../lib/cn'
import type { Density } from '../../stores/workspace'
import type { OrderColumn } from './order-columns'
import { OrderStatusBadge, PriorityBadge } from './order-status'

export interface OrderRowProps {
  order: OrderSummary
  columns: readonly OrderColumn[]
  selected: boolean
  density: Density
  start: number
  canEdit: boolean
  onToggleSelect: (id: string) => void
  onStatusChange: (id: string, status: OrderStatus) => void
}

export const OrderRow = memo(function OrderRow({
  order,
  columns,
  selected,
  density,
  start,
  canEdit,
  onToggleSelect,
  onStatusChange,
}: OrderRowProps) {
  const { formatMoney, formatDate } = usePreferences()
  const closed = order.status === 'cancelled' || order.status === 'delivered'
  const actions: MenuItem[] = [
    {
      id: 'hold',
      label: 'Put on hold',
      disabled: !canEdit || closed || order.status === 'on_hold',
      onSelect: () => onStatusChange(order.id, 'on_hold'),
    },
    {
      id: 'ship',
      label: 'Mark shipped',
      disabled: !canEdit || closed || order.status === 'shipped',
      onSelect: () => onStatusChange(order.id, 'shipped'),
    },
    {
      id: 'cancel',
      label: 'Cancel order',
      tone: 'danger',
      disabled: !canEdit || closed,
      onSelect: () => onStatusChange(order.id, 'cancelled'),
    },
  ]

  const cell = (column: OrderColumn) => {
    switch (column.id) {
      case 'number':
        return (
          <Link
            to="/orders/$orderId"
            params={{ orderId: order.id }}
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {order.number}
          </Link>
        )
      case 'customerName':
        return <span className="truncate">{order.customerName}</span>
      case 'status':
        return <OrderStatusBadge status={order.status} />
      case 'priority':
        return <PriorityBadge priority={order.priority} />
      case 'region':
        return order.region
      case 'itemCount':
        return order.itemCount
      case 'placedAt':
        return formatDate(order.placedAt)
      case 'total':
        return formatMoney(order.total)
    }
  }

  return (
    <div
      role="row"
      aria-selected={selected}
      data-order-id={order.id}
      className={cn(
        'absolute inset-x-0 flex items-center gap-3 border-b border-slate-100 px-4 text-sm has-[[aria-expanded=true]]:z-10 dark:border-slate-800',
        density === 'compact' ? 'h-9' : 'h-12',
        selected
          ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
          : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60',
      )}
      style={{ transform: `translateY(${start}px)` }}
    >
      <div role="gridcell" className="w-6">
        <Checkbox
          aria-label={`Select ${order.number}`}
          checked={selected}
          onChange={() => onToggleSelect(order.id)}
        />
      </div>
      {columns.map((column) => (
        <div
          key={column.id}
          role="gridcell"
          className={cn(
            'flex min-w-0 items-center tabular-nums',
            column.className,
            column.align === 'right' && 'justify-end',
          )}
        >
          {cell(column)}
        </div>
      ))}
      <div role="gridcell" className="w-8">
        <ActionMenu label={`Actions for ${order.number}`} items={actions} />
      </div>
    </div>
  )
})
