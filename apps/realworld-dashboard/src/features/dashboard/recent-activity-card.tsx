import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/endpoints'
import { usePreferences } from '../../app/preferences'
import { Avatar } from '../../components/ui/avatar'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { Skeleton } from '../../components/ui/feedback'

const VISIBLE_EVENTS = 6

export function RecentActivityCard() {
  const { formatRelative } = usePreferences()
  const { data: events } = useQuery({
    queryKey: ['activity', 'recent'],
    queryFn: ({ signal }) => api.activity(0, signal),
    select: (all) => all.slice(-VISIBLE_EVENTS).reverse(),
  })
  return (
    <Card>
      <CardHeader title="Recent activity" />
      <CardBody>
        {!events ? (
          <Skeleton className="h-32" />
        ) : (
          <ul className="space-y-3">
            {events.map((event) => (
              <li key={event.id} className="flex items-start gap-3 text-sm">
                <Avatar name={event.actor} className="size-6 text-[10px]" />
                <div className="min-w-0">
                  <p className="truncate">{event.message}</p>
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
