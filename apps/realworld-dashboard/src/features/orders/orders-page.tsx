import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { PermissionGate } from '../../app/permissions'
import { SyncStatus } from '../../components/data/sync-status'
import { ErrorPanel, PageSpinner } from '../../components/ui/feedback'
import { BulkActionBar } from './bulk-action-bar'
import { filterOrders, type SortColumn, sortOrders } from './order-filters'
import { ordersListQuery } from './order-queries'
import { OrdersTable } from './orders-table'
import { OrdersToolbar } from './orders-toolbar'

export function OrdersPage() {
  const search = useSearch({ from: '/_app/orders/' })
  const navigate = useNavigate({ from: '/orders/' })
  const [term, setTerm] = useState('')
  const deferredTerm = useDeferredValue(term)
  const orders = useQuery({
    ...ordersListQuery({ status: search.status, region: search.region }),
    placeholderData: keepPreviousData,
  })

  const rows = useMemo(
    () => sortOrders(filterOrders(orders.data?.items ?? [], deferredTerm), search.sort, search.dir),
    [orders.data, deferredTerm, search.sort, search.dir],
  )

  const changeSort = (column: SortColumn) =>
    void navigate({
      search: (previous) => ({
        ...previous,
        sort: column,
        dir: previous.sort === column && previous.dir === 'desc' ? 'asc' : 'desc',
      }),
    })

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Orders</h1>
          <p className="text-sm text-slate-500">
            {orders.data
              ? `${rows.length.toLocaleString()} of ${orders.data.total.toLocaleString()} orders`
              : 'Loading orders…'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <SyncStatus
            label="Refresh orders"
            updatedAt={orders.dataUpdatedAt}
            fetching={orders.isFetching}
            onRefresh={() => void orders.refetch()}
          />
          <PermissionGate permission="orders.create">
            <Link
              to="/orders/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              <Plus className="size-4" />
              New order
            </Link>
          </PermissionGate>
        </div>
      </header>
      <OrdersToolbar
        term={term}
        onTermChange={setTerm}
        status={search.status}
        region={search.region}
        onFilterChange={(filters) =>
          void navigate({ search: (previous) => ({ ...previous, ...filters }) })
        }
      />
      <PermissionGate permission="orders.bulk">
        <BulkActionBar />
      </PermissionGate>
      {orders.isPending ? (
        <PageSpinner />
      ) : orders.isError ? (
        <ErrorPanel
          title="Orders could not be loaded"
          message={orders.error.message}
          onRetry={() => void orders.refetch()}
        />
      ) : (
        <OrdersTable rows={rows} sort={search.sort} dir={search.dir} onSortChange={changeSort} />
      )}
    </div>
  )
}
