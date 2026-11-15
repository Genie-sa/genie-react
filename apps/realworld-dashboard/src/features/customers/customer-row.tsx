import { Link } from '@tanstack/react-router'
import { memo } from 'react'
import type { Customer } from '../../api/types'
import { usePreferences } from '../../app/preferences'
import { cn } from '../../lib/cn'
import type { CustomerColumn } from './customer-columns'
import { TierBadge } from './tier-badge'

export const CustomerRow = memo(function CustomerRow({
  customer,
  columns,
}: {
  customer: Customer
  columns: readonly CustomerColumn[]
}) {
  const { formatMoney } = usePreferences()
  const cell = (column: CustomerColumn) => {
    switch (column.id) {
      case 'name':
        return (
          <Link
            to="/customers/$customerId"
            params={{ customerId: customer.id }}
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {customer.name}
          </Link>
        )
      case 'contact':
        return (
          <span>
            {customer.contactName}
            <span className="block text-xs text-slate-500">{customer.email}</span>
          </span>
        )
      case 'tier':
        return <TierBadge tier={customer.tier} />
      case 'region':
        return customer.region
      case 'manager':
        return customer.accountManager
      case 'openOrders':
        return customer.openOrders
      case 'lifetimeValue':
        return formatMoney(customer.lifetimeValue)
    }
  }
  return (
    <tr data-customer-id={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
      {columns.map((column) => (
        <td
          key={column.id}
          className={cn(
            'px-4 py-2.5 tabular-nums',
            column.className,
            column.align === 'right' && 'text-right',
          )}
        >
          {cell(column)}
        </td>
      ))}
    </tr>
  )
})
