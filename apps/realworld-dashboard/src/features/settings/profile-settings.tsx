import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { api } from '../../api/endpoints'
import { toast } from '../../app/toasts'
import { Button } from '../../components/ui/button'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { Field, Input, Select } from '../../components/ui/form-controls'

const TIMEZONES = [
  'America/Chicago',
  'America/New_York',
  'Europe/Berlin',
  'Europe/London',
  'Asia/Singapore',
  'Asia/Tokyo',
] as const

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80),
  email: z.email('Enter a valid email address'),
  title: z.string().trim().max(80),
  timezone: z.string().min(3),
})

type ProfileValues = z.infer<typeof profileSchema>

export const profileQueryKey = ['settings', 'profile'] as const

export function ProfileSettings() {
  const queryClient = useQueryClient()
  const { data: profile } = useSuspenseQuery({
    queryKey: profileQueryKey,
    queryFn: ({ signal }) => api.profile(signal),
  })
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), values: profile })
  const save = useMutation({
    mutationFn: api.updateProfile,
    onSuccess: (saved) => {
      queryClient.setQueryData(profileQueryKey, saved)
      toast.success('Profile saved')
    },
    onError: (error) => toast.error('Could not save profile', error.message),
  })
  const { errors, isDirty } = form.formState

  return (
    <Card>
      <CardHeader title="Profile" description="How you appear to your team" />
      <CardBody>
        <form
          onSubmit={form.handleSubmit((values) => save.mutate(values))}
          noValidate
          className="grid max-w-xl gap-4"
        >
          <Field label="Full name" error={errors.name?.message}>
            {(id) => (
              <Input id={id} aria-invalid={Boolean(errors.name)} {...form.register('name')} />
            )}
          </Field>
          <Field label="Email" error={errors.email?.message}>
            {(id) => (
              <Input
                id={id}
                type="email"
                aria-invalid={Boolean(errors.email)}
                {...form.register('email')}
              />
            )}
          </Field>
          <Field label="Job title" error={errors.title?.message}>
            {(id) => <Input id={id} {...form.register('title')} />}
          </Field>
          <Field label="Time zone" error={errors.timezone?.message}>
            {(id) => (
              <Select id={id} {...form.register('timezone')}>
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace('_', ' ')}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div>
            <Button type="submit" variant="primary" disabled={!isDirty} loading={save.isPending}>
              Save profile
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
