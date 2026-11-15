import type { Shipment } from '../../api/types'
import { usePreferences } from '../../app/preferences'
import { Badge } from '../../components/ui/badge'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { EmptyState } from '../../components/ui/feedback'

export function OrderShipmentsTab({ shipments }: { shipments: readonly Shipment[] }) {
  const { formatDateTime } = usePreferences()
  if (shipments.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No shipments yet"
          description="A shipment appears once the order leaves the warehouse."
        />
      </Card>
    )
  }
  return (
    <div className="space-y-4">
      {shipments.map((shipment) => (
        <Card key={shipment.id}>
          <CardHeader
            title={`${shipment.carrierName} · ${shipment.trackingNumber}`}
            actions={
              <Badge tone={shipment.status === 'delivered' ? 'success' : 'info'}>
                {shipment.status.replaceAll('_', ' ')}
              </Badge>
            }
          />
          <CardBody>
            <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-slate-700">
              {shipment.events.map((event) => (
                <li key={event.at} className="text-sm">
                  <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-white bg-indigo-500 dark:border-slate-900" />
                  <p className="font-medium">{event.description}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(event.at)} · {event.location}
                  </p>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      ))}
    </div>
  )
}
