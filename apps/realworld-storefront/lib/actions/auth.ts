'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE } from '../cookie-names'
import { createSession, DEMO_PASSWORD, endSession, findUserByEmail } from '../data/accounts'

export interface SignInState {
  error: string | null
  email: string
}

function safeRedirectTarget(value: FormDataEntryValue | null): string {
  const target = typeof value === 'string' ? value : ''
  return target.startsWith('/') && !target.startsWith('//') ? target : '/account'
}

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '')
  const user = findUserByEmail(email)
  if (!user || formData.get('password') !== DEMO_PASSWORD) {
    return { error: 'That email and password do not match an account.', email }
  }
  ;(await cookies()).set(SESSION_COOKIE, createSession(user), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })
  redirect(safeRedirectTarget(formData.get('next')))
}

export async function signOut(): Promise<void> {
  const jar = await cookies()
  endSession(jar.get(SESSION_COOKIE)?.value)
  jar.delete(SESSION_COOKIE)
  redirect('/')
}
