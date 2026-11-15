import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { api } from '../../api/endpoints'
import type { NotificationPreferences } from '../../api/types'
import { toast } from '../../app/toasts'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { Checkbox } from '../../components/ui/form-controls'

const PREFERENCE_LABELS: Record<
  keyof NotificationPreferences,
  { label: string; description: string }
> = {
  orderEscalations: { label: 'Order escalations', description: 'Critical orders and SLA breaches' },
  dailyDigest: {
    label: 'Daily digest',
    description: 'A morning summary of yesterday’s fulfillment',
  },
  lowStockAlerts: {
    label: 'Low stock alerts',
    description: 'When a SKU drops below its reorder point',
  },
  mentions: { label: 'Mentions', description: 'When a teammate mentions you in a note' },
}

const preferencesKey = ['settings', 'notifications'] as const

export function NotificationSettings() {
  const queryClient = useQueryClient()
  const { data: preferences } = useSuspenseQuery({
    queryKey: preferencesKey,
    queryFn: ({ signal }) => api.notificationPreferences(signal),
  })
  const save = useMutation({
    mutationFn: api.updateNotificationPreferences,
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: preferencesKey })
      const previous = queryClient.getQueryData<NotificationPreferences>(preferencesKey)
      queryClient.setQueryData(preferencesKey, next)
      return { previous }
    },
    onError: (error, _next, context) => {
      if (context?.previous) queryClient.setQueryData(preferencesKey, context.previous)
      toast.error('Could not update notifications', error.message)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: preferencesKey }),
  })

  return (
    <Card>
      <CardHeader title="Email notifications" />
      <CardBody>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {(Object.keys(PREFERENCE_LABELS) as (keyof NotificationPreferences)[]).map((key) => (
            <li key={key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium">{PREFERENCE_LABELS[key].label}</p>
                <p className="text-xs text-slate-500">{PREFERENCE_LABELS[key].description}</p>
              </div>
              <Checkbox
                aria-label={PREFERENCE_LABELS[key].label}
                checked={preferences[key]}
                onChange={(event) => save.mutate({ ...preferences, [key]: event.target.checked })}
              />
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}
