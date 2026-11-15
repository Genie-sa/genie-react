import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useCallback, useMemo, useRef } from 'react'
import type { OrderSummary } from '../../api/types'
import { usePermissions } from '../../app/permissions'
import { EmptyState } from '../../components/ui/feedback'
import { Checkbox } from '../../components/ui/form-controls'
import { cn } from '../../lib/cn'
import { useWorkspaceStore } from '../../stores/workspace'
import { ORDER_COLUMNS } from './order-columns'
import type { SortColumn } from './order-filters'
import { useUpdateOrderStatus } from './order-queries'
import { OrderRow } from './order-row'

const ROW_HEIGHT = { comfortable: 48, compact: 36 } as const
const OVERSCAN = 6

export function OrdersTable({
  rows,
  sort,
  dir,
  onSortChange,
}: {
  rows: readonly OrderSummary[]
  sort: SortColumn
  dir: 'asc' | 'desc'
  onSortChange: (column: SortColumn) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const density = useWorkspaceStore((state) => state.density)
  const hiddenColumns = useWorkspaceStore((state) => state.hiddenColumns)
  const selectedIds = useWorkspaceStore((state) => state.selectedOrderIds)
  const toggleOrderSelection = useWorkspaceStore((state) => state.toggleOrderSelection)
  const setOrderSelection = useWorkspaceStore((state) => state.setOrderSelection)
  const { can } = usePermissions()
  const { mutate: changeStatus } = useUpdateOrderStatus()

  const columns = useMemo(
    () => ORDER_COLUMNS.filter((column) => !hiddenColumns.includes(column.id)),
    [hiddenColumns],
  )
  const onStatusChange = useCallback(
    (id: string, status: OrderSummary['status']) => {
      const order = rows.find((row) => row.id === id)
      if (order) changeStatus({ id, number: order.number, status })
    },
    [rows, changeStatus],
  )

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT[density],
    overscan: OVERSCAN,
  })

  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id))
  const canEdit = can('orders.edit')

  return (
    <div
      role="grid"
      aria-label="Orders"
      aria-rowcount={rows.length}
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div
        role="row"
        className="flex h-10 shrink-0 items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="w-6">
          <Checkbox
            aria-label="Select all orders"
            checked={allSelected}
            onChange={() => setOrderSelection(allSelected ? [] : rows.map((row) => row.id))}
          />
        </div>
        {columns.map((column) => (
          <div
            key={column.id}
            role="columnheader"
            className={cn(
              'flex items-center',
              column.className,
              column.align === 'right' && 'justify-end',
            )}
          >
            {column.sortKey ? (
              <button
                type="button"
                onClick={() => column.sortKey && onSortChange(column.sortKey)}
                className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200"
              >
                {column.label}
                {sort === column.sortKey &&
                  (dir === 'asc' ? (
                    <ArrowUp className="size-3" />
                  ) : (
                    <ArrowDown className="size-3" />
                  ))}
              </button>
            ) : (
              column.label
            )}
          </div>
        ))}
        <div className="w-8" />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No orders match these filters"
          description="Clear a filter or search for a different order number."
        />
      ) : (
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
          <div style={{ height: virtualizer.getTotalSize() }} className="relative">
            {virtualizer.getVirtualItems().map((item) => {
              const order = rows[item.index]
              if (!order) return null
              return (
                <OrderRow
                  key={order.id}
                  order={order}
                  columns={columns}
                  selected={selectedIds.has(order.id)}
                  density={density}
                  start={item.start}
                  canEdit={canEdit}
                  onToggleSelect={toggleOrderSelection}
                  onStatusChange={onStatusChange}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
