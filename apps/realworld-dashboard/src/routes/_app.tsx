import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { Suspense } from 'react'
import { useAuth } from '../app/auth'
import { PermissionsProvider } from '../app/permissions'
import { PageSpinner } from '../components/ui/feedback'
import { AppShell } from '../layout/app-shell'

export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.session) throw redirect({ to: '/login', search: { redirect: location.href } })
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { session } = useAuth()
  if (!session) return null
  return (
    <PermissionsProvider role={session.user.role}>
      <Suspense fallback={<PageSpinner />}>
        <AppShell>
          <Outlet />
        </AppShell>
      </Suspense>
    </PermissionsProvider>
  )
}
