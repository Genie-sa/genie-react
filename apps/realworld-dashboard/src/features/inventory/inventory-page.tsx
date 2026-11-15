import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { StockLevel } from '../../api/types'
import { PermissionGate } from '../../app/permissions'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { EmptyState, ErrorPanel, PageSpinner } from '../../components/ui/feedback'
import { Checkbox, Input } from '../../components/ui/form-controls'
import { Pagination } from '../../components/ui/pagination'
import { useDebouncedValue } from '../../lib/use-debounced-value'
import { AdjustStockModal } from './adjust-stock-modal'
import { inventoryQuery } from './inventory-queries'

const PAGE_SIZE = 50

function stockTone(level: StockLevel) {
  if (level.totalOnHand === 0) return 'danger'
  return level.totalOnHand < level.reorderPoint ? 'warning' : 'success'
}

export function InventoryPage() {
  const search = useSearch({ from: '/_app/inventory' })
  const navigate = useNavigate({ from: '/inventory' })
  const [term, setTerm] = useState(search.q)
  const [adjusting, setAdjusting] = useState<StockLevel | null>(null)
  const debouncedTerm = useDebouncedValue(term.trim(), 250)
  const inventory = useQuery({
    ...inventoryQuery({ q: search.q, low: search.low }),
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    if (debouncedTerm !== search.q)
      void navigate({
        search: (previous) => ({ ...previous, q: debouncedTerm, page: 1 }),
        replace: true,
      })
  }, [debouncedTerm, search.q, navigate])

  const items = inventory.data?.items ?? []
  const visible = items.slice((search.page - 1) * PAGE_SIZE, search.page * PAGE_SIZE)

  return (
    <div className="space-y-4 p-6">
      <header>
        <h1 className="text-xl font-semibold">Inventory</h1>
        <p className="text-sm text-slate-500">
          {inventory.data
            ? `${inventory.data.total.toLocaleString()} SKUs across 6 warehouses`
            : 'Loading stock levels…'}
        </p>
      </header>
      <div className="flex items-center gap-4">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-400" />
          <Input
            aria-label="Search inventory"
            placeholder="Product name or SKU"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={search.low}
            onChange={(event) =>
              void navigate({
                search: (previous) => ({ ...previous, low: event.target.checked, page: 1 }),
              })
            }
          />
          Below reorder point only
        </label>
      </div>
      <Card className="overflow-hidden">
        {inventory.isPending ? (
          <PageSpinner />
        ) : inventory.isError ? (
          <div className="p-4">
            <ErrorPanel
              title="Inventory could not be loaded"
              message={inventory.error.message}
              onRetry={() => void inventory.refetch()}
            />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState title="No SKUs match" />
        ) : (
          <>
            <table aria-label="Stock levels" className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-2 font-medium">SKU</th>
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 text-right font-medium">On hand</th>
                  <th className="px-4 py-2 text-right font-medium">Reorder point</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.map((level) => (
                  <tr key={level.productId} data-product-id={level.productId}>
                    <td className="px-4 py-2 font-mono text-xs">{level.sku}</td>
                    <td className="px-4 py-2">{level.name}</td>
                    <td className="px-4 py-2 text-slate-500">{level.category}</td>
                    <td className="px-4 py-2 text-right">
                      <Badge tone={stockTone(level)}>{level.totalOnHand}</Badge>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{level.reorderPoint}</td>
                    <td className="px-4 py-2 text-right">
                      <PermissionGate permission="inventory.adjust">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Adjust ${level.sku}`}
                          onClick={() => setAdjusting(level)}
                        >
                          Adjust
                        </Button>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={search.page}
              pageSize={PAGE_SIZE}
              total={items.length}
              onPageChange={(page) =>
                void navigate({ search: (previous) => ({ ...previous, page }) })
              }
            />
          </>
        )}
      </Card>
      {adjusting && <AdjustStockModal level={adjusting} onClose={() => setAdjusting(null)} />}
    </div>
  )
}
