import { createFileRoute } from '@tanstack/react-router'
import { api } from '../../../api/endpoints'
import { ProfileSettings, profileQueryKey } from '../../../features/settings/profile-settings'

export const Route = createFileRoute('/_app/settings/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: profileQueryKey,
      queryFn: ({ signal }) => api.profile(signal),
    }),
  component: ProfileSettings,
})
