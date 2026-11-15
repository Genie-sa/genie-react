import { createFileRoute } from '@tanstack/react-router'
import { NotificationSettings } from '../../../features/settings/notification-settings'

export const Route = createFileRoute('/_app/settings/notifications')({
  component: NotificationSettings,
})
