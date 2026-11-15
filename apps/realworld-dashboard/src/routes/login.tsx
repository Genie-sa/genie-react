import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { LoginPage } from '../features/auth/login-page'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().startsWith('/').optional().catch(undefined) }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.session) throw redirect({ to: search.redirect ?? '/' })
  },
  component: LoginPage,
})
