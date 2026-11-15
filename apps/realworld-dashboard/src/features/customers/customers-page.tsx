import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CUSTOMER_TIERS, type CustomerTier } from '../../api/types'
import { SyncStatus } from '../../components/data/sync-status'
import { Card } from '../../components/ui/card'
import { EmptyState, ErrorPanel, PageSpinner } from '../../components/ui/feedback'
import { Input, Select } from '../../components/ui/form-controls'
import { Pagination } from '../../components/ui/pagination'
import { useDebouncedValue } from '../../lib/use-debounced-value'
import { customersListQuery } from './customer-queries'
import { CUSTOMERS_PAGE_SIZE } from './customers-search'
import { CustomersTable } from './customers-table'

const SEARCH_DEBOUNCE_MS = 250

export function CustomersPage() {
  const search = useSearch({ from: '/_app/customers/' })
  const navigate = useNavigate({ from: '/customers/' })
  const [term, setTerm] = useState(search.q)
  const debouncedTerm = useDebouncedValue(term.trim(), SEARCH_DEBOUNCE_MS)
  const customers = useQuery({
    ...customersListQuery({
      page: search.page,
      pageSize: CUSTOMERS_PAGE_SIZE,
      q: search.q,
      tier: search.tier,
    }),
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    if (debouncedTerm !== search.q)
      void navigate({
        search: (previous) => ({ ...previous, q: debouncedTerm, page: 1 }),
        replace: true,
      })
  }, [debouncedTerm, search.q, navigate])

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Customers</h1>
          <p className="text-sm text-slate-500">
            {customers.data
              ? `${customers.data.total.toLocaleString()} accounts`
              : 'Loading accounts…'}
          </p>
        </div>
        <SyncStatus
          label="Refresh customers"
          updatedAt={customers.dataUpdatedAt}
          fetching={customers.isFetching}
          onRefresh={() => void customers.refetch()}
        />
      </header>
      <div className="flex items-center gap-2">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-400" />
          <Input
            aria-label="Search customers"
            placeholder="Account or contact name"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          aria-label="Tier"
          value={search.tier ?? ''}
          onChange={(event) =>
            void navigate({
              search: (previous) => ({
                ...previous,
                tier: (event.target.value || undefined) as CustomerTier | undefined,
                page: 1,
              }),
            })
          }
          className="w-40"
        >
          <option value="">All tiers</option>
          {CUSTOMER_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </Select>
      </div>
      <Card className="overflow-hidden">
        {customers.isPending ? (
          <PageSpinner />
        ) : customers.isError ? (
          <div className="p-4">
            <ErrorPanel
              title="Customers could not be loaded"
              message={customers.error.message}
              onRetry={() => void customers.refetch()}
            />
          </div>
        ) : customers.data.items.length === 0 ? (
          <EmptyState
            title="No customers match"
            description="Try a different name or clear the tier filter."
          />
        ) : (
          <>
            <CustomersTable customers={customers.data.items} />
            <Pagination
              page={search.page}
              pageSize={CUSTOMERS_PAGE_SIZE}
              total={customers.data.total}
              onPageChange={(page) =>
                void navigate({ search: (previous) => ({ ...previous, page }) })
              }
            />
          </>
        )}
      </Card>
    </div>
  )
}
