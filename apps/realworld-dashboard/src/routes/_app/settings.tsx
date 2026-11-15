import { createFileRoute } from '@tanstack/react-router'
import { SettingsLayout } from '../../features/settings/settings-layout'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsLayout,
})
