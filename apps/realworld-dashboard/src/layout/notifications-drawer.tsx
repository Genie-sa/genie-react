import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/endpoints'
import type { Notification } from '../api/types'
import { usePreferences } from '../app/preferences'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/ui/feedback'
import { Drawer } from '../components/ui/overlay'
import { cn } from '../lib/cn'

export function NotificationsDrawer({
  open,
  onClose,
  notifications,
}: {
  open: boolean
  onClose: () => void
  notifications: readonly Notification[]
}) {
  const queryClient = useQueryClient()
  const { formatRelative } = usePreferences()
  const markAllRead = useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Notifications"
      footer={
        <Button size="sm" loading={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
          Mark all as read
        </Button>
      }
    >
      {notifications.length === 0 ? (
        <EmptyState title="You're all caught up" />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {notifications.map((notification) => (
            <li key={notification.id} className={cn('py-3', !notification.read && 'font-medium')}>
              <p className="text-sm">{notification.title}</p>
              <p className="text-sm text-slate-500">{notification.body}</p>
              <p className="mt-1 text-xs text-slate-400">{formatRelative(notification.at)}</p>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  )
}
