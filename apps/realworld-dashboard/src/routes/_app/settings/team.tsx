import { createFileRoute, redirect } from '@tanstack/react-router'
import { TeamSettings } from '../../../features/settings/team-settings'

export const Route = createFileRoute('/_app/settings/team')({
  beforeLoad: ({ context }) => {
    if (context.auth.session?.user.role !== 'admin') throw redirect({ to: '/settings' })
  },
  component: TeamSettings,
})
