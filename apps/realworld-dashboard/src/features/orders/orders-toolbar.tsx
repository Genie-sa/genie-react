import { Columns3, Rows3, Search } from 'lucide-react'
import { useState } from 'react'
import { ORDER_STATUSES, REGIONS } from '../../api/types'
import { Button } from '../../components/ui/button'
import { Checkbox, Input, Select } from '../../components/ui/form-controls'
import { useWorkspaceStore } from '../../stores/workspace'
import { HIDEABLE_COLUMNS, ORDER_COLUMNS } from './order-columns'
import { ORDER_STATUS_META } from './order-status'

export function OrdersToolbar({
  term,
  onTermChange,
  status,
  region,
  onFilterChange,
}: {
  term: string
  onTermChange: (term: string) => void
  status: string | undefined
  region: string | undefined
  onFilterChange: (filters: { status?: string; region?: string }) => void
}) {
  const density = useWorkspaceStore((state) => state.density)
  const setDensity = useWorkspaceStore((state) => state.setDensity)
  const hiddenColumns = useWorkspaceStore((state) => state.hiddenColumns)
  const toggleColumn = useWorkspaceStore((state) => state.toggleColumn)
  const [columnsOpen, setColumnsOpen] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-72">
        <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-400" />
        <Input
          aria-label="Filter orders"
          placeholder="Order number or customer"
          value={term}
          onChange={(event) => onTermChange(event.target.value)}
          className="pl-9"
        />
      </div>
      <Select
        aria-label="Status"
        value={status ?? ''}
        onChange={(event) => onFilterChange({ status: event.target.value || undefined, region })}
        className="w-40"
      >
        <option value="">All statuses</option>
        {ORDER_STATUSES.map((entry) => (
          <option key={entry} value={entry}>
            {ORDER_STATUS_META[entry].label}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Region"
        value={region ?? ''}
        onChange={(event) => onFilterChange({ status, region: event.target.value || undefined })}
        className="w-32"
      >
        <option value="">All regions</option>
        {REGIONS.map((entry) => (
          <option key={entry} value={entry}>
            {entry}
          </option>
        ))}
      </Select>
      <div className="ml-auto flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          aria-label="Toggle density"
          onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
        >
          <Rows3 className="size-4" />
          {density === 'compact' ? 'Compact' : 'Comfortable'}
        </Button>
        <div className="relative">
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={columnsOpen}
            onClick={() => setColumnsOpen((open) => !open)}
          >
            <Columns3 className="size-4" />
            Columns
          </Button>
          {columnsOpen && (
            <div className="absolute right-0 z-20 mt-1 w-44 space-y-1 rounded-md border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {ORDER_COLUMNS.filter((column) => HIDEABLE_COLUMNS.includes(column.id)).map(
                (column) => (
                  <label
                    key={column.id}
                    className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Checkbox
                      checked={!hiddenColumns.includes(column.id)}
                      onChange={() => toggleColumn(column.id)}
                    />
                    {column.label}
                  </label>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
