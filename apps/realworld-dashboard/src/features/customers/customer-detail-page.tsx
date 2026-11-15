import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PermissionGate } from '../../app/permissions'
import { Button } from '../../components/ui/button'
import { Tabs } from '../../components/ui/tabs'
import { useWorkspaceStore } from '../../stores/workspace'
import { CustomerEditModal } from './customer-edit-modal'
import { CustomerNotes } from './customer-notes'
import { CustomerOrdersPanel } from './customer-orders-panel'
import { CustomerProfileCard } from './customer-profile-card'
import { customerQuery } from './customer-queries'
import { RelatedAccounts } from './related-accounts'
import { TierBadge } from './tier-badge'

type CustomerTab = 'profile' | 'orders'

const CUSTOMER_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'orders', label: 'Recent orders' },
] as const

export function CustomerDetailPage() {
  const { customerId } = useParams({ from: '/_app/customers/$customerId' })
  const { data: customer } = useSuspenseQuery(customerQuery(customerId))
  const pushRecent = useWorkspaceStore((state) => state.pushRecent)
  const [tab, setTab] = useState<CustomerTab>('profile')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    pushRecent({ id: customer.id, label: customer.name, kind: 'customer' })
  }, [customer.id, customer.name, pushRecent])

  return (
    <div className="space-y-6 p-6">
      <Link
        to="/customers"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" />
        All customers
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{customer.name}</h1>
            <TierBadge tier={customer.tier} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {customer.region} · Managed by {customer.accountManager}
          </p>
        </div>
        <PermissionGate permission="customers.edit">
          <Button onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            Edit account
          </Button>
        </PermissionGate>
      </header>
      <Tabs label="Customer sections" items={CUSTOMER_TABS} value={tab} onChange={setTab} />
      {tab === 'profile' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <CustomerProfileCard customer={customer} />
            <CustomerNotes customer={customer} />
          </div>
          <RelatedAccounts ids={customer.relatedIds} />
        </div>
      ) : (
        <CustomerOrdersPanel customerId={customer.id} />
      )}
      {editing && <CustomerEditModal customer={customer} onClose={() => setEditing(false)} />}
    </div>
  )
}
