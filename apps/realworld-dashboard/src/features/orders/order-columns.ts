import type { SortColumn } from './order-filters'

export type OrderColumnId =
  | 'number'
  | 'customerName'
  | 'status'
  | 'priority'
  | 'region'
  | 'itemCount'
  | 'placedAt'
  | 'total'

export interface OrderColumn {
  id: OrderColumnId
  label: string
  className: string
  sortKey?: SortColumn
  align?: 'right'
}

export const ORDER_COLUMNS: readonly OrderColumn[] = [
  { id: 'number', label: 'Order', className: 'w-28', sortKey: 'number' },
  { id: 'customerName', label: 'Customer', className: 'flex-1 min-w-40', sortKey: 'customerName' },
  { id: 'status', label: 'Status', className: 'w-28', sortKey: 'status' },
  { id: 'priority', label: 'Priority', className: 'w-24' },
  { id: 'region', label: 'Region', className: 'w-20' },
  { id: 'itemCount', label: 'Units', className: 'w-16', align: 'right' },
  { id: 'placedAt', label: 'Placed', className: 'w-32', sortKey: 'placedAt' },
  { id: 'total', label: 'Total', className: 'w-28', sortKey: 'total', align: 'right' },
]

export const HIDEABLE_COLUMNS: readonly OrderColumnId[] = ['priority', 'region', 'itemCount']
