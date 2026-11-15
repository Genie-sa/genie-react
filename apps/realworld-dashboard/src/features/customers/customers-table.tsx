import type { Customer } from '../../api/types'
import { cn } from '../../lib/cn'
import { useWorkspaceStore } from '../../stores/workspace'
import { CUSTOMER_COLUMNS } from './customer-columns'
import { CustomerRow } from './customer-row'

export function CustomersTable({ customers }: { customers: readonly Customer[] }) {
  const compact = useWorkspaceStore((state) => state.density) === 'compact'
  const columns = CUSTOMER_COLUMNS.filter((column) => !compact || column.essential)
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        <tr>
          {columns.map((column) => (
            <th
              key={column.id}
              scope="col"
              className={cn('px-4 py-2 font-medium', column.align === 'right' && 'text-right')}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {customers.map((customer) => (
          <CustomerRow key={customer.id} customer={customer} columns={columns} />
        ))}
      </tbody>
    </table>
  )
}
