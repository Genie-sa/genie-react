import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { LoginForm } from '../../../components/account/login-form'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}): Promise<ReactNode> {
  const { next } = await searchParams
  return (
    <>
      <h1>Sign in</h1>
      <LoginForm next={next ?? '/account'} />
    </>
  )
}
