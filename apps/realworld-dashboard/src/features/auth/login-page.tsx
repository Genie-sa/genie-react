import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAuth } from '../../app/auth'
import { Button } from '../../components/ui/button'
import { ErrorPanel } from '../../components/ui/feedback'
import { Field, Input } from '../../components/ui/form-controls'

const loginSchema = z.object({
  email: z.email('Enter your work email'),
  password: z.string().min(1, 'Enter your password'),
})

type LoginValues = z.infer<typeof loginSchema>

const DEMO_ACCOUNTS = [
  { email: 'morgan@meridian.test', role: 'Admin' },
  { email: 'priya@meridian.test', role: 'Manager' },
  { email: 'sami@meridian.test', role: 'Agent' },
  { email: 'lina@meridian.test', role: 'Viewer' },
] as const

export function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const navigate = useNavigate()
  const { redirect } = useSearch({ from: '/login' })
  const [error, setError] = useState<string | null>(null)
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  const submit = form.handleSubmit(async ({ email, password }) => {
    setError(null)
    try {
      await login(email, password)
      await router.invalidate()
      await navigate({ to: redirect ?? '/' })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign-in failed')
    }
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-indigo-600 font-bold text-white">
            M
          </span>
          <span className="text-lg font-semibold">Meridian Ops</span>
        </div>
        <form onSubmit={submit} noValidate className="space-y-4">
          {error && <ErrorPanel title="Could not sign in" message={error} />}
          <Field label="Work email" error={errors.email?.message}>
            {(id) => (
              <Input
                id={id}
                type="email"
                autoComplete="username"
                aria-invalid={Boolean(errors.email)}
                {...form.register('email')}
              />
            )}
          </Field>
          <Field label="Password" error={errors.password?.message}>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                {...form.register('password')}
              />
            )}
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>
            Sign in
          </Button>
        </form>
        <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800">
          <p className="mb-2">Demo accounts (password “meridian”)</p>
          <ul className="space-y-1">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  className="hover:text-indigo-600"
                  onClick={() => form.reset({ email: account.email, password: 'meridian' })}
                >
                  {account.email} · {account.role}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
