export type CustomerColumnId =
  | 'name'
  | 'contact'
  | 'tier'
  | 'region'
  | 'manager'
  | 'openOrders'
  | 'lifetimeValue'

export interface CustomerColumn {
  id: CustomerColumnId
  label: string
  className: string
  essential: boolean
  align?: 'right'
}

export const CUSTOMER_COLUMNS: readonly CustomerColumn[] = [
  { id: 'name', label: 'Account', className: 'min-w-48', essential: true },
  { id: 'contact', label: 'Primary contact', className: 'min-w-40', essential: false },
  { id: 'tier', label: 'Tier', className: 'w-28', essential: true },
  { id: 'region', label: 'Region', className: 'w-20', essential: false },
  { id: 'manager', label: 'Account manager', className: 'min-w-36', essential: false },
  { id: 'openOrders', label: 'Open orders', className: 'w-24', essential: true, align: 'right' },
  {
    id: 'lifetimeValue',
    label: 'Lifetime value',
    className: 'w-32',
    essential: true,
    align: 'right',
  },
]
