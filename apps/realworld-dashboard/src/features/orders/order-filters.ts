import { z } from 'zod'
import type { OrderSummary } from '../../api/types'
import { ORDER_STATUSES, REGIONS } from '../../api/types'

export const SORTABLE_COLUMNS = ['number', 'customerName', 'status', 'placedAt', 'total'] as const
export type SortColumn = (typeof SORTABLE_COLUMNS)[number]

export const ordersSearchSchema = z.object({
  status: z
    .enum(ORDER_STATUSES as [string, ...string[]])
    .optional()
    .catch(undefined),
  region: z
    .enum(REGIONS as [string, ...string[]])
    .optional()
    .catch(undefined),
  sort: z.enum(SORTABLE_COLUMNS).default('placedAt').catch('placedAt'),
  dir: z.enum(['asc', 'desc']).default('desc').catch('desc'),
})

export type OrdersSearch = z.infer<typeof ordersSearchSchema>

export function filterOrders(
  orders: readonly OrderSummary[],
  term: string,
): readonly OrderSummary[] {
  const needle = term.trim().toLowerCase()
  if (!needle) return orders
  return orders.filter(
    (order) =>
      order.number.toLowerCase().includes(needle) ||
      order.customerName.toLowerCase().includes(needle),
  )
}

export function sortOrders(
  orders: readonly OrderSummary[],
  column: SortColumn,
  direction: 'asc' | 'desc',
): OrderSummary[] {
  const factor = direction === 'asc' ? 1 : -1
  return [...orders].sort((a, b) => {
    const left = a[column]
    const right = b[column]
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor
    return String(left).localeCompare(String(right)) * factor
  })
}
