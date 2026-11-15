import type { OrderPriority, OrderStatus } from '../../api/types'
import { Badge, type BadgeTone } from '../../components/ui/badge'

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; tone: BadgeTone; color: string }
> = {
  pending: { label: 'Pending', tone: 'neutral', color: '#94a3b8' },
  processing: { label: 'Processing', tone: 'info', color: '#38bdf8' },
  on_hold: { label: 'On hold', tone: 'warning', color: '#f59e0b' },
  shipped: { label: 'Shipped', tone: 'info', color: '#6366f1' },
  delivered: { label: 'Delivered', tone: 'success', color: '#10b981' },
  cancelled: { label: 'Cancelled', tone: 'danger', color: '#f43f5e' },
}

const PRIORITY_TONES: Record<OrderPriority, BadgeTone> = {
  standard: 'neutral',
  expedited: 'warning',
  critical: 'danger',
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status]
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

export function PriorityBadge({ priority }: { priority: OrderPriority }) {
  return <Badge tone={PRIORITY_TONES[priority]}>{priority}</Badge>
}
