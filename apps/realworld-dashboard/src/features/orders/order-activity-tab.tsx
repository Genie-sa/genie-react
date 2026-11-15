import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { usePreferences } from '../../app/preferences'
import { Avatar } from '../../components/ui/avatar'
import { Card, CardBody } from '../../components/ui/card'
import { EmptyState, Skeleton } from '../../components/ui/feedback'
import { liveUpdates } from '../../lib/live-updates'
import { orderActivityQuery, orderKeys } from './order-queries'

export function OrderActivityTab({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient()
  const { formatRelative } = usePreferences()
  const { data: events } = useQuery(orderActivityQuery(orderId))

  useEffect(() => {
    liveUpdates.subscribe(`order:${orderId}`, () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) })
    })
  }, [orderId, queryClient])

  return (
    <Card>
      <CardBody>
        {!events ? (
          <Skeleton className="h-24" />
        ) : events.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Status changes and edits to this order show up here."
          />
        ) : (
          <ul className="space-y-4">
            {events.map((event) => (
              <li key={event.id} className="flex gap-3 text-sm">
                <Avatar name={event.actor} className="size-7" />
                <div>
                  <p>{event.message}</p>
                  <p className="text-xs text-slate-500">
                    {event.actor} · {formatRelative(event.at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
