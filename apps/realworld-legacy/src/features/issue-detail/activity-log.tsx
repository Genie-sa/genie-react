import { RelativeTime } from '../../components/relative-time'
import { UserName } from '../../components/user-name'
import { useActivity } from './use-activity'

export function ActivityLog({ issueKey, types }: { issueKey: string; types: string[] }) {
  const { events, status } = useActivity(issueKey, types)
  if (status === 'failed') return <p className="form-error">Could not load activity</p>
  return (
    <ol className="activity-log" aria-busy={status === 'loading'}>
      {events.map((event) => (
        <li key={event.id} className="activity-log__event">
          <UserName userId={event.actorId} /> {event.detail} <RelativeTime iso={event.at} />
        </li>
      ))}
    </ol>
  )
}
