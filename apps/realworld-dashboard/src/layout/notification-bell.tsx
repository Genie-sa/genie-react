import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api/endpoints'
import { LIVE_UPDATES_ALL_TOPICS, liveUpdates } from '../lib/live-updates'
import { NotificationsDrawer } from './notifications-drawer'

export const notificationsQueryKey = ['notifications'] as const

export function NotificationBell() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const { data: notifications = [] } = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: ({ signal }) => api.notifications(signal),
  })
  const unread = notifications.filter((notification) => !notification.read).length

  useEffect(
    () =>
      liveUpdates.subscribe(LIVE_UPDATES_ALL_TOPICS, () => {
        void queryClient.invalidateQueries(
          { queryKey: notificationsQueryKey },
          { cancelRefetch: false },
        )
      }),
    [queryClient],
  )

  return (
    <>
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        onClick={() => setOpen(true)}
        className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>
      <NotificationsDrawer
        open={open}
        onClose={() => setOpen(false)}
        notifications={notifications}
      />
    </>
  )
}
