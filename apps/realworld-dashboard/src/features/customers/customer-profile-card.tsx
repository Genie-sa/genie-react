import type { Customer } from '../../api/types'
import { usePreferences } from '../../app/preferences'
import { Card, CardBody, CardHeader } from '../../components/ui/card'

export function CustomerProfileCard({ customer }: { customer: Customer }) {
  const { formatMoney, formatDate } = usePreferences()
  const facts = [
    ['Primary contact', customer.contactName],
    ['Email', customer.email],
    ['Phone', customer.phone],
    ['Customer since', formatDate(customer.createdAt)],
    ['Open orders', String(customer.openOrders)],
    ['Lifetime value', formatMoney(customer.lifetimeValue)],
  ] as const
  return (
    <Card>
      <CardHeader title="Account" />
      <CardBody>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  )
}
