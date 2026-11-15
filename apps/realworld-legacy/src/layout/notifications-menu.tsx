import { RelativeTime } from '../components/relative-time'
import { Link } from 'react-router-dom'
import type { Notification } from '../api/types'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { markAllRead } from '../store/notifications'
import { notificationsToggled } from '../store/ui'

function NotificationItem({
  notification,
  onOpen,
}: {
  notification: Notification
  onOpen: () => void
}) {
  return (
    <Link
      to={`/issues/${notification.issueKey}`}
      className={notification.read ? 'notification' : 'notification notification--unread'}
      onClick={onOpen}
    >
      <span>{notification.text}</span>
      <RelativeTime iso={notification.createdAt} />
    </Link>
  )
}

export function NotificationsMenu() {
  const dispatch = useAppDispatch()
  const isOpen = useAppSelector((state) => state.ui.notificationsOpen)
  const items = useAppSelector((state) => state.notifications.items)
  const unreadCount = useAppSelector((state) => state.notifications.unreadCount)
  const close = () => dispatch(notificationsToggled(false))

  return (
    <div className="notifications">
      <button
        type="button"
        className="notifications__trigger"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={isOpen}
        onClick={() => dispatch(notificationsToggled())}
      >
        🔔{unreadCount > 0 && <span className="notifications__count">{unreadCount}</span>}
      </button>
      {isOpen && (
        <div className="menu notifications__panel" role="menu">
          <div className="menu__header">
            <strong>Notifications</strong>
            <button type="button" className="link-button" onClick={() => dispatch(markAllRead())}>
              Mark all read
            </button>
          </div>
          {items.length === 0 && <div className="muted">You're all caught up</div>}
          {items.slice(0, 10).map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onOpen={close} />
          ))}
        </div>
      )}
    </div>
  )
}
